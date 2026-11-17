import { cpSync, mkdirSync, readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const destination=resolve('.data',`github-source-${Date.now()}`);
mkdirSync(destination,{recursive:true});
const entries=['src','public','config','scripts','tests','supabase','deploy','AGENTS.md','package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','eslint.config.mjs','netlify.toml','Dockerfile','.dockerignore','.gitignore','README.md','DEPLOYMENT.md','FREE-HOSTING.md','PUBLIC-READINESS.md'];
for(const entry of entries){if(existsSync(entry))cpSync(entry,join(destination,entry),{recursive:true,dereference:false});}
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const uri=process.env.PASABUY_DATABASE_URL;const password=uri?decodeURIComponent(new URL(uri).password):'';
let count=0;
function inspect(directory){for(const name of readdirSync(directory)){const path=join(directory,name),stat=lstatSync(path);if(stat.isSymbolicLink())throw Error('Source package contains a link');if(stat.isDirectory())inspect(path);else{if(name.startsWith('.env')||name.endsWith('.sqlite'))throw Error('Private file in source package');const contents=readFileSync(path);if(uri&&contents.includes(Buffer.from(uri)))throw Error('Connection secret in source package');if(password.length>=6&&contents.includes(Buffer.from(password)))throw Error('Credential in source package');count++;}}}
inspect(destination);console.log(JSON.stringify({sourceFolder:destination,files:count,secretCheck:'passed'}));
