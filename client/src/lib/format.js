export const DAYS = [['mon', 'Lun'], ['tue', 'Mar'], ['wed', 'Mer'], ['thu', 'Jeu'], ['fri', 'Ven'], ['sat', 'Sam'], ['sun', 'Dim']];
export const DAY_LONG = { mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche' };
export const CARDIO = {
  marche: 'Marche', marche_inclinee: 'Marche inclinée', course: 'Course', velo: 'Vélo', elliptique: 'Elliptique', rameur: 'Rameur', autre: 'Autre',
};
export const CARDIO_ICON = { marche: 'MA', marche_inclinee: 'MI', course: 'CO', velo: 'VÉ', elliptique: 'EL', rameur: 'RA', autre: '··' };
export const GOALS = { hypertrophie: 'Prise de muscle', force: 'Force', perte_de_gras: 'Perte de gras', recomposition: 'Recomposition', endurance: 'Endurance / cardio', sante: 'Santé / forme' };
export const LEVELS = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
export const CARDIO_GOALS = { perte_de_poids: 'Perte de poids', endurance: 'Endurance', sante_cardio: 'Santé cardio', recuperation: 'Récupération active' };

const parse = (d) => new Date(d + 'T12:00:00');
export const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => (d ? parse(d).toLocaleDateString('fr-FR', opts) : '');
export const fmtDay = (d) => fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
export const addDays = (d, n) => { const x = parse(d); x.setDate(x.getDate() + n); return iso(x); };
export const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
export const weekStart = (d) => { const x = parse(d); const wd = x.getDay(); return addDays(d, wd === 0 ? -6 : 1 - wd); };
export const dayKey = (d) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][parse(d).getDay()];
export const relDay = (d, today) => {
  const n = Math.round((parse(d) - parse(today)) / 86400000);
  if (n === 0) return "aujourd'hui"; if (n === 1) return 'demain'; if (n === -1) return 'hier';
  return n > 0 ? `dans ${n} j` : `il y a ${-n} j`;
};
export const dur = (sec) => { const m = Math.round((sec || 0) / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };
export const mins = (m) => dur((m || 0) * 60);
export const clock = (sec) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const n0 = (v) => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR'));
export const n1 = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('fr-FR'));
export function weightLabel(pe) {
  if (pe.target_weight == null) return pe.kind === 'bodyweight' ? 'Poids du corps' : 'Charge à définir';
  const w = pe.target_weight_max ? `${pe.target_weight}–${pe.target_weight_max}` : pe.target_weight;
  return `${w} ${pe.weight_unit}${pe.weight_note ? ` ${pe.weight_note}` : ''}`;
}
export const repsLabel = (pe) => `${pe.sets} × ${pe.reps ?? '?'}${pe.reps_note ? ` ${pe.reps_note}` : ''}`;
