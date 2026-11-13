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
