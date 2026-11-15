import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Loading, useApi } from '../components/ui.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';
import AnatomyMap from '../components/AnatomyMap.jsx';
import MuscleSheet from '../components/MuscleSheet.jsx';
import PainSheet from '../components/PainSheet.jsx';
import Overview from './body/Overview.jsx';
import MobilityTab from './body/Mobility.jsx';
import { MeasuresTab, NutritionTab, ReportTab } from './body/Tabs2.jsx';
import { MusclesTab, RecoveryTab, JointsTab, ProgressTab } from './body/Tabs.jsx';
import { onDataChange } from '../lib/api.js';


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
        {tab === 'nutrition' && <NutritionTab />}
        {tab === 'mensurations' && <MeasuresTab />}
        {tab === 'historique' && <ReportTab />}
      </div>}
      <MuscleSheet id={open?.id} side={open?.side} open={!!open} onClose={() => setOpen(null)} onChange={reload} />
      <PainSheet open={!!pain} init={pain} onClose={() => setPain(null)} onSaved={reload} />
    </Page>
  );
}

