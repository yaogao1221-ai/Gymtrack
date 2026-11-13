// Double progression : toutes les séries réussies la dernière fois → charge suivante ; sinon même charge, une répétition de plus
export function suggestNext(pe) {
  const last = (pe.last?.sets || []).filter((x) => x.completed !== 0);
  const target = Number(pe.reps) || null;
  if (!last.length || !target) return null;
  const step = pe.weight_unit === 'kg' ? 2.5 : 5;
  const reps = last.map((x) => Number(x.reps) || 0);
  const allHit = reps.every((r) => r >= target);
  if (pe.kind === 'bodyweight') {
    const best = Math.max(...reps);
    return allHit ? { reps: best + 1, text: `${best + 1} répétitions par série`, why: `Toutes tes séries à ${target} la dernière fois : une de plus.` } : { reps: target, text: `${target} répétitions par série`, why: 'Objectif : réussir toutes les séries.' };
  }
  const w = Math.max(...last.map((x) => Number(x.weight) || 0).filter((x) => x > 0), 0);
  const wa = pe.kind === 'assisted' ? Math.min(...last.map((x) => Number(x.weight) || Infinity)) : w;
  if (!wa || !Number.isFinite(wa)) return null;
  if (allHit) {
    const g = step / 2; const nw = Math.round((pe.kind === 'assisted' ? Math.max(0, wa - step) : wa + step) / g) * g;
    return { weight: nw, reps: target, text: `${nw.toLocaleString('fr-FR')} ${pe.weight_unit}${pe.kind === 'assisted' ? ' d’assistance' : ''} × ${target}`, why: `Toutes tes séries à ${target} répétitions la dernière fois : on ${pe.kind === 'assisted' ? 'retire' : 'ajoute'} ${step.toLocaleString('fr-FR')} ${pe.weight_unit}.` };
  }
  const goal = Math.min(target, Math.max(...reps) + 1);
  return { weight: wa, reps: goal, text: `${wa.toLocaleString('fr-FR')} ${pe.weight_unit} × ${goal}`, why: `Même charge que la dernière fois, vise ${goal} répétitions sur chaque série avant de monter.` };
}
