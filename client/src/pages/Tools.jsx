import { useState } from 'react';
import { Page, Card, Field, NumInput, Segmented, useApi } from '../components/ui.jsx';
import { platesFor } from '../components/ExercisePicker.jsx';
import { e1rm } from '../../../server/formulas.js';

const n = (v, d = 0) => (v == null || !Number.isFinite(v) ? '—' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d }));
// Pourcentage du 1RM selon répétitions et RIR (tableau de Helms / Zourdos, arrondi)
const PCT = { 1: 100, 2: 95.5, 3: 92.2, 4: 89.2, 5: 86.3, 6: 83.7, 7: 81.1, 8: 78.6, 9: 76.2, 10: 73.9, 11: 71.7, 12: 69.4 };

export default function Tools() {
  const prof = useApi('/profile');
  const [unit, setUnit] = useState('lbs');
  const [rm, setRm] = useState({ w: null, reps: 5, rir: 0 });
  const [hr, setHr] = useState({ age: null, rest: null });
  const [pl, setPl] = useState({ total: null, bar: null });
  const age = hr.age ?? (prof.data?.birth_year ? new Date().getFullYear() - prof.data.birth_year : null);
  // 1RM : moyenne Epley / Brzycki sur les répétitions « possibles » (reps faites + réserve)
  const rTot = Number(rm.reps || 0) + Number(rm.rir || 0);
  const oneRm = e1rm(rm.w, rTot); // même formule que les courbes « 1RM estimé » de Progrès
  const step = unit === 'kg' ? 2.5 : 5; const round = (x) => Math.round(x / step) * step;
  const hrMax = age ? 208 - 0.7 * age : null; // Tanaka 2001
  const zones = [['Z1 récupération', 0.5, 0.6], ['Z2 endurance (fond, perte de gras)', 0.6, 0.7], ['Z3 tempo', 0.7, 0.8], ['Z4 seuil', 0.8, 0.9], ['Z5 VO2max', 0.9, 1]];
  const z = (p) => (hrMax ? Math.round(hr.rest ? Number(hr.rest) + (hrMax - hr.rest) * p : hrMax * p) : null);
  const bar = pl.bar ?? (unit === 'kg' ? 20 : 45); const plates = pl.total ? platesFor(Number(pl.total), unit, Number(bar)) : null;
  return (
    <Page title="Calculateurs" subtitle="1RM, charges par répétitions, zones cardio, disques" back="/corps">
      <Segmented value={unit} onChange={setUnit} options={[['lbs', 'lbs'], ['kg', 'kg']]} />
      <Card title="1RM estimé et charges de travail" icon="dumbbell">
        <div className="grid3">
          <Field label={`Charge (${unit})`}><NumInput value={rm.w} onChange={(v) => setRm({ ...rm, w: v })} placeholder="135" /></Field>
          <Field label="Répétitions faites"><NumInput value={rm.reps} onChange={(v) => setRm({ ...rm, reps: v })} /></Field>
          <Field label="Réserve (RIR)" hint="Reps encore possibles"><NumInput value={rm.rir} onChange={(v) => setRm({ ...rm, rir: v })} /></Field>
        </div>
        {oneRm && <>
          <div className="kcal-target"><b>{n(round(oneRm))}</b><span>{unit} : 1RM estimé (Epley + Brzycki, Epley seul au-delà de 10 reps)</span></div>
          <table className="sets-table mt-s"><thead><tr><th>Reps</th><th>À l’échec</th><th>RIR 2</th></tr></thead>
            <tbody>{[1, 3, 5, 6, 8, 10, 12].map((r) => <tr key={r}><td>{r}</td><td className="mono">{n(round(oneRm * PCT[r] / 100))}</td><td className="mono">{PCT[r + 2] ? n(round(oneRm * PCT[r + 2] / 100)) : '—'}</td></tr>)}</tbody></table>
          <p className="muted small">Pour progresser en muscle, la plupart des séries entre 6 et 12 reps à 1 à 3 répétitions de l’échec suffisent (Refalo 2023).</p>
        </>}
      </Card>
      <Card title="Zones de fréquence cardiaque" icon="heart">
        <div className="grid3">
          <Field label="Âge"><NumInput value={age} onChange={(v) => setHr({ ...hr, age: v })} /></Field>
          <Field label="Pouls au repos" hint="Facultatif, plus précis"><NumInput value={hr.rest} onChange={(v) => setHr({ ...hr, rest: v })} placeholder="60" /></Field>
        </div>
        {hrMax && <>
          <p className="small">FC max estimée : <b>{Math.round(hrMax)}</b> bpm (Tanaka){hr.rest ? ', zones calculées avec la réserve cardiaque (Karvonen)' : ''}.</p>
          <ul className="zones">{zones.map(([l, a, b], i) => <li key={l} className={`z${i + 1}`}><span className="small">{l}</span><b className="mono small">{z(a)}–{z(b)}</b></li>)}</ul>
        </>}
      </Card>
      <Card title="Disques à charger" icon="target">
        <div className="grid3">
          <Field label={`Charge totale (${unit})`}><NumInput value={pl.total} onChange={(v) => setPl({ ...pl, total: v })} placeholder="225" /></Field>
          <Field label={`Barre (${unit})`}><NumInput value={bar} onChange={(v) => setPl({ ...pl, bar: v })} /></Field>
        </div>
        {plates && <p className="small">{plates.plates.length ? <>De chaque côté : <b>{plates.plates.map((x) => n(x, 2)).join(' + ')}</b></> : 'Barre seule'}{plates.rest ? ` (reste ${n(plates.rest, 2)} ${unit} non chargeable)` : ''}</p>}
        {pl.total && !plates && <p className="warn-text small">La charge est plus légère que la barre.</p>}
      </Card>
    </Page>
  );
}
