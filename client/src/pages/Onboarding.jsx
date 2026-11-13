import { useEffect, useState } from 'react';
import { get, put, post, today } from '../lib/api.js';
import { Field, Icon, Loading, useToast } from '../components/ui.jsx';
import { AvailabilitySection, PreferencesSection, TrackingSection, pickProfile } from '../components/profileForm.jsx';
import { weekStart } from '../lib/format.js';

const STEPS = ['Bienvenue', 'Disponibilités', 'Préférences', 'Suivi'];

export default function Onboarding({ onDone }) {
  const [p, setP] = useState(null); const [days, setDays] = useState([]); const [step, setStep] = useState(0);
  const [plan, setPlan] = useState(true); const [busy, setBusy] = useState(false); const toast = useToast();
  useEffect(() => { Promise.all([get('/profile'), get('/program')]).then(([pr, prog]) => {
    setP({ ...pr, name: pr.name === 'Athlète' ? '' : pr.name, goal: pr.goal || 'hypertrophie', level: pr.level || 'intermediaire', cardio_goal: pr.cardio_goal || 'sante_cardio', cardio_level: pr.cardio_level || 'debutant' });
    setDays(prog.days);
  }); }, []);
  if (!p) return <Loading />;
  const set = (patch) => setP((x) => ({ ...x, ...patch }));
  const finish = async () => {
    setBusy(true);
    try {
      const saved = await put('/profile', { ...pickProfile(p), name: p.name || 'Athlète', onboarded: true });
      if (plan) { const r = await post('/calendar/plan', { from: weekStart(today()), weeks: 4 }); toast(`${r.created} jours planifiés dans le calendrier`); }
      onDone(saved);
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const last = step === STEPS.length - 1;
  return (
    <div className="onboarding fade-in">
      <div className="steps">{STEPS.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}</div>
      <div className="card">
        <p className="eyebrow">Étape {step + 1} / {STEPS.length} · {STEPS[step]}</p>
        {step === 0 && (<>
          <h1 className="hero-title">Bienvenue sur GymTrack</h1>
          <p className="muted">Ton programme 5 jours est déjà chargé. Quelques questions (1 minute), puis tu choisis ton objectif : l’appli te construit le programme, le cardio et la cure qui vont avec.</p>
          <Field label="Ton prénom"><input value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Prénom" autoFocus /></Field>
        </>)}
        {step === 1 && <AvailabilitySection p={p} set={set} days={days} />}
        {step === 2 && <PreferencesSection p={p} set={set} />}
        {step === 3 && (<>
          <TrackingSection p={p} set={set} />
          <label className="check"><input type="checkbox" checked={plan} onChange={(e) => setPlan(e.target.checked)} /> Planifier les 4 prochaines semaines dans le calendrier selon mon planning type</label>
        </>)}
        <div className="row-between mt">
          <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}><Icon name="left" size={16} />Retour</button>
          {last ? <button className="btn primary" disabled={busy} onClick={finish}>{busy ? 'Enregistrement…' : 'Choisir mon objectif'}<Icon name="check" size={16} /></button>
            : <button className="btn primary" onClick={() => setStep(step + 1)}>Suivant<Icon name="right" size={16} /></button>}
        </div>
      </div>
    </div>
  );
}
