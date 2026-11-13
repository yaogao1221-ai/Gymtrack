import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Card, Chips, Segmented, Field, NumInput, Icon, Loading, Confirm, useToast } from '../components/ui.jsx';
import { get, post } from '../lib/api.js';

const OBJ = [
  ['perte_de_gras', 'Perdre du gras', 'flame'], ['hypertrophie', 'Prendre du muscle', 'dumbbell'], ['force', 'Gagner en force', 'trophy'],
  ['recomposition', 'Recomposition', 'body'], ['endurance', 'Endurance / cardio', 'heart'], ['sante', 'Forme et santé', 'heal'],
];
const TYPES = [['muscu', 'Muscu'], ['mixte', 'Muscu + cardio'], ['cardio', 'Cardio']];
const LEVELS = [['debutant', 'Débutant'], ['intermediaire', 'Intermédiaire'], ['avance', 'Avancé']];
const ACTS = [['marche_inclinee', 'Marche inclinée'], ['velo', 'Vélo'], ['course', 'Course'], ['elliptique', 'Elliptique'], ['rameur', 'Rameur'], ['marche', 'Marche']];
const DOW = [['mon', 'L'], ['tue', 'M'], ['wed', 'M'], ['thu', 'J'], ['fri', 'V'], ['sat', 'S'], ['sun', 'D']];
const DEF_TYPE = { perte_de_gras: 'mixte', hypertrophie: 'muscu', force: 'muscu', recomposition: 'mixte', endurance: 'cardio', sante: 'mixte' };
const rest = (s) => (s >= 120 ? `${s / 60} min` : `${s} s`);

// Créateur de programme : objectif → programme (muscu, cardio ou les deux), cure et objectifs. Un seul endroit pour tout régler.
export default function Builder() {
  const nav = useNavigate(); const toast = useToast();
  const [f, setF] = useState(null); const [plan, setPlan] = useState(null); const [opts, setOpts] = useState({ cure: true, goals: true });
  const [mine, setMine] = useState(null); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(null); const [own, setOwn] = useState({ days: 4, name: '' });
  const seq = useRef(0);
  useEffect(() => {
    Promise.all([get('/profile'), get('/programs')]).then(([p, progs]) => {
      const goal = p.goal || 'hypertrophie';
      setF({ objective: goal, type: DEF_TYPE[goal] || 'muscu', days: Math.min(6, Math.max(2, p.sessions_per_week || 3)), level: p.level || 'intermediaire', minutes: [45, 60, 75, 90].includes(p.session_minutes) ? p.session_minutes : 60, activity: (p.cardio_preferred || [])[0] || 'marche_inclinee', target_kg: null });
      setMine(progs.programs || []);
    }).catch((e) => toast(e.message, 'err'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!f) return undefined;
    const id = ++seq.current;
    const h = setTimeout(() => post('/builder/preview', f).then((r) => { if (id === seq.current) setPlan(r); }).catch((e) => toast(e.message, 'err')), 200);
    return () => clearTimeout(h);
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) return <Page title="Créer mon programme" back={() => nav('/programme')}><Loading /></Page>;
  const set = (x) => setF({ ...f, ...x });
  const create = async (body, msg) => {
    setBusy(true);
    try { const r = await post('/builder/apply', body); toast(`${msg}${r.applied.includes('cure') ? ', cure démarrée' : ''}`); nav('/programme', { replace: true }); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); setAsk(null); }
  };
  const activate = async (p) => { try { await post(`/programs/${p.id}/activate`); toast(`${p.name} réactivé`); nav('/programme', { replace: true }); } catch (e) { toast(e.message, 'err'); } };
  const showWeight = ['perte_de_gras', 'hypertrophie', 'recomposition'].includes(f.objective);

  return (
    <Page title="Créer mon programme" back={() => nav('/programme')}>
      <section className="bd-step">
        <p className="bd-num">1</p><h2>Ton objectif</h2>
        <div className="obj-grid">{OBJ.map(([k, l, ic]) => (
          <button key={k} className={`obj-card ${f.objective === k ? 'on' : ''}`} onClick={() => set({ objective: k, type: DEF_TYPE[k] })}><Icon name={ic} size={22} /><span>{l}</span></button>
        ))}</div>
      </section>

      <section className="bd-step">
        <p className="bd-num">2</p><h2>Ton programme</h2>
        <Field label="Type"><Segmented value={f.type} onChange={(type) => set({ type })} options={TYPES} /></Field>
        <Field label="Séances par semaine"><Chips single value={f.days} onChange={(days) => set({ days })} options={[1, 2, 3, 4, 5, 6].map((n) => [n, String(n)])} /></Field>
        <Field label="Niveau"><Segmented value={f.level} onChange={(level) => set({ level })} options={LEVELS} /></Field>
        {f.type !== 'cardio' && <Field label="Temps par séance"><Chips single value={f.minutes} onChange={(minutes) => set({ minutes })} options={[[45, '45 min'], [60, '1 h'], [75, '1 h 15'], [90, '1 h 30']]} /></Field>}
        {f.type !== 'muscu' && <Field label="Cardio préféré"><Chips single value={f.activity} onChange={(activity) => set({ activity })} options={ACTS} /></Field>}
        {showWeight && <Field label="Poids visé (kg)" hint="facultatif, sert à la durée de la cure"><NumInput value={f.target_kg} onChange={(target_kg) => set({ target_kg })} step={0.5} placeholder="auto" /></Field>}
      </section>

      {!plan ? <Loading /> : (<>
        <section className="bd-step">
          <p className="bd-num">3</p><h2>Ce que je te propose</h2>
          <div className="bd-tiles">
            {plan.sessions.muscu > 0 && <div className="t-orange"><b>{plan.sessions.muscu}</b><span>muscu / sem.</span></div>}
            {plan.cardio_week > 0 && <div className="t-aqua"><b>{plan.cardio_week}</b><span>min cardio / sem.</span></div>}
            {plan.cure.ready && <div className="t-fire"><b>{plan.cure.kcal.toLocaleString('fr-FR')}</b><span>kcal / jour</span></div>}
            {plan.cure.ready && <div className="t-violet"><b>{plan.cure.protein_g} g</b><span>protéines / jour</span></div>}
          </div>
          <div className="wk-strip">{DOW.map(([k, l]) => {
            const c = plan.schedule[k]; const d = plan.days.find((x) => x.code === c);
            const kind = !d ? 'rest' : d.exercises.length ? 'muscu' : 'cardio';
            return <span key={k} className={`wk-d ${kind}`}><b>{l}</b><small>{!d ? 'repos' : d.exercises.length ? d.name.replace(/^(Full body|Haut|Bas) /, (m) => m) : 'cardio'}</small></span>;
          })}</div>
          <div className="bd-days">{plan.days.map((d) => (
            <details key={d.code} className="bd-day">
              <summary><span className={`bd-dot ${d.exercises.length ? 'muscu' : 'cardio'}`} /><b>{d.name}</b><span className="muted small">{d.exercises.length ? `${d.exercises.length} exercices` : ''}{d.exercises.length && d.cardio.length ? ' + ' : ''}{d.cardio.length ? `${d.cardio.reduce((a, c) => a + c.duration_min, 0)} min cardio` : ''}</span><Icon name="down" size={16} /></summary>
              <ul>
                {d.exercises.map((e) => <li key={e.slug}><span className="grow">{e.name}</span><span className="mono small">{e.sets} × {e.reps}</span><span className="muted xs">{rest(e.rest)}</span></li>)}
                {d.cardio.map((c, i) => <li key={`c${i}`} className="cardio"><Icon name="heart" size={14} /><span className="grow">{c.label}{c.notes ? <small className="muted"> · {c.notes}</small> : null}</span><span className="mono small">{c.duration_min} min</span></li>)}
              </ul>
            </details>
          ))}</div>
        </section>

        <Card title="Pourquoi ce programme" icon="info">
          <ul className="why">{plan.why.map((w) => <li key={w} className="small">{w}</li>)}</ul>
          <p className="muted xs">Les charges se règlent à ta première séance : l’appli te proposera ensuite la progression, que tu valides.</p>
        </Card>

        <Card title="Ça va avec" icon="target">
          <label className="check-row"><input type="checkbox" checked={opts.goals} onChange={(e) => setOpts({ ...opts, goals: e.target.checked })} />
            <span><b className="small">Objectifs</b><span className="muted small">{plan.goals.slice(0, 2).join(' · ')}</span></span></label>
          {plan.cure.ready ? (plan.cure.mode !== 'maintien' ? (
            <label className="check-row"><input type="checkbox" checked={opts.cure} onChange={(e) => setOpts({ ...opts, cure: e.target.checked })} />
              <span><b className="small">Cure : {plan.cure.label} de {plan.cure.weeks} semaines</b><span className="muted small">≈ {plan.cure.kcal.toLocaleString('fr-FR')} kcal et {plan.cure.protein_g} g de protéines par jour{plan.cure.end_kg ? `, vers ${String(plan.cure.end_kg).replace('.', ',')} kg` : ''}{plan.cure.current ? `. Remplace ta cure actuelle (${plan.cure.current})` : ''}</span></span></label>
          ) : <p className="muted small">Calories : maintien (≈ {plan.cure.kcal.toLocaleString('fr-FR')} kcal par jour), pas de cure à lancer.</p>)
            : <p className="muted small">Pour calculer les calories de la cure, il manque : {plan.cure.missing.join(', ') || 'une pesée'} (Corps &gt; Nutrition &gt; Poids et cure).</p>}
        </Card>

        <button className="btn primary block lg" disabled={busy} onClick={() => setAsk({ ...f, ...opts })}><Icon name="check" size={18} />Créer ce programme</button>
        <p className="muted xs center">Ton programme actuel reste enregistré : tu peux le réactiver plus bas.</p>
      </>)}

      <Card title="Ou compose le tien" icon="edit" className="mt">
        <div className="grid2">
          <Field label="Nom"><input value={own.name} placeholder="Mon programme" onChange={(e) => setOwn({ ...own, name: e.target.value })} /></Field>
          <Field label="Jours"><Chips single value={own.days} onChange={(days) => setOwn({ ...own, days })} options={[2, 3, 4, 5, 6].map((n) => [n, String(n)])} /></Field>
        </div>
        <button className="btn block" disabled={busy} onClick={() => setAsk({ custom: true, ...own })}>Créer un programme vide</button>
        <p className="muted small">Tu ajoutes ensuite tes exercices et ton cardio jour par jour (Programme &gt; Modifier).</p>
      </Card>

      {mine?.length > 1 && <Card title="Mes programmes" icon="dumbbell">
        <ul className="plain-list">{mine.map((p) => (
          <li key={p.id}><span className="grow"><b className="small">{p.name}</b><span className="muted xs"> · {p.days} jours</span></span>
            {p.active ? <span className="tag ok">Actuel</span> : <button className="btn xs" onClick={() => activate(p)}>Réactiver</button>}</li>
        ))}</ul>
      </Card>}

      <Confirm open={!!ask} onClose={() => setAsk(null)} title={ask?.custom ? 'Créer un programme vide ?' : 'Créer ce programme ?'} confirmLabel="Créer"
        text="Il devient ton programme actif : la semaine type et le calendrier à venir sont mis à jour. Tes séances passées et ton ancien programme sont gardés."
        onConfirm={() => create(ask, ask.custom ? 'Programme créé, ajoute tes exercices' : 'Programme créé')} />
    </Page>
  );
}
