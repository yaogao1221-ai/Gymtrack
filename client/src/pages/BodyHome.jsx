import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page, Card, Icon, Loading, EmbedCtx, useApi } from '../components/ui.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';
import AnatomyMap from '../components/AnatomyMap.jsx';
import MuscleSheet from '../components/MuscleSheet.jsx';
import PainSheet from '../components/PainSheet.jsx';
import { MobilityDone } from '../components/MuscleBrain.jsx';
import { Thumbs } from '../components/BodyMap.jsx';
import { ExerciseInfo } from '../components/ExerciseDemo.jsx';
import Overview from './body/Overview.jsx';
import { MusclesTab, RecoveryTab, JointsTab, ProgressTab } from './body/Tabs.jsx';
import { loadLib } from '../lib/exlib.js';
import { onDataChange, today } from '../lib/api.js';
import { ROUTINES } from '../data/rehab.js';

const Meals = lazy(() => import('./Meals.jsx'));
const Photos = lazy(() => import('./Photos.jsx'));
const Recap = lazy(() => import('./Recap.jsx'));

// Mon corps : 10 sections en onglets, toutes nourries par le même état musculaire (GET /body/state)
export const BODY_TABS = [['apercu', 'Vue générale'], ['anatomie', 'Anatomie'], ['muscles', 'Muscles'], ['recuperation', 'Récupération'], ['articulations', 'Articulations'],
  ['mobilite', 'Mobilité'], ['progression', 'Progression'], ['nutrition', 'Nutrition'], ['mensurations', 'Mensurations'], ['historique', 'Historique']];

export default function BodyHome() {
  const [sp, setSp] = useSearchParams(); const tab = BODY_TABS.find(([k]) => k === sp.get('v'))?.[0] || (typeof location !== 'undefined' && location.hash.includes('oublies') ? 'muscles' : 'apercu');
  const [st, setSt] = useState(null); const [open, setOpen] = useState(null); const [pain, setPain] = useState(null);
  const h = new Date().getHours();
  const { data, reload } = useApi(`/body/state?h=${h}`);
  useEffect(() => { if (data) setSt(data); }, [data]);
  useEffect(() => onDataChange((p) => { if (/^\/(workouts|soreness|pains|body|cardio)/.test(p)) reload(); }), [reload]);
  const go = (k) => { setSp(k === 'apercu' ? {} : { v: k }, { replace: true }); window.scrollTo({ top: 0 }); };
  const openMuscle = (id, side) => setOpen({ id, side });
  const openPain = (area, side) => setPain({ area, side });
  return (
    <Page tabs={<SectionTabs group="body" />} title="Mon corps">
      <div className="chips scroll hub-chips body-tabs" role="tablist">{BODY_TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => go(k)}>{l}</button>)}</div>
      {!st ? <Loading /> : <div className="fade-in" key={tab}>
        {tab === 'apercu' && <Overview st={st} onOpen={openMuscle} onPain={() => openPain()} />}
        {tab === 'anatomie' && <section className="card"><AnatomyMap state={st} onOpen={openMuscle} onPain={openPain} />
          <p className="muted xs mt-s">Planche anatomique en 2D (dessin vectoriel original), face, dos et profils. Les muscles profonds (rhomboïdes, oblique interne, transverse) sont dans l’onglet Muscles.</p></section>}
        {tab === 'muscles' && <MusclesTab st={st} onOpen={openMuscle} onChange={reload} />}
        {tab === 'recuperation' && <RecoveryTab st={st} onOpen={openMuscle} onChange={reload} />}
        {tab === 'articulations' && <JointsTab onPain={() => openPain()} />}
        {tab === 'mobilite' && <MobilityTab />}
        {tab === 'progression' && <ProgressTab st={st} onOpen={openMuscle} />}
        {tab === 'nutrition' && <Embedded link="/nutrition" label="Poids, cure et Ramadan"><Meals /></Embedded>}
        {tab === 'mensurations' && <Embedded link="/nutrition?v=poids" label="Pesées et tours de taille"><Photos /></Embedded>}
        {tab === 'historique' && <Embedded link="/progres?v=bilan" label="Bilan de la semaine"><Recap /></Embedded>}
      </div>}
      <MuscleSheet id={open?.id} side={open?.side} open={!!open} onClose={() => setOpen(null)} onChange={reload} />
      <PainSheet open={!!pain} init={pain} onClose={() => setPain(null)} onSaved={reload} />
    </Page>
  );
}

function Embedded({ children, link, label }) {
  return (<>
    <EmbedCtx.Provider value><Suspense fallback={<Loading />}>{children}</Suspense></EmbedCtx.Provider>
    <Link to={link} className="card row gap embed-more"><span className="grow small">{label}</span><Icon name="right" size={16} /></Link>
  </>);
}

// Mobilité et échauffements : la routine conseillée aujourd'hui puis toutes les routines, chacune cochable
function MobilityTab() {
  const brain = useApi('/muscles/state'); const mob = useApi('/mobility'); const [lib, setLib] = useState(null); const [info, setInfo] = useState(null);
  useEffect(() => { loadLib().then(setLib).catch(() => setLib([])); }, []);
  const byId = useMemo(() => new Map((lib || []).map((x) => [x.id, x])), [lib]);
  const rec = brain.data?.today_plan?.mobility;
  const done = (k) => (mob.data || []).some((x) => x.routine === k && x.date === today());
  return (<>
    {rec && <Card title="Conseillée aujourd’hui" icon="sparkles"><p><b>{rec.title}</b></p><p className="muted small">{rec.why}</p>
      {rec.routine.startsWith('soin:') && <Link className="btn sm mt-s" to={`/soins?zone=${rec.area}`}>Ouvrir le soin</Link>}</Card>}
    {ROUTINES.map((r) => (
      <Card key={r.key} title={r.t} icon="heal" action={<MobilityDone routine={r.key} done={done(r.key)} onDone={mob.reload} />}>
        <p className="muted small">{r.d} · 5 à 8 min</p>
        {lib ? <Thumbs list={r.ex.map(([id]) => byId.get(id)).filter(Boolean)} doses={r.ex.filter(([id]) => byId.has(id)).map(([, d]) => d)} onOpen={setInfo} /> : <Loading />}
      </Card>))}
    <Link to="/soins" className="card row gap embed-more"><span className="grow small">Protocoles de soin par zone (épaule, genou, bas du dos…)</span><Icon name="right" size={16} /></Link>
    <ExerciseInfo open={!!info} x={info} onClose={() => setInfo(null)} />
  </>);
}
