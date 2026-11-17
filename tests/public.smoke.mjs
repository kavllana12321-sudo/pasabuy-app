import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
const dir=mkdtempSync(resolve('.data/public-check-'));
const origin='https://pasabuy.example.test';
const env={...process.env,PASABUY_DATABASE_URL:"",PASABUY_DATABASE_CA_PATH:"",PASABUY_DATA_DIR:dir,PASABUY_DEMO_MODE:'false',APP_ORIGIN:origin,ADMIN_EMAIL:'owner@example.test',ADMIN_NAME:'System Owner',ADMIN_PASSWORD:'PrivateAdminTest123!'};
const setup=spawnSync(process.execPath,['scripts/create-admin.mjs'],{env,encoding:'utf8'});
assert.equal(setup.status,0,setup.stderr);
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3002'],{env,stdio:'ignore'});
const base='http://localhost:3002';
async function post(data,source=origin){return fetch(base+'/api/auth',{method:'POST',headers:{'content-type':'application/json',origin:source},body:JSON.stringify(data)});}
test('public mode has no demo access, owns private admin, validates origin and secure sessions',async()=>{
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/auth')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,'server startup');
  const status=await (await fetch(base+'/api/auth')).json();assert.equal(status.demoEnabled,false);assert.equal(status.user,null);
  const login={action:'login',email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD};
  assert.equal((await post(login,'https://evil.example')).status,403);
  const result=await post(login);assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/; Secure/i);assert.match(result.headers.get('set-cookie'),/HttpOnly/i);
  assert.equal((await post({action:'login',email:'admin@pasabuy.local',password:'PasaBuy123!'})).status,401);
  const page=await fetch(base+'/login');assert.equal(page.headers.get('x-frame-options'),'DENY');assert.equal(page.headers.get('x-content-type-options'),'nosniff');
  const backup=spawnSync(process.execPath,['scripts/backup.mjs'],{env,encoding:'utf8'});assert.equal(backup.status,0,backup.stderr);
  const file=backup.stdout.trim().replace('Verified backup: ','');const restored=new DatabaseSync(file,{readOnly:true});assert.equal(restored.prepare('SELECT email FROM users').get().email,env.ADMIN_EMAIL);restored.close();
  const duplicate=spawnSync(process.execPath,['scripts/create-admin.mjs'],{env,encoding:'utf8'});assert.notEqual(duplicate.status,0);
  const unsafe=spawnSync(process.execPath,['scripts/start.mjs'],{env:{...env,PASABUY_DEMO_MODE:'true'},encoding:'utf8'});assert.notEqual(unsafe.status,0);
 }finally{server.kill('SIGTERM');}
});
