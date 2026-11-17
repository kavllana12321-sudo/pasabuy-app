import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID,randomBytes,scryptSync } from 'node:crypto';
import { spawn } from 'node:child_process';
process.loadEnvFile('.env.local');
const url=new URL(process.env.PASABUY_DATABASE_URL);for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
const options={connectionString:url.toString(),ssl:{rejectUnauthorized:true,ca:readFileSync(process.env.PASABUY_DATABASE_CA_PATH,'utf8')},connectionTimeoutMillis:10000};
const db=new Client(options);await db.connect();
const id=randomUUID(),email=`cloud-check-admin-${id}@example.test`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex');
const user={id,email,name:'Temporary cloud test administrator',phone:'09171234567',address:'',role:'admin',vehicle:'',plate:'',serviceArea:'',approved:true,available:false,createdAt:new Date().toISOString()};
await db.query('INSERT INTO pasabuy_app.users(id,email,password,recovery,data) VALUES($1,$2,$3,NULL,$4)',[id,email,`${salt}:${scryptSync(password,salt,64).toString('hex')}`,JSON.stringify(user)]);
let source=readFileSync('tests/backend.smoke.mjs','utf8');
source=source.replace('import { DatabaseSync } from "node:sqlite";','import { Client as PGClient } from "pg";');
source=source.replace('const body = await response.json();',"const body = await response.json(); console.log('Cloud API check:', path, data?.action || 'GET', response.status);");
source=source.replace('const ids = [];',`const ids = [${JSON.stringify(id)}];`);
source=source.replaceAll('"admin@pasabuy.local"',JSON.stringify(email)).replaceAll('"PasaBuy123!"',JSON.stringify(password));
const from=source.indexOf('    const database = new DatabaseSync(');source=source.slice(0,from)+`    const database = new PGClient(${JSON.stringify({...options,ssl:{rejectUnauthorized:true,ca:options.ssl.ca}})});\n    await database.connect();\n    try {\n      await database.query('BEGIN');\n      for (const id of ids) {\n        await database.query('DELETE FROM pasabuy_app.sessions WHERE user_id=$1',[id]);\n        await database.query('DELETE FROM pasabuy_app.bookings WHERE customer_id=$1 OR rider_id=$1',[id]);\n        await database.query('DELETE FROM pasabuy_app.listings WHERE seller_id=$1',[id]);\n        await database.query('DELETE FROM pasabuy_app.conversations WHERE participant_a=$1 OR participant_b=$1',[id]);\n        await database.query('DELETE FROM pasabuy_app.notifications WHERE user_id=$1',[id]);\n        await database.query('DELETE FROM pasabuy_app.users WHERE id=$1',[id]);\n      }\n      await database.query('DELETE FROM pasabuy_app.attempts WHERE key LIKE $1',['%'+prefix+'%']);\n      await database.query('COMMIT');\n    } catch(error) { await database.query('ROLLBACK');throw error; } finally {await database.end();}\n  }\n});\n`;
// The generated test contains temporary credentials; keep it only in memory via stdin.
const env={...process.env,APP_ORIGIN:'http://localhost:3011',TEST_BASE_URL:'http://localhost:3011',PASABUY_DEMO_MODE:'false',PASABUY_TRUST_PROXY:'false'};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3011'],{env,stdio:['ignore','ignore','inherit']});
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(env.TEST_BASE_URL+'/api/auth',{signal:AbortSignal.timeout(3000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw Error('Test server did not start');
 const child=spawn(process.execPath,['--input-type=module'],{env,stdio:['pipe','inherit','inherit']});child.stdin.end(source);process.exitCode=await new Promise(resolve=>child.on('exit',code=>resolve(code??1)));
}finally{
 server.kill('SIGTERM');await db.query('DELETE FROM pasabuy_app.sessions WHERE user_id=$1',[id]);await db.query('DELETE FROM pasabuy_app.users WHERE id=$1',[id]);await db.end();
}
