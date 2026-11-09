import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { backupDb } from '../db.js';
import { bad } from '../util.js';
import { addDataCoreRoutes } from './dataCore.js';

export default function dataRoutes(db, { backupDir }) {
  const r = Router();
  addDataCoreRoutes(r, db, { beforeImport: () => backupDb(db, backupDir) });
  r.get('/data/backups', (req, res) => {
    fs.mkdirSync(backupDir, { recursive: true });
    res.json(fs.readdirSync(backupDir).filter((f) => f.endsWith('.sqlite')).sort().reverse().map((f) => ({ file: f, size: fs.statSync(path.join(backupDir, f)).size })));
  });
  r.post('/data/backups', (req, res) => res.status(201).json({ file: backupDb(db, backupDir) }));
  r.get('/data/backups/:file', (req, res) => {
    const f = path.basename(req.params.file); const p = path.join(backupDir, f);
    if (!f.endsWith('.sqlite') || !fs.existsSync(p)) throw bad('Sauvegarde introuvable');
    res.download(p);
  });
  return r;
}
