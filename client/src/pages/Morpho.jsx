import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, Page, Card, Icon, Segmented, Loading, useToast } from '../components/ui.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';
import { ExThumb } from '../components/MoveFigure.jsx';
import { ExerciseInfo } from '../components/ExerciseDemo.jsx';
import { put, post, patch } from '../lib/api.js';
import { loadLib, thumb, toExercise } from '../lib/exlib.js';
import { resetMorpho } from '../lib/morpho.js';
import { rateExercise } from '../../../server/morpho.js';

const TAG = { conflit: ['Conflit articulaire', 'mtone-conflit'], morpho: ['Morphologie', 'mtone-attention'], ordre: ['Ordre', 'mtone-attention'], doublon: ['Doublon', 'mtone-attention'], articulation: ['Récupération', 'mtone-attention'] };

// Meilleurs remplaçants : même muscle principal, mieux notés pour ton profil, photo de préférence
function alternatives(lib, c, morpho, pains) {
  const main = Object.entries(c.muscles || {}).sort((a, b) => b[1] - a[1])[0]?.[0]; if (!main || !lib) return [];
  return lib.filter((x) => x.c !== 'mobilite' && x.c !== 'cardio' && (x.m?.[main] || 0) >= 1)
    .map((x) => ({ x, r: rateExercise(x, morpho, pains) }))
    .filter((o) => o.r.verdict !== 'conflit' && o.r.score >= 0)
    .map((o) => ({ ...o, s: o.r.score * 4 + (o.x.pt === c.pattern ? 3 : 0) + (o.x.img ? 1 : 0) + (o.x.l === 'b' ? 0.5 : 0) }))
    .sort((a, b) => b.s - a.s).slice(0, 3);
}

export default function Morpho() {
  const { data, setData, reload } = useApi('/morpho'); const prog = useApi('/program');
  const [f, setF] = useState(null); const [open, setOpen] = useState(null); const [lib, setLib] = useState(null); const [alt, setAlt] = useState(null); const [info, setInfo] = useState(null);
  const toast = useToast();
  useEffect(() => { if (data && !f) setF({ ...data.morpho }); }, [data, f]);
  useEffect(() => { loadLib().then(setLib).catch(() => setLib([])); }, []);
  const conflicts = data?.conflicts || [];
  const alts = useMemo(() => (alt && lib ? alternatives(lib, alt, data.morpho, data.pains) : []), [alt, lib, data]);
  if (!data || !f) return <Loading />;
  const answered = data.questions.filter((q) => f[q.key]).length;

  const choose = async (key, v) => {
    const next = { ...f, [key]: v }; setF(next);
    try { setData(await put('/morpho', next)); resetMorpho(); } catch (e) { toast(e.message, 'err'); }
  };
  const replace = async (c, x) => {
    try { const ex = await post('/exercises', toExercise(x)); await patch(`/program/exercises/${c.pe_id}`, { exercise_id: ex.id }); setAlt(null); toast(`${c.exercise} remplacé par ${x.n}`); reload(); prog.reload(); }
    catch (e) { toast(e.message, 'err'); }
  };
  const moveAfter = async (c) => {
    const day = prog.data?.days.find((d) => d.id === c.day_id); if (!day) return;
    const ids = day.exercises.map((e) => e.id).filter((id) => id !== c.pe_id); const at = ids.indexOf(c.move_after); ids.splice(at + 1, 0, c.pe_id);
    try { await post(`/program/days/${day.id}/order`, { ids }); toast('Ordre modifié'); reload(); prog.reload(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <Page tabs={<SectionTabs group="body" />} title="Ma morphologie" back="/corps">
      <Card title="Ta structure" icon="body" action={<span className="muted small">{answered}/{data.questions.length}</span>}>
        <p className="muted small">Tes leviers (longueur des os, largeur des clavicules) et ta mobilité décident des exercices qui te conviennent. Réponds avec les petits tests : 2 minutes devant un miroir.</p>
        {data.questions.map((q) => (
          <div key={q.key} className="mq">
            <div className="mq-head"><b className="small">{q.label}</b><button className="link small" onClick={() => setOpen(open === q.key ? null : q.key)}>{open === q.key ? 'Fermer' : 'Comment savoir ?'}</button></div>
            <Segmented value={f[q.key] || ''} onChange={(v) => choose(q.key, v)} options={q.options} />
            {open === q.key && <p className="mq-test small">{q.test}</p>}
          </div>
        ))}
      </Card>

      <Card title="Conflits dans ton programme" icon="alert">
        {!answered && !data.pains.length ? <p className="muted">Réponds aux questions ci-dessus pour voir les exercices à adapter. Les conflits d’ordre et de récupération sont déjà vérifiés.</p> : null}
        {conflicts.length === 0 ? <p className="small"><Icon name="check" size={15} /> Aucun conflit : ton programme respecte ta structure.</p> : conflicts.map((c, i) => (
          <div key={i} className="mconf">
            <div className="grow">
              <span className={`small ${TAG[c.type][1]}`}><b>{TAG[c.type][0]}</b> · {c.day}</span>
              <p className="small"><b>{c.exercise ? `${c.exercise} : ` : ''}</b>{c.text}</p>
              {c.alt && <p className="muted small">Mieux : {c.alt}.</p>}
              <div className="row gap-s wrap mt-s">
                {c.pe_id && c.type !== 'ordre' && <button className="btn xs" onClick={() => setAlt(alt === c ? null : c)}><Icon name="skip" size={13} />Remplacer</button>}
                {c.type === 'ordre' && <button className="btn xs" onClick={() => moveAfter(c)}><Icon name="down" size={13} />Déplacer après</button>}
                {c.type === 'articulation' && <Link className="btn xs ghost" to="/programme">Voir le programme</Link>}
              </div>
              {alt === c && (
                <div className="malts">
                  {!lib ? <Loading /> : alts.length === 0 ? <p className="muted small">Pas de remplaçant évident : garde l’exercice en suivant le conseil.</p> : alts.map(({ x, r }) => (
                    <button key={x.id} onClick={() => replace(c, x)}>
                      <ExThumb src={thumb(x.id)} x={x} />
                      <span className="grow"><b className="small">{x.n}</b>{r.notes[0] && <span className="muted xs block">{r.notes[0].text}</span>}</span>
                      <span className="link small" onClick={(e) => { e.stopPropagation(); setInfo(x); }}>Voir</span>
                    </button>
                  ))}
                  {alts.length > 0 && <p className="muted xs">Toucher un exercice le met à la place dans ton programme (tes séances passées ne changent pas).</p>}
                </div>
              )}
            </div>
          </div>
        ))}
      </Card>
      <ExerciseInfo x={info} open={!!info} onClose={() => setInfo(null)} />
    </Page>
  );
}
