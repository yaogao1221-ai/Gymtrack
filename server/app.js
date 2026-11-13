import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { openDb, backupDb } from './db.js';
import { isDate } from './util.js';
import programRoutes from './routes/program.js';
import workoutRoutes from './routes/workouts.js';
import cardioRoutes from './routes/cardio.js';
import calendarRoutes from './routes/calendar.js';
import profileRoutes from './routes/profile.js';
import statsRoutes from './routes/stats.js';
import leagueRoutes from './routes/league.js';
import nutritionRoutes from './routes/nutrition.js';
import analysisRoutes from './routes/analysis.js';
import dataRoutes from './routes/data.js';
import insightsRoutes from './routes/insights.js';
import coachRoutes from './routes/coach.js';

export function createApp({ dbFile, backupDir, password = '', staticDir } = {}) {
  const db = openDb(dbFile);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20mb' }));

  const token = password ? crypto.createHmac('sha256', password).update('gymtrack-ai-session').digest('hex') : null;
  const attempts = new Map();
  app.get('/api/auth/status', (req, res) => {
    const t = (req.headers.authorization || '').replace(/^Bearer /, '');
    res.json({ required: !!password, authenticated: !password || safeEq(t, token) });
  });
  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip; const now = Date.now();
    const a = (attempts.get(ip) || []).filter((t) => now - t < 60000);
    if (a.length >= 8) return res.status(429).json({ error: 'Trop de tentatives, réessaie dans une minute' });
    if (!password || safeEq(String(req.body?.password || ''), password)) return res.json({ token });
    attempts.set(ip, [...a, now]);
    res.status(401).json({ error: 'Mot de passe incorrect' });
  });
  app.use('/api', (req, res, next) => {
    if (!password) return next();
    const t = (req.headers.authorization || '').replace(/^Bearer /, '') || req.query.token;
    if (safeEq(String(t || ''), token)) return next();
    res.status(401).json({ error: 'Authentification requise' });
  });
  // Date locale de l'utilisateur (le serveur peut être dans un autre fuseau)
  app.use('/api', (req, res, next) => {
    const d = req.headers['x-local-date'] || req.query.today;
    req.today = isDate(d) ? d : new Date().toISOString().slice(0, 10);
    next();
  });
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  for (const routes of [programRoutes, workoutRoutes, cardioRoutes, calendarRoutes, profileRoutes, statsRoutes, analysisRoutes, leagueRoutes, nutritionRoutes, insightsRoutes, coachRoutes]) app.use('/api', routes(db));
  app.use('/api', dataRoutes(db, { backupDir }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { setHeaders: (res, p) => { if (p.endsWith('sw.js') || p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Erreur serveur' : err.message });
  });
  return { app, db, backup: () => backupDb(db, backupDir) };
}

function safeEq(a, b) {
  if (!b) return false;
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
