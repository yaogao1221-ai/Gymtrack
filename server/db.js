// Couche base de données : SQLite natif de Node (node:sqlite), aucune dépendance native à compiler.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { setupDb } from './schema.js';
export { toJSON } from './schema.js';


export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return setupDb(db);
}

// Sauvegarde à chaud du fichier SQLite (VACUUM INTO), rotation des 14 dernières.
export function backupDb(db, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `gymtrack-${stamp}.sqlite`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sqlite')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 14))) fs.unlinkSync(path.join(dir, f));
  return path.basename(file);
}

