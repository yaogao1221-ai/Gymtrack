// Planification du calendrier à partir du planning type du profil (source unique pour /calendar/plan et les changements de planning)
import { USER_ID, getProfile, getProgram } from './services.js';
import { addDays, dayKey, diffDays } from './util.js';

// Crée les événements muscu / repos de [from, from + days[ sans toucher aux jours déjà planifiés
export function planDays(db, from, days, deloadDays = new Set()) {
  const { schedule } = getProfile(db);
  const byCode = Object.fromEntries(getProgram(db, { withLast: false }).days.map((d) => [d.code, d]));
  let created = 0, skipped = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i); const code = schedule[dayKey(d)];
    if (!code) continue;
    if (db.one("SELECT id FROM calendar_events WHERE user_id = ? AND date = ? AND type IN ('workout','rest')", USER_ID, d)) { skipped++; continue; }
    const dl = deloadDays.has(d) ? 1 : 0;
    if (code === 'rest') db.run("INSERT INTO calendar_events (user_id, date, type, title, deload) VALUES (?,?, 'rest', 'Repos', ?)", USER_ID, d, dl);
    else if (byCode[code]) db.run("INSERT INTO calendar_events (user_id, date, type, program_day_id, deload) VALUES (?,?, 'workout', ?, ?)", USER_ID, d, byCode[code].id, dl);
    else continue;
    created++;
  }
  return { created, skipped };
}

// Le planning type a changé : on refait les jours à venir encore « prévus » (les séances faites ou sautées restent),
// sur l'horizon déjà planifié (au moins 4 semaines s'il y avait quelque chose de prévu), en gardant les semaines de deload.
export function replanFuture(db, today) {
  const last = db.one("SELECT MAX(date) m FROM calendar_events WHERE user_id = ? AND date >= ? AND type IN ('workout','rest') AND status = 'planned'", USER_ID, today).m;
  if (!last) return { created: 0 };
  const to = last > addDays(today, 27) ? last : addDays(today, 27);
  const deloadDays = new Set(db.all('SELECT date FROM calendar_events WHERE user_id = ? AND deload = 1 AND date BETWEEN ? AND ?', USER_ID, today, to).map((e) => e.date));
  db.run("DELETE FROM calendar_events WHERE user_id = ? AND date BETWEEN ? AND ? AND status = 'planned' AND type IN ('workout','rest')", USER_ID, today, to);
  return planDays(db, today, diffDays(today, to) + 1, deloadDays);
}

// Refait l'ordre des séances prévues de [from, to] en commençant par days[startIdx] (jours faits ou sautés gardés, deload gardé)
export function resequence(db, from, to, startIdx, { forceFirst = false } = {}) {
  const days = getProgram(db, { withLast: false }).days; const { schedule } = getProfile(db);
  if (!days.length || startIdx < 0) return { created: 0 };
  const deloadDays = new Set(db.all('SELECT date FROM calendar_events WHERE user_id = ? AND deload = 1 AND date BETWEEN ? AND ?', USER_ID, from, to).map((e) => e.date));
  db.run("DELETE FROM calendar_events WHERE user_id = ? AND date BETWEEN ? AND ? AND status = 'planned' AND type IN ('workout','rest')", USER_ID, from, to);
  let k = startIdx, created = 0;
  for (let i = 0; i <= diffDays(from, to); i++) {
    const d = addDays(from, i); const code = schedule[dayKey(d)];
    if (!code) continue;
    if (db.one("SELECT id FROM calendar_events WHERE user_id = ? AND date = ? AND type IN ('workout','rest')", USER_ID, d)) continue; // déjà faite / sautée / non faite
    if (code === 'rest' && !(forceFirst && i === 0)) { db.run("INSERT INTO calendar_events (user_id, date, type, title, deload) VALUES (?,?, 'rest', 'Repos', ?)", USER_ID, d, deloadDays.has(d) ? 1 : 0); created++; continue; }
    db.run("INSERT INTO calendar_events (user_id, date, type, program_day_id, deload) VALUES (?,?, 'workout', ?, ?)", USER_ID, d, days[k % days.length].id, deloadDays.has(d) ? 1 : 0);
    k++; created++;
  }
  return { created };
}

// Le programme suit ce que tu as vraiment fait :
// 1. une séance prévue passée sans être confirmée devient un repos (« Séance non faite »), et elle est reprogrammée
//    au prochain jour d'entraînement, la suite du programme décalée dans l'ordre ;
// 2. quand tu confirmes une séance (même plus tard, à sa vraie date), les jours suivants reprennent juste après elle.
// Un recalage manuel (« Reprendre par… ») reste respecté tant que rien de tout ça n'arrive.
export function followProgram(db, today, { after = null } = {}) {
  const days = getProgram(db, { withLast: false }).days; if (!days.length) return { changed: false };
  const ids = days.map((d) => d.id); let changed = false;
  db.tx(() => {
    const missed = db.all("SELECT id, program_day_id FROM calendar_events WHERE user_id = ? AND type = 'workout' AND status = 'planned' AND date < ? ORDER BY date, id", USER_ID, today);
    for (const e of missed) db.run("UPDATE calendar_events SET type = 'rest', title = 'Séance non faite', notes = ?, program_day_id = NULL WHERE id = ?", `missed:${e.program_day_id ?? ''}`, e.id);
    let startIdx = -1;
    if (after != null && ids.includes(after)) startIdx = (ids.indexOf(after) + 1) % ids.length;
    else if (missed.length) startIdx = ids.indexOf(missed[0].program_day_id);
    if (missed.length) changed = true;
    if (startIdx < 0) return;
    const first = db.one("SELECT program_day_id FROM calendar_events WHERE user_id = ? AND type = 'workout' AND status = 'planned' AND date >= ? ORDER BY date, id LIMIT 1", USER_ID, today);
    if (!first || first.program_day_id === ids[startIdx]) return;
    const to = db.one("SELECT MAX(date) m FROM calendar_events WHERE user_id = ? AND date >= ? AND type IN ('workout','rest') AND status = 'planned'", USER_ID, today).m;
    resequence(db, today, to, startIdx); changed = true;
  });
  return { changed };
}
