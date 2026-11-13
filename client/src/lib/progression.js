// La décision vient du moteur de progression unique côté serveur (server/coach/progression.js),
// jointe à chaque exercice par GET /program. Plus aucun calcul ici : accueil, briefing, séance et débrief disent la même chose.
export function suggestNext(pe) {
  const c = pe.coach; if (!c || !c.today) return null;
  if (c.type === 'hold') return { ...c.today, hold: true, state: c.state, state_label: c.state_label };
  if (c.type !== 'increase' && c.type !== 'decrease' && c.type !== 'keep') return null;
  return { ...c.today, state: c.state, state_label: c.state_label, up: c.type === 'increase', down: c.type === 'decrease' };
}
