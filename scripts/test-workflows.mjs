import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
const directory=mkdtempSync(resolve('.data/workflow-check-'));
const env={...process.env,PASABUY_DATABASE_URL:"",PASABUY_DATABASE_CA_PATH:"",PASABUY_DATA_DIR:directory,PASABUY_DEMO_MODE:'true',PASABUY_TRUST_PROXY:'false',APP_ORIGIN:'http://localhost:3003',TEST_BASE_URL:'http://localhost:3003'};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3003'],{env,stdio:'ignore'});
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(env.TEST_BASE_URL+'/api/auth')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 if(!ready)throw new Error('Isolated test server did not start.');
 const test=spawn(process.execPath,['--test','tests/backend.smoke.mjs'],{env,stdio:'inherit'});
 process.exitCode=await new Promise(resolve=>test.on('exit',code=>resolve(code??1)));
}finally{server.kill('SIGTERM');}
