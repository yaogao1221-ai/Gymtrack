import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Icon, Loading, useApi, useToast } from '../../components/ui.jsx';
import { MobilityDone } from '../../components/MuscleBrain.jsx';
import { ExerciseInfo } from '../../components/ExerciseDemo.jsx';
import { ExThumb } from '../../components/MoveFigure.jsx';
import { loadLib, thumb } from '../../lib/exlib.js';
import { put, today } from '../../lib/api.js';
import { MOB_ROUTINES, MOB_BY_KEY, PAIN_ROUTINE, LEVEL, JOINT_FR } from '../../data/mobility.js';

const GROUP_FR = { pectoraux: 'pectoraux', epaules_ant: 'épaules', epaules_lat: 'épaules', epaules_post: 'épaules', biceps: 'biceps', triceps: 'triceps', avant_bras: 'avant-bras', abdominaux: 'abdominaux',
  quadriceps: 'quadriceps', ischios: 'ischios', fessiers: 'fessiers', adducteurs: 'adducteurs', abducteurs: 'abducteurs', mollets: 'mollets', trapezes: 'trapèzes', dos_epaisseur: 'haut du dos', dos_largeur: 'grand dorsal', lombaires: 'lombaires' };

// Mobilité et échauffements : routine conseillée (douleur, séance du jour), routines détaillées et personnalisables
export default function MobilityTab() {
  const brain = useApi('/muscles/state'); const mob = useApi('/mobility'); const cfg = useApi('/body/settings'); const toast = useToast();
  const [lib, setLib] = useState(null); const [info, setInfo] = useState(null); const [open, setOpen] = useState(null); const [edit, setEdit] = useState(null); const [add, setAdd] = useState('');
  useEffect(() => { loadLib().then(setLib).catch(() => setLib([])); }, []);
  const byId = useMemo(() => new Map((lib || []).map((x) => [x.id, x])), [lib]);
  const custom = cfg.data?.settings.routines || {};
  const doneToday = (k) => (mob.data || []).some((x) => x.routine === k && x.date === today());
  const week = (mob.data || []).filter((x) => x.date >= new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10)).length;
  // Routine conseillée : douleur active d'abord, sinon l'échauffement de la séance du jour
  const plan = brain.data?.today_plan; const pain = Object.values(brain.data?.joints || {}).filter((j) => j.pain).sort((a, b) => b.pain.intensity - a.pain.intensity)[0];
  const recKey = pain ? PAIN_ROUTINE[pain.key] : plan?.done || plan?.rest ? (plan.done ? 'apres' : 'corps') : plan?.mobility?.routine === 'bas' ? 'bas' : 'haut';
  const recWhy = pain ? `Douleur ${pain.label.toLowerCase()} ${pain.pain.intensity}/10 : mobilité douce de la zone, sans forcer.` : plan?.mobility?.why || 'Prépare les articulations de ta séance.';
  const exOf = (r) => {
    const c = custom[r.key] || { hide: [], add: [] };
    return [...r.ex.filter((e) => !c.hide.includes(e.id)), ...c.add.filter((id) => !r.ex.some((e) => e.id === id)).map((id) => ({ id, dose: '30 s ou 10 répétitions', custom: true }))];
  };
  const save = async (key, next) => { try { await put('/body/settings', { routines: { [key]: next } }); cfg.reload(); } catch (e) { toast(e.message, 'err'); } };
  const toggleHide = (r, id) => { const c = custom[r.key] || { hide: [], add: [] }; const isAdd = c.add.includes(id); save(r.key, isAdd ? { ...c, add: c.add.filter((x) => x !== id) } : { ...c, hide: c.hide.includes(id) ? c.hide.filter((x) => x !== id) : [...c.hide, id] }); };
  const mobLib = useMemo(() => (lib || []).filter((x) => x.c === 'mobilite').sort((a, b) => a.n.localeCompare(b.n)), [lib]);
  const order = recKey ? [MOB_BY_KEY[recKey], ...MOB_ROUTINES.filter((r) => r.key !== recKey)] : MOB_ROUTINES;
  if (!lib || !cfg.data) return <Loading />;
  return (<>
    <section className="card mob-head">
      <div className="row-between"><b>{week} routine{week > 1 ? 's' : ''} faite{week > 1 ? 's' : ''} cette semaine</b><Link className="link small" to="/soins">Protocoles de soin</Link></div>
      <p className="muted xs">Mobilité : bouger l’articulation dans toute son amplitude. Échauffement : préparer la séance. Étirement : relâcher après l’effort. Jamais jusqu’à la douleur.</p>
    </section>
    {order.map((r, i) => {
      const list = exOf(r); const isOpen = open === r.key || (open == null && i === 0); const editing = edit === r.key; const c = custom[r.key];
      return (
        <section key={r.key} className={`card mob-r ${i === 0 && recKey ? 'rec' : ''}`}>
          <button className="mob-top" onClick={() => setOpen(isOpen ? '' : r.key)}>
            <span className="grow">{i === 0 && recKey && <span className="tag good">Conseillée aujourd’hui</span>}<b className="block">{r.t}</b><span className="muted small">{r.d} · {r.min} min · {list.length} exercices{c && (c.hide.length || c.add.length) ? ' · personnalisée' : ''}</span></span>
            {doneToday(r.key) && <Icon name="check" size={16} className="good" />}<Icon name={isOpen ? 'up' : 'down'} size={16} />
          </button>
          {isOpen && <>
            {i === 0 && recKey && <p className="small mob-why">{recWhy}</p>}
            <ul className="mob-list">{(editing ? [...r.ex, ...(c?.add || []).map((id) => ({ id, custom: true }))] : list).map((e) => { const x = byId.get(e.id); if (!x) return null; const hidden = c?.hide.includes(e.id); return (
              <li key={e.id} className={hidden ? 'off' : ''}>
                <button className="mob-ex" onClick={() => setInfo(x)}><ExThumb src={thumb(x.id)} x={x} />
                  <span className="grow"><b className="small">{x.n}</b><span className="muted xs block">{e.dose}{x.l ? ` · ${LEVEL[x.l]}` : ''}</span>
                    <span className="xs block">{(x.t || []).slice(0, 3).map((g) => GROUP_FR[g]).filter(Boolean).join(', ')}{e.joints ? `${(x.t || []).length ? ' · ' : ''}${e.joints.map((j) => JOINT_FR[j]).join(', ')}` : ''}</span></span></button>
                {editing ? <button className="btn xs ghost" onClick={() => toggleHide(r, e.id)}>{hidden ? 'Remettre' : 'Retirer'}</button> : e.cue && <details className="mob-more"><summary className="xs">Conseils</summary>
                  <p className="xs"><b>Point clé :</b> {e.cue}</p><p className="xs"><b>À éviter :</b> {e.err}</p><p className="xs"><b>Plus facile :</b> {e.easy}</p></details>}
              </li>); })}</ul>
            {editing && <div className="row gap-s mt-s"><select value={add} onChange={(ev) => setAdd(ev.target.value)} className="grow"><option value="">Ajouter un exercice…</option>{mobLib.map((x) => <option key={x.id} value={x.id}>{x.n}</option>)}</select>
              <button className="btn sm" disabled={!add} onClick={() => { const cc = c || { hide: [], add: [] }; save(r.key, { ...cc, add: [...new Set([...cc.add, add])] }); setAdd(''); }}>Ajouter</button></div>}
            <div className="row gap-s wrap mt-s">
              <MobilityDone routine={r.key} done={doneToday(r.key)} onDone={() => { mob.reload(); brain.reload(); }} />
              <button className="btn sm ghost" onClick={() => setEdit(editing ? null : r.key)}><Icon name="edit" size={14} />{editing ? 'Terminé' : 'Personnaliser'}</button>
              {editing && c && (c.hide.length > 0 || c.add.length > 0) && <button className="btn sm ghost" onClick={() => save(r.key, { hide: [], add: [] })}>Par défaut</button>}
            </div>
          </>}
        </section>);
    })}
    <ExerciseInfo open={!!info} x={info} onClose={() => setInfo(null)} />
  </>);
}
