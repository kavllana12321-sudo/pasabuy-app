import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, existsSync, chmodSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
const dir=process.env.PASABUY_DATA_DIR;
if(!dir || !isAbsolute(dir)) throw new Error('Set an absolute PASABUY_DATA_DIR.');
const source=join(dir,'pasabuy.sqlite');
if(!existsSync(source)) throw new Error('No database exists at PASABUY_DATA_DIR.');
const destination=resolve(process.env.PASABUY_BACKUP_DIR || join(dir,'backups'));
mkdirSync(destination,{recursive:true});
const output=join(destination,`pasabuy-${Date.now()}.sqlite`);
const db=new DatabaseSync(source,{readOnly:true});
try {await backup(db,output);chmodSync(output,0o600);const check=new DatabaseSync(output,{readOnly:true});try {if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok') throw new Error('Backup integrity check failed.');}finally{check.close();}console.log('Verified backup:',output);}finally{db.close();}
