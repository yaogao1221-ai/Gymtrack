// Habitudes du jour : compléments cochés et mode Ramadan (horaires, repas, séance allégée)
import { USER_ID } from './services.js';
import { toJSON } from './schema.js';
import { addDays, diffDays } from './util.js';

// ---------- Compléments ----------
export const DEFAULT_SUPPLEMENTS = [
  { key: 'creatine', label: 'Créatine', dose: '5 g' },
  { key: 'proteines', label: 'Protéines (shaker)', dose: '30 g' },
  { key: 'eau', label: 'Eau', dose: '2,5 L' },
];

export function supplementList(db) {
  const p = db.one('SELECT supplements FROM profiles WHERE user_id = ?', USER_ID);
  const l = toJSON(p?.supplements, null);
  return Array.isArray(l) ? l : DEFAULT_SUPPLEMENTS;
}

// Série : jours d'affilée cochés, jusqu'à aujourd'hui (ou hier si pas encore coché aujourd'hui)
function streak(dates, today) {
  const set = new Set(dates); let d = set.has(today) ? today : addDays(today, -1); let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function supplementsState(db, today) {
  const items = supplementList(db);
  const rows = db.all('SELECT date, key FROM supplement_logs WHERE user_id = ? AND date >= ? ORDER BY date', USER_ID, addDays(today, -400));
  const by = {}; for (const r of rows) (by[r.key] ||= []).push(r.date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return {
    today,
    items: items.map((it) => {
      const ds = by[it.key] || [];
      return { ...it, done: ds.includes(today), streak: streak(ds, today), week: week.map((d) => ds.includes(d)) };
    }),
  };
}

export function toggleSupplement(db, today, key, on, date = today) {
  if (!supplementList(db).some((x) => x.key === key)) return false;
  db.run('DELETE FROM supplement_logs WHERE user_id = ? AND date = ? AND key = ?', USER_ID, date, key);
  if (on) db.run('INSERT INTO supplement_logs (user_id, date, key) VALUES (?,?,?)', USER_ID, date, key);
  return true;
}

export function saveSupplements(db, list) {
  const clean = (Array.isArray(list) ? list : []).slice(0, 8).map((x, i) => {
    const label = String(x?.label || '').trim().slice(0, 40); if (!label) return null;
    const key = String(x.key || label).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || `c${i}`;
    return { key, label, dose: String(x.dose || '').trim().slice(0, 20) };
  }).filter(Boolean);
  const uniq = []; for (const x of clean) if (!uniq.some((u) => u.key === x.key)) uniq.push(x);
  db.run('UPDATE profiles SET supplements = ? WHERE user_id = ?', JSON.stringify(uniq), USER_ID);
  return uniq;
}

// ---------- Ramadan ----------
// Dates estimées (le début dépend de l'observation de la lune) : modifiables dans les réglages
export const RAMADAN_ESTIMATES = [['2026-02-18', '2026-03-19'], ['2027-02-08', '2027-03-09'], ['2028-01-28', '2028-02-25'], ['2029-01-16', '2029-02-13']];

const rad = Math.PI / 180;
// Heure (Date) où le soleil passe à l'altitude alt (degrés) : rising = matin, sinon soir. Équation du lever/coucher.
export function sunTime(date, lat, lon, alt, rising) {
  const [y, m, d] = date.split('-').map(Number);
  const jd = Date.UTC(y, m - 1, d, 12) / 864e5 + 2440587.5;
  const n = Math.round(jd - 2451545 + 0.0008); const js = n - lon / 360;
  const M = (357.5291 + 0.98560028 * js) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const jt = 2451545 + js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const sd = Math.sin(L * rad) * Math.sin(23.4397 * rad); const cd = Math.cos(Math.asin(sd));
  const cw = (Math.sin(alt * rad) - Math.sin(lat * rad) * sd) / (Math.cos(lat * rad) * cd);
  if (cw < -1 || cw > 1) return null;
  const w = Math.acos(cw) / rad;
  return new Date(((rising ? jt - w / 360 : jt + w / 360) - 2440587.5) * 864e5);
}
const hm = (dt) => (dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : null);
const toMin = (t) => { const [h, m] = String(t || '').split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };
const fromMin = (x) => { const v = ((Math.round(x) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };

export function ramadanSettings(db, today) {
  const p = db.one('SELECT ramadan FROM profiles WHERE user_id = ?', USER_ID);
  const s = toJSON(p?.ramadan, {}) || {};
  const est = RAMADAN_ESTIMATES.find(([, e]) => e >= today) || RAMADAN_ESTIMATES.at(-1);
  return { on: !!s.on, start: s.start || est[0], end: s.end || est[1], estimated: !s.start, when: s.when === 'avant_ftour' ? 'avant_ftour' : 'apres_ftour',
    lat: s.lat ?? null, lon: s.lon ?? null, ftour: s.ftour || null, shour: s.shour || null };
}

export function saveRamadan(db, body) {
  const t = (v) => (/^\d{2}:\d{2}$/.test(v || '') ? v : null); const dt = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
  const n = (v, a) => (v == null || v === '' || !Number.isFinite(Number(v)) || Math.abs(Number(v)) > a ? null : Math.round(Number(v) * 100) / 100);
  const s = { on: !!body.on, start: dt(body.start), end: dt(body.end), when: body.when === 'avant_ftour' ? 'avant_ftour' : 'apres_ftour', lat: n(body.lat, 90), lon: n(body.lon, 180), ftour: t(body.ftour), shour: t(body.shour) };
  if (s.start && s.end && s.end < s.start) [s.start, s.end] = [s.end, s.start];
  db.run('UPDATE profiles SET ramadan = ? WHERE user_id = ?', JSON.stringify(s), USER_ID);
}

// Horaires du jour : calculés depuis la position (Maghrib = coucher du soleil, Fajr à -18°), sinon heures saisies
export function ramadanTimes(s, date) {
  if (s.lat != null && s.lon != null) {
    const set = sunTime(date, s.lat, s.lon, -0.833, false); const fajr = sunTime(date, s.lat, s.lon, -18, true);
    if (set && fajr) return { ftour: hm(set), shour: hm(fajr), source: 'position' };
  }
  return { ftour: s.ftour, shour: s.shour, source: s.ftour ? 'saisi' : null };
}

export function ramadanState(db, today, kcal = null, protein = null) {
  const s = ramadanSettings(db, today);
  const active = s.on && today >= s.start && today <= s.end;
  const soon = s.on && !active && today < s.start && diffDays(today, s.start) <= 14;
  const times = ramadanTimes(s, today);
  const f = toMin(times.ftour);
  const train_at = f == null ? null : s.when === 'avant_ftour' ? fromMin(f - 75) : fromMin(f + 90);
  const split = [['ftour', 'Ftour', 0.4, 0.35], ['collation', 'Après la séance', 0.2, 0.3], ['shour', 'Shour', 0.4, 0.35]];
  const meals = split.map(([key, label, k, pr]) => ({ key, label, kcal: kcal ? Math.round((kcal * k) / 10) * 10 : null, protein_g: protein ? Math.round(protein * pr) : null }));
  return {
    today, settings: s, active, soon, day: active ? diffDays(s.start, today) + 1 : null, days: diffDays(s.start, s.end) + 1,
    ...times, train_at, meals, water_l: 2.5,
    // Pendant le jeûne : on garde les charges ; à jeun avant le ftour, une série de moins et plus de repos
    lighten: active ? { hold_loads: true, minus_set: s.when === 'avant_ftour', extra_rest: s.when === 'avant_ftour' ? 30 : 0 } : null,
  };
}
