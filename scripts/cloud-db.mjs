import { Client } from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID, randomBytes, scryptSync, createHash } from 'node:crypto';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(!process.env.PASABUY_DATABASE_URL)throw new Error('Add PASABUY_DATABASE_URL to .env.local. Never paste it in chat.');
const url=new URL(process.env.PASABUY_DATABASE_URL);
for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
const client=new Client({connectionString:url.toString(),ssl:{rejectUnauthorized:true,...(process.env.PASABUY_DATABASE_CA_PATH?{ca:readFileSync(process.env.PASABUY_DATABASE_CA_PATH,"utf8")}:{})},connectionTimeoutMillis:10000});
try{
 await client.connect();
 const action=process.argv[2];
 if(action==='check'){
  const {rows}=await client.query("SELECT to_regclass('pasabuy_app.users') IS NOT NULL AS migrated");
  console.log(JSON.stringify({connected:true,migrated:rows[0].migrated}));
 }else if(action==='migrate'){
  await client.query(readFileSync('supabase/migrations/202611170001_pasabuy_app.sql','utf8'));
  console.log('Private application tables are ready. Existing public/auth schemas were not changed.');
 }else if(action==='admin'){
  const email=(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),name=(process.env.ADMIN_NAME||'').trim(),password=process.env.ADMIN_PASSWORD||'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.endsWith('.local')||name.length<2||password.length<14||password.length>128)throw new Error('Set ADMIN_EMAIL, ADMIN_NAME and a private ADMIN_PASSWORD (14–128 characters) locally.');
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(17871501)');
  const existing=await client.query('SELECT data FROM pasabuy_app.users');
  if(existing.rows.some(row=>JSON.parse(row.data).role==='admin'))throw new Error('An administrator already exists; nothing was overwritten.');
  const salt=randomBytes(16).toString('hex'),code=randomBytes(16).toString('hex').match(/.{4}/g).join('-');
  const user={id:randomUUID(),email,name,phone:'',address:'',role:'admin',vehicle:'',plate:'',serviceArea:'',approved:true,available:false,createdAt:new Date().toISOString()};
  await client.query('INSERT INTO pasabuy_app.users(id,email,password,recovery,data) VALUES($1,$2,$3,$4,$5)',[user.id,email,`${salt}:${scryptSync(password,salt,64).toString('hex')}`,createHash('sha256').update(code.replaceAll('-','')).digest('hex'),JSON.stringify(user)]);
  await client.query('COMMIT');console.log('Admin created. Save this recovery code privately:');console.log(code);
 }else throw new Error('Use check, migrate, or admin.');
}catch(error){try{await client.query('ROLLBACK');}catch{} console.error('Cloud database operation failed. Check the connection, password, TLS and migration. Code:',error.code||'configuration');process.exitCode=1;}finally{await client.end();}
