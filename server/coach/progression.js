// Moteur de progression unique (serveur, déterministe). Tous les écrans l'utilisent :
// accueil, briefing, séance, débrief, espace Coach. Il ne modifie jamais rien : il décide, l'utilisateur valide.
//
// Quatre niveaux de confiance pour une hausse :
//  - confirmee   : objectif atteint sur les 2 dernières séances à cette charge, effort < 9 ;
//  - suggeree    : objectif atteint une fois (ou objectif + 2 reps partout), effort < 9 ;
//  - a_valider   : décision qui demande ton avis (baisse après échecs, objectif atteint mais séance à la limite) ;
//  - insuffisant : pas assez de données pour décider (aucune séance, charge non saisie).
// Les maintiens (douleur, récupération basse, séance à la limite) sont de type « hold ».
import { USER_ID } from '../services.js';

export const STATE_LABEL = { confirmee: 'Hausse confirmée', suggeree: 'Hausse suggérée', a_valider: 'À valider', insuffisant: 'Données insuffisantes', maintien: 'Maintien' };
const frDate = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d);
export const grid = (x, unit) => { const g = unit === 'kg' ? 1.25 : 2.5; return Math.round(x / g) * g; };
const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

// Dernières séances d'un exercice, avec l'effort ressenti de la séance (RPE 1-10, saisi en fin de séance)
export function history(db, exerciseId, n = 4, beforeDate = '9999-12-31') {
  const ws = db.all(`SELECT DISTINCT w.id, w.date, w.rpe FROM workouts w JOIN workout_sets s ON s.workout_id = w.id
    WHERE w.user_id = ? AND s.exercise_id = ? AND w.date <= ? ORDER BY w.date DESC, w.id DESC LIMIT ?`, USER_ID, exerciseId, beforeDate, n);
  return ws.map((w) => ({ ...w, sets: db.all('SELECT set_index, weight, weight_unit, reps, target_reps, completed FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_index', w.id, exerciseId) }));
}

function summarize(sess, pe) {
  const done = sess.sets.filter((s) => s.completed);
  const target = pe.reps;
  const weights = done.map((s) => s.weight).filter((w) => w != null);
  const w = weights.length ? (pe.kind === 'assisted' ? Math.min(...weights) : Math.max(...weights)) : null;
  const allHit = done.length >= pe.sets && (!target || done.every((s) => (s.reps || 0) >= target));
  const plus2 = !!target && done.length >= pe.sets && done.every((s) => (s.reps || 0) >= target + 2);
  const miss = target && done.length ? done.reduce((a, s) => a + Math.max(0, target - (s.reps || 0)), 0) / done.length : 0;
  const reps = done.map((s) => s.reps || 0);
  return { date: sess.date, rpe: sess.rpe, w, allHit, plus2, miss, reps, n: done.length };
}

// Décision pour un exercice du programme. ctx = { painPatterns:Set, recovery:{score,label}, deload:boolean }
export function decide(db, pe, ctx = {}) {
  const unit = pe.weight_unit; const target = pe.reps;
  const base = { program_exercise_id: pe.id, exercise_id: pe.exercise_id, exercise: pe.name, day_id: pe.day_id };
  const out = (o) => ({ ...base, ...o, state_label: STATE_LABEL[o.state] });
  const hist = history(db, pe.exercise_id, 4);
  if (!hist.length) {
    if (pe.kind !== 'bodyweight' && pe.target_weight == null) return out({ key: `prog:${pe.id}:setup`, type: 'info', state: 'insuffisant', title: `${pe.name} : charge à définir`, reason: 'Aucune séance enregistrée. Choisis une charge qui laisse 2 répétitions en réserve à la dernière série ; le coach partira de là.', evidence: [] });
    return out({ key: `prog:${pe.id}:none`, type: 'keep', state: 'insuffisant', title: `${pe.name} : première séance`, reason: 'Aucune séance enregistrée : fais la séance prévue, le coach décidera ensuite.', evidence: [], silent: true });
  }
  const [L, P] = hist.map((h) => summarize(h, pe));
  const lastW = L.w;
  const evidence = hist.slice(0, 3).map((h) => { const s = summarize(h, pe); return `${frDate(s.date)} : ${s.w != null ? `${fmt(s.w)} ${unit} × ` : ''}${s.reps.join('/')}${s.rpe ? ` · effort ${fmt(s.rpe)}/10` : ''}`; });
  if (pe.kind === 'weighted' && lastW == null) return out({ key: `prog:${pe.id}:setup`, type: 'info', state: 'insuffisant', title: `${pe.name} : charge à définir`, reason: 'Aucune charge saisie lors de la dernière séance. Renseigne-la pour que le coach suive ta progression.', evidence });
  const today = lastW != null ? { weight: lastW, reps: target } : { reps: target };
  if (ctx.painPatterns?.has(pe.pattern)) return out({ key: `prog:${pe.id}:pain`, type: 'hold', state: 'maintien', title: `${pe.name} : ne pas augmenter`, reason: 'Une douleur active concerne cet exercice. Garde la charge (ou baisse-la), amplitude confortable, technique parfaite. Si la douleur persiste, consulte un professionnel de santé.', evidence, today: { ...today, text: lastW != null ? `${fmt(lastW)} ${unit} max` : 'sans hausse', why: 'Douleur active : pas de hausse.' } });

  if (L.allHit) {
    if (L.rpe != null && L.rpe >= 9) return out({ key: `prog:${pe.id}:rpe:${L.date}`, type: 'hold', state: 'maintien', title: `${pe.name} : objectif atteint, mais à la limite`, reason: `Toutes les séries sont réussies le ${frDate(L.date)}, mais l'effort ressenti était de ${fmt(L.rpe)}/10. On répète la même charge pour qu'elle devienne facile avant de monter.`, evidence, today: { ...today, text: lastW != null ? `${fmt(lastW)} ${unit} × ${target}` : `${target} reps`, why: `Effort ${fmt(L.rpe)}/10 la dernière fois : même charge.` } });
    if (ctx.recovery && ctx.recovery.score < 55) return out({ key: `prog:${pe.id}:recovery`, type: 'hold', state: 'maintien', title: `${pe.name} : objectif atteint, progression en pause`, reason: `Toutes les séries sont réussies, mais ta récupération estimée est « ${ctx.recovery.label.toLowerCase()} » (${ctx.recovery.score}/100). On consolide avant d'augmenter.`, evidence, today: { ...today, text: lastW != null ? `${fmt(lastW)} ${unit} × ${target}` : `${target} reps`, why: 'Récupération basse : même charge.' } });
    // Confirmée : l'objectif a été atteint deux fois de suite à la même charge (ou plus dure pour l'assistance)
    const sameLoad = P && P.w != null && lastW != null && (pe.kind === 'assisted' ? P.w <= lastW : P.w >= lastW);
    const confirmed = (P && P.allHit && (sameLoad || lastW == null) && (P.rpe == null || P.rpe < 9.5));
    const state = confirmed ? 'confirmee' : 'suggeree';
    const why = confirmed ? `Objectif atteint deux séances de suite (${frDate(P.date)} et ${frDate(L.date)}).`
      : L.plus2 ? `Objectif dépassé de 2 répétitions sur chaque série le ${frDate(L.date)}.`
        : `Objectif atteint le ${frDate(L.date)}${hist.length === 1 ? ', sur ta seule séance enregistrée' : ', une seule fois à cette charge'}. À toi de juger si c'était propre.`;
    if (pe.kind === 'assisted' && lastW != null) {
      const proposed = Math.max(0, grid(lastW - (unit === 'kg' ? 5 : 10), unit));
      return out({ key: `prog:${pe.id}:inc:${proposed}`, type: 'increase', state, title: `${pe.name} : réduire l'assistance à ${fmt(proposed)} ${unit}`, current: `${fmt(lastW)} ${unit}`, proposed_label: `${fmt(proposed)} ${unit} d'assistance`, patch: { target_weight: proposed, target_weight_max: null }, reason: why, evidence, today: { weight: proposed, reps: target, text: `${fmt(proposed)} ${unit} d'assistance × ${target}`, why } });
    }
    if (lastW != null && pe.kind !== 'bodyweight') {
      const step = unit === 'kg' ? 2.5 : 5;
      let proposed = grid(lastW + step, unit);
      if (pe.target_weight_max && lastW < pe.target_weight_max) proposed = pe.target_weight_max;
      return out({ key: `prog:${pe.id}:inc:${proposed}`, type: 'increase', state, title: `${pe.name} : passer à ${fmt(proposed)} ${unit}`, current: `${fmt(lastW)} ${unit}`, proposed_label: `${fmt(proposed)} ${unit}${pe.weight_note ? ' ' + pe.weight_note : ''}`, patch: { target_weight: proposed, target_weight_max: null }, reason: why, evidence, today: { weight: proposed, reps: target, text: `${fmt(proposed)} ${unit} × ${target}`, why } });
    }
    if (target && target < 15) {
      const proposed = Math.min(15, target + (L.plus2 ? 2 : 1));
      return out({ key: `prog:${pe.id}:reps:${proposed}`, type: 'increase', state, title: `${pe.name} : viser ${proposed} répétitions`, current: `${target} reps`, proposed_label: `${pe.sets} × ${proposed}`, patch: { reps: proposed }, reason: `${why} Au poids du corps, on progresse d'abord en répétitions.`, evidence, today: { reps: proposed, text: `${proposed} répétitions par série`, why } });
    }
    return out({ key: `prog:${pe.id}:max`, type: 'keep', state: 'insuffisant', title: `${pe.name} : 15 répétitions atteintes`, reason: 'Ajoute du lest ou passe à une variante plus difficile.', evidence, silent: true });
  }
  // Objectif manqué : échecs nets deux fois de suite → baisse proposée (à valider)
  if (target && lastW != null && P && L.miss >= 2 && P.miss >= 2) {
    const proposed = pe.kind === 'assisted' ? grid(lastW + (unit === 'kg' ? 5 : 10), unit) : Math.max(0, grid(lastW * 0.9, unit));
    return out({ key: `prog:${pe.id}:dec:${proposed}`, type: 'decrease', state: 'a_valider', title: `${pe.name} : consolider à ${fmt(proposed)} ${unit}`, current: `${fmt(lastW)} ${unit}`, proposed_label: `${fmt(proposed)} ${unit}${pe.kind === 'assisted' ? " d'assistance" : ''}`, patch: { target_weight: proposed, target_weight_max: null }, reason: `En moyenne ${fmt(L.miss)} répétitions manquées par série le ${frDate(L.date)}, et ${fmt(P.miss)} le ${frDate(P.date)}. Une baisse d'environ 10 % permet de retrouver une technique propre et de repartir.`, evidence, today: { weight: proposed, reps: target, text: `${fmt(proposed)} ${unit} × ${target}`, why: 'Deux séances sous l’objectif : on consolide.' } });
  }
  // Sinon : même charge, une répétition de plus sur les séries manquées
  const goal = target ? Math.min(target, Math.max(...L.reps, 0) + 1) : null;
  return out({ key: `prog:${pe.id}:keep`, type: 'keep', state: 'insuffisant', silent: true, title: `${pe.name} : même charge`, reason: target ? `Objectif ${pe.sets} × ${target} pas encore atteint (${L.reps.join('/')} le ${frDate(L.date)}). Même charge, vise ${goal} répétitions.` : 'Même charge.', evidence,
    today: { ...(lastW != null ? { weight: lastW } : {}), reps: goal || target, text: lastW != null ? `${fmt(lastW)} ${unit} × ${goal || target}` : `${goal || target} répétitions par série`, why: target ? `Même charge, vise ${goal} répétitions sur chaque série avant de monter.` : '' } });
}
