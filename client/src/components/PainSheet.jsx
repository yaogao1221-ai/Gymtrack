import { useEffect, useState } from 'react';
import { Sheet, Field, Segmented, Chips, useApi, useToast } from './ui.jsx';
import { post, today } from '../lib/api.js';

// Mouvements qui peuvent aggraver une douleur (choix rapides)
export const MOVES = ['Pousser (développés)', 'Tirer (tirages, tractions)', 'Bras au-dessus de la tête', 'Squat, flexion du genou', 'Se pencher en avant', 'Fentes, escaliers', 'Courir, sauter', 'Tourner le buste', 'Porter, serrer la main', 'Aussi au repos'];

// Signaler une douleur en quelques gestes : zone, côté, intensité, type, mouvements. Pas de diagnostic.
export default function PainSheet({ open, init, onClose, onSaved }) {
  const meta = useApi('/pains'); const toast = useToast(); const [p, setP] = useState(null);
  useEffect(() => { if (open) setP({ area: init?.area || 'epaule', side: init?.side || 'deux', intensity: 3, kind: '', movements: [], date: today(), notes: '' }); }, [open, init]);
  if (!open || !p) return null;
  const save = async () => {
    try { await post('/pains', { ...p, kind: p.kind || null }); toast('Douleur enregistrée : pas de hausse de charge sur les exercices concernés'); onSaved?.(); onClose(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Signaler une douleur" footer={<button className="btn primary" onClick={save}>Enregistrer</button>}>
      <Field label="Zone"><select value={p.area} onChange={(e) => setP({ ...p, area: e.target.value })}>{Object.entries(meta.data?.areas || {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Côté"><Segmented value={p.side} onChange={(v) => setP({ ...p, side: v })} options={[['gauche', 'Gauche'], ['droite', 'Droite'], ['deux', 'Les deux']]} /></Field>
      <Field label={`Intensité : ${p.intensity}/10`}><input type="range" min="1" max="10" value={p.intensity} onChange={(e) => setP({ ...p, intensity: Number(e.target.value) })} /></Field>
      <Field label="Ce que tu ressens (facultatif)"><Chips single value={p.kind} onChange={(v) => setP({ ...p, kind: v === p.kind ? '' : v })} options={Object.entries(meta.data?.kinds || {})} /></Field>
      <Field label="Ce qui la réveille (facultatif)"><Chips value={p.movements} onChange={(v) => setP({ ...p, movements: v })} options={MOVES.map((m) => [m, m])} /></Field>
      <Field label="Depuis le"><input type="date" value={p.date} max={today()} onChange={(e) => e.target.value && setP({ ...p, date: e.target.value })} /></Field>
      <Field label="Notes"><textarea rows={2} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} /></Field>
      <p className="muted xs">Une douleur n’est pas de la fatigue musculaire : elle est suivie à part. Douleur vive et soudaine, gonflement, fourmillements, perte de force ou douleur qui réveille la nuit : arrête l’exercice et consulte un médecin ou un kinésithérapeute.</p>
    </Sheet>
  );
}
