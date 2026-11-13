import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page, Card, Icon, Loading, Fold, Sheet, Field, useApi, useToast } from '../components/ui.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';
import { ExerciseInfo } from '../components/ExerciseDemo.jsx';
import { Thumbs } from '../components/BodyMap.jsx';
import CoachCard from '../components/CoachCard.jsx';
import { loadLib } from '../lib/exlib.js';
import { post, patch, today } from '../lib/api.js';
import { AREAS, PRINCIPLES, RED_FLAGS_ALL, ROUTINES } from '../data/rehab.js';

const PH = ['Calmer', 'Recharger', 'Reprendre'];

// Soins : douleurs suivies jour après jour (phase, évolution, exercices du programme à adapter),
// protocoles par zone et routines de mobilité. Repères de kiné du sport, pas un diagnostic.
export default function Care() {
  const [params, setParams] = useSearchParams(); const zone = params.get('zone') || '';
  const [lib, setLib] = useState(null); const [info, setInfo] = useState(null); const [report, setReport] = useState(null);
  const brief = useApi('/coach/brief'); const toast = useToast();
  useEffect(() => { loadLib().then(setLib).catch(() => setLib([])); }, []);
  const byId = useMemo(() => new Map((lib || []).map((x) => [x.id, x])), [lib]);
  const list = (ex) => ex.map(([id]) => byId.get(id)).filter(Boolean);
  const doses = (ex) => ex.filter(([id]) => byId.has(id)).map(([, d]) => d);
  const pains = brief.data?.pains || [];
  const a = AREAS[zone]; const pz = pains.find((p) => p.area === zone);
  const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); brief.reload(); } catch (e) { toast(e.message, 'err'); } };
  // Routine conseillée : celle qui prépare la prochaine séance
  const nextLower = /jambe|leg|squat|fessier|ischio|quadri/i.test(brief.data?.program?.headline || '');
  const rec = nextLower ? 'bas' : 'haut';
  return (
    <Page tabs={<SectionTabs group="body" />} title="Soins et mobilité">
      <CoachCard section="care" />

      <section className="card pains">
        <div className="card-head"><h2><Icon name="heal" size={16} />Mes douleurs</h2><button className="btn xs" onClick={() => setReport({ area: zone && AREAS[zone] ? zone : '', intensity: 3 })}><Icon name="plus" size={14} />Signaler</button></div>
        {!pains.length ? <p className="muted small">Aucune douleur suivie. Si quelque chose tire, signale-le : le programme, le briefing et le coach s’adaptent tout de suite.</p>
          : <ul className="pain-list">{pains.map((p) => (
            <li key={p.id}>
              <div className="pain-top">
                <button className="grow pain-name" onClick={() => setParams({ zone: p.area })}><b>{p.label}</b><span className="muted small">jour {p.days}{p.trend < 0 ? ` · en baisse (${p.first} → ${p.intensity})` : p.trend > 0 ? ` · en hausse (${p.first} → ${p.intensity})` : ''}</span></button>
                <span className={`pain-int i${Math.min(3, Math.ceil(p.intensity / 3.4))}`}>{p.intensity}/10</span>
              </div>
              <div className="phase-bar">{PH.map((t, i) => <span key={t} className={i < p.phase ? 'past' : i === p.phase ? 'on' : ''}>{t}</span>)}</div>
              {p.next_affected.length > 0 && <p className="small"><Icon name="dumbbell" size={13} /> Prochaine séance : {p.next_affected.join(', ')} à adapter.</p>}
              <p className="small muted mt-s">{p.checked_today ? 'Noté pour aujourd’hui. Tu peux corriger :' : 'Aujourd’hui, ça fait combien ?'}</p>
              <div className="int-row">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <button key={n} className={`int ${n === p.intensity && p.checked_today ? 'on' : ''}`} onClick={() => run(() => patch(`/pains/${p.id}`, { intensity: n }), n < p.intensity ? 'Ça s’améliore, continue comme ça' : 'Noté')}>{n}</button>)}</div>
              <div className="row gap-s mt-s">
                <button className="btn xs primary" onClick={() => setParams({ zone: p.area })}>Mon protocole</button>
                <button className="btn xs ghost" onClick={() => run(() => patch(`/pains/${p.id}`, { resolved: true }), 'Guéri : les exercices reprennent leur progression normale')}><Icon name="check" size={13} />Guéri</button>
              </div>
            </li>))}</ul>}
      </section>

      <div className="chips scroll">
        <button className={`chip ${!zone ? 'on' : ''}`} onClick={() => setParams({})}>Mobilité</button>
        {Object.entries(AREAS).map(([k, x]) => <button key={k} className={`chip ${zone === k ? 'on' : ''} ${pains.some((p) => p.area === k) ? 'warn' : ''}`} onClick={() => setParams({ zone: k })}>{x.label}</button>)}
      </div>

      {!lib ? <Loading /> : !a ? (<>
        {[...ROUTINES].sort((x, y) => (y.key === rec) - (x.key === rec)).map((r) => (
          <Card key={r.key} title={r.t} icon="body" className={r.key === rec ? 'rec' : ''}>
            {r.key === rec && <span className="tag good">Conseillée avant ta prochaine séance</span>}
            <p className="muted small">{r.d} · 5 à 8 min. Touche un exercice pour voir la démo.</p>
            <Thumbs list={list(r.ex)} doses={doses(r.ex)} onOpen={setInfo} />
          </Card>
        ))}
        <Fold title="Les principes qui font guérir plus vite">
          <ul className="care-list">{PRINCIPLES.map((p) => <li key={p.t}><b>{p.t}</b><p className="small">{p.d}</p>{p.src && <p className="muted xs">{p.src}</p>}</li>)}</ul>
        </Fold>
      </>) : (<>
        <Card title={`Douleur : ${a.label.toLowerCase()}`} icon="heal">
          <p className="small">{a.common}</p>
          {!pz && <button className="btn sm mt-s" onClick={() => setReport({ area: zone, intensity: 3 })}><Icon name="plus" size={14} />J’ai mal ici : suivre cette douleur</button>}
        </Card>
        <Card title="Dans ton programme" icon="dumbbell">
          <p className="small"><b>À adapter :</b> {a.adapt}</p>
          {pz?.affected.length > 0 && <><p className="small mt-s">Exercices concernés chez toi, marqués « à adapter » dans Programme et dans la séance, sans hausse de charge :</p><div className="db-mus">{pz.affected.map((n) => <span key={n}>{n}</span>)}</div></>}
          {pz && !pz.affected.length && <p className="small muted mt-s">Aucun exercice de ton programme n’est concerné.</p>}
          <Link className="link small" to="/programme">Ouvrir mon programme <Icon name="right" size={12} /></Link>
        </Card>
        {a.phases.map((ph, i) => {
          const cur = pz ? pz.phase === i : i === 0;
          const body = <><p className="small">{ph.d}</p>{ph.ex.length > 0 && <Thumbs list={list(ph.ex)} doses={doses(ph.ex)} onOpen={setInfo} />}</>;
          return cur ? <Card key={ph.t} title={ph.t} className="phase-cur">{pz && <span className="tag good">Tu es ici · jour {pz.days}</span>}{body}</Card>
            : <Fold key={ph.t} title={ph.t} hint={pz && i < pz.phase ? 'faite' : 'plus tard'}>{body}</Fold>;
        })}
        <Card title="Consulte un médecin ou un kiné si" icon="alert">
          <ul className="care-flags">{[...a.flags, ...RED_FLAGS_ALL].map((f) => <li key={f} className="small">{f}</li>)}</ul>
        </Card>
        <p className="muted xs">Repères tirés des recommandations de kinésithérapie du sport. Ils ne remplacent pas un examen : une douleur qui dure mérite un avis professionnel.</p>
      </>)}

      <Sheet open={!!report} onClose={() => setReport(null)} title="Signaler une douleur"
        footer={<button className="btn primary block" disabled={!report?.area} onClick={() => run(async () => { await post('/pains', { date: today(), area: report.area, intensity: report.intensity }); setParams({ zone: report.area }); setReport(null); }, 'Douleur suivie : programme et séances adaptés')}>Suivre cette douleur</button>}>
        {report && <>
          <Field label="Où ?"><div className="chips">{Object.entries(AREAS).map(([k, x]) => <button key={k} type="button" className={`chip ${report.area === k ? 'on' : ''}`} onClick={() => setReport({ ...report, area: k })}>{x.label}</button>)}</div></Field>
          <Field label={`Intensité : ${report.intensity}/10`} hint="0 = rien, 10 = insupportable. Au-delà de 6, ou après un choc, consulte."><input type="range" min="1" max="10" value={report.intensity} onChange={(e) => setReport({ ...report, intensity: Number(e.target.value) })} /></Field>
        </>}
      </Sheet>
      <ExerciseInfo open={!!info} x={info} onClose={() => setInfo(null)} />
    </Page>
  );
}
