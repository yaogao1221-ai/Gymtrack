import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, Page, Card, Icon, Loading, Ring, Sheet, Field, NumInput, useToast } from '../components/ui.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';
import BodyMap from '../components/BodyMap.jsx';
import BalanceCard from '../components/Balance.jsx';
import MissingMuscles from '../components/MissingMuscles.jsx';
import { TodayCard } from '../components/MuscleBrain.jsx';
import CoachCard from '../components/CoachCard.jsx';
import { BodyCard } from './Dashboard.jsx';
import { post, patch, today } from '../lib/api.js';
import { fmtDate, n0 } from '../lib/format.js';

// Mon corps : la carte du corps en premier, puis récupération, douleurs, poids et repas du jour
export default function BodyHome() {
  const map = useApi('/bodymap'); const bal = useApi('/bodymap/balance'); const brain = useApi('/muscles/state'); const d = useApi('/dashboard'); const pains = useApi('/pains');
  const [pain, setPain] = useState(null); const toast = useToast();
  const act = async (fn, msg) => { try { await fn(); toast(msg); map.reload(); pains.reload(); d.reload(); } catch (e) { toast(e.message, 'err'); } };
  const r = d.data?.recovery; const day = d.data?.day;
  const active = (pains.data?.reports || []).filter((p) => !p.resolved);
  return (
    <Page tabs={<SectionTabs group="body" />} title="Mon corps">
      <CoachCard section="body" />
      <section className="card bm-hero">{map.data ? <BodyMap data={map.data} balance={bal.data} state={brain.data} onChange={() => { brain.reload(); map.reload(); }} /> : <Loading />}</section>
      <TodayCard state={brain.data} onChange={brain.reload} />
      <BalanceCard data={bal.data} />
      <div id="oublies"><MissingMuscles onAdded={() => map.reload()} /></div>

      <div className="grid-2col">
        {r && <Card title="Récupération" icon="bolt" action={<Link className="link small" to="/progres?v=analyse">Analyse</Link>}>
          <div className="row gap"><Ring value={r.score / 100} size={72} stroke={9} label={r.score} grad={r.score >= 75 ? 'aqua' : r.score >= 55 ? 'fire' : 'violet'} />
            <div><b>{r.label}</b>{r.factors?.[0] && <p className="muted small">{r.factors[0].text}</p>}</div></div>
        </Card>}
        <Card title="Douleurs" icon="heal" action={<button className="btn xs" onClick={() => setPain({ area: 'epaule', intensity: 3, date: today(), notes: '' })}><Icon name="plus" size={14} />Signaler</button>}>
          {active.length ? <div className="pains">{active.map((p) => (
            <div key={p.id} className="pain-row"><span><b>{pains.data.areas[p.area]}</b> {p.intensity}/10 · {fmtDate(p.date, { day: 'numeric', month: 'short' })}</span>
              <Link className="btn xs" to={`/soins?zone=${p.area}`}>Que faire ?</Link>
              <button className="btn xs ghost" onClick={() => act(() => patch(`/pains/${p.id}`, { resolved: true }), 'Douleur marquée comme résolue')}>Résolue</button></div>
          ))}</div> : <p className="muted small">Aucune douleur signalée. Si une zone te gêne, signale-la : les hausses de charge s’arrêtent sur les exercices concernés et l’onglet Soins te guide.</p>}
        </Card>
      </div>

      {d.data && <BodyCard body={d.data.body} nutrition={d.data.nutrition} />}
      {day && <Link to="/nutrition" className="card row gap nut-today">
        <Icon name="food" size={20} />
        <span className="grow"><b>{n0(day.eaten_kcal || 0)}{day.kcal ? ` / ${n0(day.kcal)}` : ''} kcal aujourd’hui</b><span className="muted small">Noter un repas</span></span>
        <Icon name="right" size={16} />
      </Link>}

      <Sheet open={!!pain} onClose={() => setPain(null)} title="Signaler une douleur"
        footer={<button className="btn primary" onClick={() => act(async () => { await post('/pains', pain); setPain(null); }, 'Douleur enregistrée : pas de hausse de charge sur les exercices concernés')}>Enregistrer</button>}>
        {pain && <>
          <Field label="Zone"><select value={pain.area} onChange={(e) => setPain({ ...pain, area: e.target.value })}>{Object.entries(pains.data?.areas || {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label={`Intensité : ${pain.intensity}/10`}><input type="range" min="1" max="10" value={pain.intensity} onChange={(e) => setPain({ ...pain, intensity: Number(e.target.value) })} /></Field>
          <Field label="Notes"><textarea rows={2} value={pain.notes} onChange={(e) => setPain({ ...pain, notes: e.target.value })} /></Field>
        </>}
      </Sheet>
    </Page>
  );
}
