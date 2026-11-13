import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Card, Icon, Loading, Fold, useApi } from '../components/ui.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';
import { ExerciseInfo } from '../components/ExerciseDemo.jsx';
import { Thumbs } from '../components/BodyMap.jsx';
import { loadLib } from '../lib/exlib.js';
import { AREAS, PRINCIPLES, RED_FLAGS_ALL, ROUTINES } from '../data/rehab.js';

// Soins : routines de mobilité et conduite à tenir par zone douloureuse (repères de kiné du sport, pas un diagnostic)
export default function Care() {
  const [params, setParams] = useSearchParams(); const zone = params.get('zone') || '';
  const [lib, setLib] = useState(null); const [info, setInfo] = useState(null);
  const pains = useApi('/pains');
  useEffect(() => { loadLib().then(setLib).catch(() => setLib([])); }, []);
  const byId = useMemo(() => new Map((lib || []).map((x) => [x.id, x])), [lib]);
  const list = (ex) => ex.map(([id]) => byId.get(id)).filter(Boolean);
  const doses = (ex) => ex.filter(([id]) => byId.has(id)).map(([, d]) => d);
  const active = (pains.data?.reports || []).filter((p) => !p.resolved);
  const a = AREAS[zone];
  return (
    <Page tabs={<SectionTabs group="body" />} title="Soins et mobilité">
      <div className="chips scroll">
        <button className={`chip ${!zone ? 'on' : ''}`} onClick={() => setParams({})}>Mobilité</button>
        {Object.entries(AREAS).map(([k, x]) => <button key={k} className={`chip ${zone === k ? 'on' : ''} ${active.some((p) => p.area === k) ? 'warn' : ''}`} onClick={() => setParams({ zone: k })}>{x.label}</button>)}
      </div>
      {!lib ? <Loading /> : !a ? (<>
        <p className="muted small mt-s">5 à 8 minutes. Touche un exercice pour voir la démo.</p>
        {ROUTINES.map((r) => (
          <Card key={r.key} title={r.t} icon="body"><p className="muted small">{r.d}</p><Thumbs list={list(r.ex)} doses={doses(r.ex)} onOpen={setInfo} /></Card>
        ))}
        <Fold title="Les principes qui font guérir plus vite">
          <ul className="care-list">{PRINCIPLES.map((p) => <li key={p.t}><b>{p.t}</b><p className="small">{p.d}</p>{p.src && <p className="muted xs">{p.src}</p>}</li>)}</ul>
        </Fold>
      </>) : (<>
        <Card title={`Douleur : ${a.label.toLowerCase()}`} icon="heal">
          <p className="small">{a.common}</p>
          <p className="tip mt-s"><Icon name="dumbbell" size={14} /><span><b>À la salle :</b> {a.adapt}</span></p>
        </Card>
        {a.phases.map((ph) => (
          <Card key={ph.t} title={ph.t}>
            <p className="small">{ph.d}</p>
            {ph.ex.length > 0 && <Thumbs list={list(ph.ex)} doses={doses(ph.ex)} onOpen={setInfo} />}
          </Card>
        ))}
        <Card title="Consulte un médecin ou un kiné si" icon="alert">
          <ul className="care-flags">{[...a.flags, ...RED_FLAGS_ALL].map((f) => <li key={f} className="small">{f}</li>)}</ul>
        </Card>
        <p className="muted xs">Repères tirés des recommandations de kinésithérapie du sport. Ils ne remplacent pas un examen : une douleur qui dure mérite un avis professionnel.</p>
      </>)}
      <ExerciseInfo open={!!info} x={info} onClose={() => setInfo(null)} />
    </Page>
  );
}
