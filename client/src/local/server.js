// « Serveur » local : la même API et la même logique que le backend Node, exécutées dans le navigateur.
// La base SQLite (sql.js) est enregistrée dans IndexedDB sur l'appareil après chaque modification.
import initSqlJs from 'sql.js/dist/sql-asm.js';
import { remoteMeta, upload, download, cloud } from './cloud.js';
import { wrap } from './sqljsDb.js';
import { setupDb } from '../../../server/schema.js';
import { HttpError, isDate } from '../../../server/util.js';
import programRoutes from '../../../server/routes/program.js';
import workoutRoutes from '../../../server/routes/workouts.js';
import cardioRoutes from '../../../server/routes/cardio.js';
import calendarRoutes from '../../../server/routes/calendar.js';
import profileRoutes from '../../../server/routes/profile.js';
import statsRoutes from '../../../server/routes/stats.js';
import leagueRoutes from '../../../server/routes/league.js';
import analysisRoutes from '../../../server/routes/analysis.js';
import nutritionRoutes from '../../../server/routes/nutrition.js';
import insightsRoutes from '../../../server/routes/insights.js';
import { addDataCoreRoutes } from '../../../server/routes/dataCore.js';
import { Router } from './expressShim.js';

const IDB = 'gymtrack-ai', STORE = 'db', KEY = 'main';
const idb = () => new Promise((res, rej) => {
  const r = indexedDB.open(IDB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
// IndexedDB = cache local (démarrage rapide, hors ligne). Peut être indisponible : on continue sans.
async function idbGet(key) {
  try { const d = await idb(); return await new Promise((res, rej) => { const t = d.transaction(STORE).objectStore(STORE).get(key); t.onsuccess = () => res(t.result ?? null); t.onerror = () => rej(t.error); }); }
  catch { return null; }
}
async function idbPut(key, val) {
  try { const d = await idb(); await new Promise((res, rej) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(val, key); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  catch { /* stockage local indisponible */ }
}
const load = () => idbGet(KEY);
const save = (bytes) => idbPut(KEY, bytes);

// --- Synchronisation avec la sauvegarde du compte Claude ---
export const sync = { mode: 'local', lastSync: null, error: null };
let localUpdatedAt = 0; let uploadTimer = null; let uploading = Promise.resolve();
const emit = () => window.dispatchEvent(new CustomEvent('gt-sync', { detail: { ...sync } }));
function scheduleUpload() {
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => { uploading = uploading.then(pushNow).catch(() => {}); }, 2000);
}
async function pushNow() {
  if (sync.mode !== 'cloud') return;
  try {
    const r = await handle('/data/export', { method: 'GET', today: null, internal: true });
    await upload(r.data, localUpdatedAt);
    sync.lastSync = new Date().toISOString(); sync.error = null;
  } catch (e) { sync.error = 'La sauvegarde en ligne a échoué, nouvel essai à la prochaine modification.'; console.error(e); }
  emit();
}
async function startSync(hadLocal) {
  const c = await cloud();
  if (!c) { sync.mode = 'local'; emit(); return; }
  sync.mode = 'cloud';
  try {
    const meta = await remoteMeta();
    if (meta && (!hadLocal || meta.updatedAt > localUpdatedAt)) {
      const json = await download(meta);
      await handle('/data/import', { method: 'POST', body: json, internal: true });
      localUpdatedAt = meta.updatedAt; await idbPut('updatedAt', localUpdatedAt);
      sync.lastSync = new Date().toISOString(); emit();
      window.dispatchEvent(new Event('gt-data-replaced'));
    } else if (!meta || meta.updatedAt < localUpdatedAt) {
      if (!localUpdatedAt) { localUpdatedAt = Date.now(); await idbPut('updatedAt', localUpdatedAt); }
      await pushNow();
    } else { sync.lastSync = new Date().toISOString(); emit(); }
  } catch (e) { sync.error = 'Sauvegarde en ligne injoignable pour le moment.'; console.error(e); emit(); }
}
// Avant de quitter l'app (iPhone : passage en arrière-plan), on envoie tout de suite
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && uploadTimer) { clearTimeout(uploadTimer); uploadTimer = null; uploading = uploading.then(pushNow).catch(() => {}); } });

let ready;
function boot() {
  ready ||= (async () => {
    navigator.storage?.persist?.().catch(() => {});
    const SQL = await initSqlJs();
    const bytes = await load();
    localUpdatedAt = (await idbGet('updatedAt')) || 0;
    const raw = bytes ? new SQL.Database(new Uint8Array(bytes)) : new SQL.Database();
    raw.exec('PRAGMA foreign_keys = ON;');
    const db = setupDb(wrap(raw));
    const routes = [];
    for (const f of [programRoutes, workoutRoutes, cardioRoutes, calendarRoutes, profileRoutes, statsRoutes, analysisRoutes, leagueRoutes, nutritionRoutes, insightsRoutes]) routes.push(...f(db).routes);
    const data = Router(); addDataCoreRoutes(data, db); routes.push(...data.routes);
    if (!bytes) { await save(raw.export()); raw.exec('PRAGMA foreign_keys = ON;'); }
    setTimeout(() => startSync(!!bytes && localUpdatedAt > 0), 0);
    return { db, raw, routes };
  })();
  return ready;
}

let chain = Promise.resolve();
export function handle(path, { method = 'GET', body, today, internal = false }) {
  // requêtes sérialisées : pas d'écritures concurrentes
  const p = chain.then(() => run(path, method, body, today, internal));
  chain = p.catch(() => {});
  return p;
}

async function run(path, method, body, today, internal) {
  const { raw, routes } = await boot();
  const url = new URL(path, 'http://local');
  if (url.pathname === '/auth/status') return { status: 200, data: { required: false, authenticated: true, standalone: true } };
  if (url.pathname === '/health') return { status: 200, data: { ok: true } };
  const route = routes.find((r) => r.method === method && r.re.test(url.pathname));
  if (!route) return { status: 404, data: { error: 'Route inconnue' } };
  const m = url.pathname.match(route.re);
  const req = { params: Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])), query: Object.fromEntries(url.searchParams), body: body ?? {}, today: isDate(today) ? today : new Date().toISOString().slice(0, 10), headers: {} };
  const res = { statusCode: 200, headers: {}, payload: undefined, text: undefined,
    status(n) { this.statusCode = n; return this; }, json(x) { this.payload = x; return this; }, send(t) { this.text = t; return this; }, setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; } };
  try {
    route.handler(req, res);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error(e);
    return { status, data: { error: status >= 500 ? 'Erreur interne' : e.message } };
  }
  if (method !== 'GET') {
    const bytes = raw.export(); raw.exec('PRAGMA foreign_keys = ON;'); await save(bytes);
    if (!internal && res.statusCode < 400) { localUpdatedAt = Date.now(); await idbPut('updatedAt', localUpdatedAt); scheduleUpload(); }
  }
  return { status: res.statusCode, data: res.payload, text: res.text, headers: res.headers };
}
