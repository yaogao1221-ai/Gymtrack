// Formules de référence de GymTrack : une seule implémentation par calcul, partagée par le serveur,
// la version autonome (navigateur) et les écrans (import direct côté client).

export const LBS_PER_KG = 2.20462;
export const r1 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
export const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

// Conversion de charge vers les lbs (unité de calcul du volume et des records)
export const toLbs = (w, unit) => (w == null ? null : unit === 'kg' ? w * LBS_PER_KG : w);
export const fromLbs = (lbs, unit) => (lbs == null ? null : unit === 'kg' ? lbs / LBS_PER_KG : lbs);

// Volume (tonnage) d'une série : charge × reps, nul pour les exercices assistés et les séries non validées
export const setVolume = ({ weight, reps, unit, completed = true, kind = 'weighted' }) =>
  (!completed || kind === 'assisted' || weight == null ? 0 : toLbs(weight, unit) * (reps || 0));

// 1RM estimé. 1 rep = la charge ; 2 à 10 reps : moyenne Epley / Brzycki ; au-delà : Epley seul (Brzycki diverge).
// Sans répétition ou sans charge, pas d'estimation.
export function e1rm(weight, reps) {
  const w = Number(weight); const r = Number(reps);
  if (!w || !r || r < 1) return null;
  if (r === 1) return w;
  const epley = w * (1 + r / 30);
  if (r > 10) return epley;
  const brzycki = (w * 36) / (37 - r);
  return (epley + brzycki) / 2;
}

// Poids lissé : moyenne des pesées des 7 jours qui précèdent la dernière pesée (moins sensible à l'eau et au sel)
export function smoothedWeight(rows) {
  const ws = rows.filter((r) => r.weight_kg != null).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0)));
  if (!ws.length) return null;
  const last = ws.at(-1);
  const from = new Date(`${last.date}T00:00:00Z`); from.setUTCDate(from.getUTCDate() - 6);
  const f = from.toISOString().slice(0, 10);
  const win = ws.filter((r) => r.date >= f);
  return { value: r1(win.reduce((a, r) => a + r.weight_kg, 0) / win.length), n: win.length, last: last.weight_kg, date: last.date };
}

// Progression vers un objectif (0..1). Gère les objectifs à la baisse (perte de poids, assistance) comme à la hausse.
export function goalProgress(start, current, target) {
  if (current == null || target == null) return null;
  if (start == null || start === target) {
    // Sans point de départ, seul « atteint ou non » est fiable
    return null;
  }
  const p = (current - start) / (target - start);
  return Math.max(0, Math.min(1, p));
}
export const goalReached = (start, current, target, lowerIsBetter) => {
  if (current == null || target == null) return false;
  const down = lowerIsBetter ?? (start != null ? target < start : false);
  return down ? current <= target : current >= target;
};
