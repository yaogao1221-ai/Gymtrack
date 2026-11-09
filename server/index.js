import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const { app, backup } = createApp({
  dbFile: path.join(dataDir, 'gymtrack.sqlite'),
  backupDir: path.join(dataDir, 'backups'),
  password: process.env.APP_PASSWORD || '',
  staticDir: path.join(root, 'dist'),
});

// Sauvegarde automatique au démarrage puis toutes les 24 h (14 conservées)
try { backup(); } catch (e) { console.error('Sauvegarde impossible', e.message); }
setInterval(() => { try { backup(); } catch (e) { console.error('Sauvegarde impossible', e.message); } }, 24 * 3600 * 1000).unref();

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`GymTrack AI : http://localhost:${port}${process.env.APP_PASSWORD ? ' (protégé par mot de passe)' : ''}`));
