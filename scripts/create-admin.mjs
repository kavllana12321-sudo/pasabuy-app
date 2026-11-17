import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scryptSync, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
const directory = process.env.PASABUY_DATA_DIR;
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = (process.env.ADMIN_NAME || '').trim();
if (!directory || !isAbsolute(directory)) throw new Error('Set an absolute PASABUY_DATA_DIR.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('.local')) throw new Error('Set a real ADMIN_EMAIL.');
if (password.length < 14 || password.length > 128 || password === 'PasaBuy123!') throw new Error('ADMIN_PASSWORD must contain 14–128 characters.');
if (name.length < 2) throw new Error('Set ADMIN_NAME.');
mkdirSync(directory, { recursive: true });
const db = new DatabaseSync(join(directory, 'pasabuy.sqlite'));
try {
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,recovery TEXT,data TEXT NOT NULL); BEGIN IMMEDIATE');
  if (db.prepare('SELECT data FROM users').all().some(row => JSON.parse(row.data).role === 'admin' && !JSON.parse(row.data).email.endsWith('@pasabuy.local'))) throw new Error('An administrator already exists. Use the existing account; this command does not overwrite it.');
  const salt=randomBytes(16).toString('hex');
  const recoveryCode=randomBytes(16).toString('hex').match(/.{4}/g).join('-');
  const user={id:randomUUID(),name,email,phone:'',address:'',role:'admin',vehicle:'',plate:'',serviceArea:'',approved:true,available:false,createdAt:new Date().toISOString()};
  db.prepare('INSERT INTO users(id,email,password,recovery,data) VALUES(?,?,?,?,?)').run(user.id,email,`${salt}:${scryptSync(password,salt,64).toString('hex')}`,createHash('sha256').update(recoveryCode.replaceAll('-','')).digest('hex'),JSON.stringify(user));
  db.exec('COMMIT');
  console.log('Administrator created. Save this one-time recovery code privately:');
  console.log(recoveryCode);
} catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; } finally { db.close(); }
