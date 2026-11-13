import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, Page, Card, Fold, Field, Loading, ErrorBox, NumInput, Icon, Segmented, useToast } from '../components/ui.jsx';
import { get, put, post } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';
import { Macros } from './Nutrition.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';

const f1 = (v) => (v == null ? '—' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }));
const f0 = (v) => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR'));
const DOW = [['mon', 'L'], ['tue', 'M'], ['wed', 'M'], ['thu', 'J'], ['fri', 'V'], ['sat', 'S'], ['sun', 'D']];
const MODES = [['auto', 'Auto'], ['seche', 'Sèche'], ['masse', 'Masse'], ['recompo', 'Recompo'], ['maintien', 'Maintien']];
const qs = (t) => new URLSearchParams(Object.entries(t).filter(([, v]) => v != null && v !== '' && v !== 'auto')).toString();

// Mon plan : l'appli calcule fréquence, calories, cure et réglages du programme à partir de l'objectif et de l'état actuel.
// Tout est proposé ; seuls les éléments cochés sont appliqués.
export default function Plan() {
  const toast = useToast();
  const { data: saved, error, reload } = useApi('/strategy');
  const [t, setT] = useState(null); const [s, setS] = useState(null); const [pick, setPick] = useState(null); const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => { if (saved && !t) { setT({ mode: saved.input.mode || 'auto', target_kg: saved.input.target_kg, target_bf: saved.input.target_bf, weeks: saved.input.weeks }); } if (saved) setS(saved); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  // Recalcul en direct quand l'objectif change (rien n'est enregistré tant qu'on n'applique pas)
  useEffect(() => {
    if (!t) return undefined;
    const id = ++seq.current;
    const h = setTimeout(() => { get(`/strategy?${qs(t)}`).then((r) => { if (id === seq.current) setS(r); }).catch((e) => toast(e.message, 'err')); }, 300);
    return () => clearTimeout(h);
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (s?.actions) setPick(new Set(s.actions.map((a) => a.key))); }, [s?.actions?.map((a) => a.key).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !saved) return <Page title="Mon plan"><ErrorBox error={error} retry={reload} /></Page>;
  if (!s || !t) return <Page title="Mon plan"><Loading /></Page>;
  const apply = async () => {
    setBusy(true);
    try {
      await put('/strategy/target', { ...t, mode: t.mode === 'auto' ? null : t.mode });
      const r = await post('/strategy/apply', { keys: [...pick] });
      setS(r.strategy);
      toast(`Appliqué : ${r.applied.map((k) => ({ cure: 'cure', adjust: 'ajustement', frequence: 'semaine type', cardio: 'objectif cardio', objectif: 'objectif de poids' }[k])).join(', ')}`);
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const n = s.nutrition;
  return (
    <Page tabs={<SectionTabs group="body" />} title="Mon plan">
      <Card title="Mon objectif" icon="target">
        <div className="seg-tight"><Segmented value={t.mode} onChange={(mode) => setT({ ...t, mode })} options={MODES} /></div>
        <div className="grid3 mt-s">
          <Field label="Poids visé (kg)"><NumInput value={t.target_kg} onChange={(v) => setT({ ...t, target_kg: v })} step={0.5} placeholder={s.state.kg ? f1(s.state.kg) : '80'} /></Field>
          <Field label="% de gras visé" hint={s.state.bf != null ? `actuel ≈ ${f1(s.state.bf)} %` : 'besoin taille + cou'}><NumInput value={t.target_bf} onChange={(v) => setT({ ...t, target_bf: v })} placeholder="15" /></Field>
          <Field label="En combien de semaines" hint="facultatif"><NumInput value={t.weeks} onChange={(v) => setT({ ...t, weeks: v })} placeholder="auto" /></Field>
        </div>
        <p className="muted small">Laisse vide ce que tu ne sais pas : « Auto » choisit la phase à partir de ton % de gras et de ta progression.</p>
      </Card>

      {!s.ready ? (
        <Card title="Il manque des infos" icon="info">
          <p className="small">Pour calculer ton plan : <b>{s.missing.join(', ') || 'une pesée'}</b>.</p>
          <Link className="btn sm primary" to="/nutrition?v=poids">Compléter dans Corps</Link>
        </Card>
      ) : (<>
        <section className="card plan-hero">
          <p className="eyebrow">Phase conseillée</p>
          <h2>{s.label}{s.weeks ? <span className="muted"> · {s.weeks} semaines</span> : null}</h2>
          {s.end_kg != null && <p className="small">Objectif ≈ <b>{f1(s.end_kg)} kg</b> le {fmtDate(s.end_date, { day: 'numeric', month: 'long' })} · {f1(s.rate_pct)} % du poids par semaine</p>}
          <ul className="why">{s.why.map((w) => <li key={w} className="small">{w}</li>)}</ul>
          {s.warnings.map((w) => <p key={w} className="tip warn"><Icon name="info" size={14} />{w}</p>)}
        </section>

        <div className="plan-tiles">
          <div className="t-fire"><b>{n.delta ? '≈ ' : ''}{f0(n.kcal)}</b><span>kcal par jour</span><small>{n.delta ? `${n.delta > 0 ? '+' : ''}${f0(n.delta)} vs maintien ≈ ${f0(n.tdee)}` : 'maintien'}</small></div>
          <div className="t-violet"><b>{s.frequency.sessions}</b><span>séances muscu / sem.</span><small>{s.frequency.current !== s.frequency.sessions ? `actuellement ${s.frequency.current}` : 'comme maintenant'}</small></div>
          <div className="t-aqua"><b>{s.cardio.min}</b><span>min de cardio / sem.</span><small>{f0(s.cardio.steps)} pas par jour</small></div>
          <div className="t-orange"><b>{n.protein_g} g</b><span>protéines par jour</span><small>{f1(n.protein_g / s.state.kg)} g/kg</small></div>
        </div>

        <Card title="Calories et macros" icon="flame">
          <Macros p={n} />
          <p className="small muted">Fibres ≈ {n.fiber_g} g · eau ≈ {f1(n.water_l)} L. {n.note}</p>
        </Card>

        <Card title="Entraînement" icon="dumbbell" action={<Link className="link" to="/programme">Programme</Link>}>
          <div className="wk-preview">{DOW.map(([k, l]) => <span key={k} className={s.frequency.schedule[k] !== 'rest' ? 'on' : ''}><b>{l}</b><small>{s.frequency.schedule[k] === 'rest' ? 'repos' : s.frequency.schedule[k]}</small></span>)}</div>
          <ul className="why">{s.frequency.why.map((w) => <li key={w} className="small">{w}</li>)}</ul>
          <p className="small"><b>Cardio :</b> {s.cardio.text}</p>
          <p className="small"><b>Programme :</b></p>
          <ul className="why">{s.program.map((w) => <li key={w} className="small">{w}</li>)}</ul>
        </Card>

        <Fold title="D’où partent ces chiffres" icon="chart">
          <ul className="plain-list">
            <li><span className="grow">Poids moyen sur 7 jours</span><span className="mono small">{f1(s.state.kg)} kg{s.state.trend_pct != null ? ` · ${s.state.trend_pct > 0 ? '+' : ''}${f1(s.state.trend_pct)} %/sem.` : ''}</span></li>
            <li><span className="grow">Masse grasse {s.state.bf_source === 'mesure' ? '(mesurée)' : '(estimée)'}</span><span className="mono small">{s.state.bf != null ? `≈ ${f1(s.state.bf)} %` : '—'}</span></li>
            <li><span className="grow">Charges sur 3 semaines</span><span className="mono small">{s.strength.pct != null ? `${s.strength.pct > 0 ? '+' : ''}${f1(s.strength.pct)} %` : 'pas encore assez de séances'}</span></li>
            <li><span className="grow">Séances faites par semaine</span><span className="mono small">{s.frequency.done_per_week != null ? f1(s.frequency.done_per_week) : '—'}</span></li>
            {s.waist && <li><span className="grow">Tour de taille sur 5 semaines</span><span className="mono small">{s.waist.change > 0 ? '+' : ''}{f1(s.waist.change)} cm</span></li>}
            <li><span className="grow">Récupération</span><span className="mono small">{s.frequency.recovery}/100</span></li>
          </ul>
          <p className="muted small">Le plan se recalcule à chaque pesée et chaque séance. Les calories sont des estimations : c’est la tendance de ta balance qui les valide.</p>
        </Fold>

        {s.current_plan && <p className="tip"><Icon name="info" size={14} />Cure en cours : {s.current_plan.label}, semaine {s.current_plan.week}/{s.current_plan.weeks} à {f0(s.current_plan.kcal)} kcal. {s.current_plan.check?.text}</p>}

        {s.actions.length > 0 ? (
          <Card title="Appliquer" icon="check">
            <ul className="apply-list">{s.actions.map((a) => (
              <li key={a.key}><label>
                <input type="checkbox" checked={!!pick?.has(a.key)} onChange={(e) => { const x = new Set(pick); if (e.target.checked) x.add(a.key); else x.delete(a.key); setPick(x); }} />
                <span><b className="small">{a.label}</b><span className="muted small">{a.detail}</span></span>
              </label></li>
            ))}</ul>
            <button className="btn primary block" disabled={busy || !pick?.size} onClick={apply}><Icon name="check" size={16} />Appliquer la sélection</button>
            <p className="muted small">Rien ne change sans ce bouton. Tes charges ne sont jamais modifiées ici.</p>
          </Card>
        ) : <p className="muted small center">Ton plan actuel correspond déjà à ces recommandations.</p>}
      </>)}
    </Page>
  );
}
