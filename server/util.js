export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const parse = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
export const fmt = (dt) => dt.toISOString().slice(0, 10);
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime()) && fmt(parse(s)) === s;
export const addDays = (d, n) => { const x = parse(d); x.setUTCDate(x.getUTCDate() + n); return fmt(x); };
export const dayKey = (d) => DAY_KEYS[parse(d).getUTCDay()];
export const weekStart = (d) => { const wd = parse(d).getUTCDay(); return addDays(d, wd === 0 ? -6 : 1 - wd); };
export const monthStart = (d) => d.slice(0, 8) + '01';
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bad = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'Introuvable') => new HttpError(404, msg);

// Nombre facultatif : '' / null / undefined -> null ; sinon nombre fini sinon erreur
export function num(v, field, { min = -Infinity, max = Infinity, int = false } = {}) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) throw bad(`Valeur invalide pour « ${field} »`);
  return n;
}
export function str(v, field, { required = false, max = 2000 } = {}) {
  if (v == null || v === '') { if (required) throw bad(`« ${field} » est requis`); return null; }
  if (typeof v !== 'string') throw bad(`« ${field} » doit être un texte`);
  return v.trim().slice(0, max);
}
export function oneOf(v, field, values, { required = false } = {}) {
  if (v == null || v === '') { if (required) throw bad(`« ${field} » est requis`); return null; }
  if (!values.includes(v)) throw bad(`Valeur non autorisée pour « ${field} »`);
  return v;
}
export function date(v, field = 'date', { required = true } = {}) {
  if (v == null || v === '') { if (required) throw bad(`« ${field} » est requis`); return null; }
  if (!isDate(v)) throw bad(`Date invalide (${field})`);
  return v;
}

// Applique un patch partiel sur une table à partir d'une liste de champs autorisés et normalisés
export function patchRow(db, table, id, body, fields) {
  const sets = []; const vals = [];
  for (const [key, norm] of Object.entries(fields)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) { sets.push(`${key} = ?`); vals.push(norm(body[key])); }
  }
  if (!sets.length) return 0;
  return db.run(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, ...vals, id).changes;
}
