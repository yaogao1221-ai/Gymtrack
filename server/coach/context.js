// Contexte partagé par toutes les décisions du coach : douleurs actives, récupération estimée, deload du jour
import { PAIN_AREAS, recoveryScore } from '../analysis.js';
import { USER_ID, getProfile } from '../services.js';

export function coachContext(db, today) {
  const recovery = recoveryScore(db, getProfile(db), today);
  const painPatterns = new Set();
  for (const p of recovery.pains) (PAIN_AREAS[p.area]?.patterns || []).forEach((x) => painPatterns.add(x));
  const deload = !!db.one('SELECT id FROM calendar_events WHERE user_id = ? AND deload = 1 AND date = ?', USER_ID, today);
  return { recovery, painPatterns, deload };
}
