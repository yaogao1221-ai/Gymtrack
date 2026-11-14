import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Page, Card, Icon, Loading, useToast } from '../components/ui.jsx';
import { post } from '../lib/api.js';
import { loadLib, toExercise } from '../lib/exlib.js';
import { CARDIO } from '../lib/format.js';

const DAYS = { mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche' };
// Lien d'import : #/programme/importer?d=<JSON en base64url>. Rien n'est enregistré avant « Ajouter ce programme ».
const decode = (d) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(d.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));

export default function ImportProgram() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const toast = useToast();
  const [prog, setProg] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const p = decode(sp.get('d') || ''); const lib = await loadLib();
        // Exercices de la bibliothèque : on joint leurs muscles et leur schéma pour que le coach les comprenne
        for (const d of p.days) for (const it of d.items) if (it.l) { const x = lib.find((y) => y.id === it.l); it.exercise = x ? { ...toExercise(x), name: it.n || x.n } : { name: it.n, lib_id: it.l }; }
        setProg(p);
      } catch { setErr('Ce lien d’import est incomplet ou abîmé.'); }
    })();
  }, [sp]);
  const save = async () => {
    setBusy(true);
    try {
      const body = { name: prog.name, days: prog.days.map((d) => ({ ...d, items: d.items.map((it) => ({ slug: it.s, exercise: it.exercise, sets: it.sets, reps: it.reps, reps_note: it.note, rest: it.rest })) })) };
      const r = await post('/programs/import', body);
      toast(r.existing ? 'Ce programme était déjà là : il est de nouveau actif' : 'Programme ajouté et activé'); nav('/programme');
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };
  if (err) return <Page title="Importer un programme" back><Card><p>{err}</p><Link className="btn" to="/programme">Retour au programme</Link></Card></Page>;
  if (!prog) return <Page title="Importer un programme" back><Loading /></Page>;
  const sched = Object.entries(DAYS).map(([k, l]) => { const i = prog.days.findIndex((d) => (d.weekdays || []).includes(k)); return `${l} : ${i >= 0 ? prog.days[i].name : 'repos'}`; });
  return (
    <Page title="Importer un programme" back>
      <Card title={prog.name} icon="dumbbell">
        <p className="small">{prog.note || 'Vérifie le programme, puis ajoute-le.'}</p>
        <p className="muted small">Il devient ton programme actif. L’actuel reste enregistré dans tes programmes (tu peux y revenir), ton historique ne bouge pas, et les exercices que tu fais déjà gardent leurs charges actuelles. Rien n’est envoyé aux autres.</p>
        <p className="small mt-s"><b>Semaine</b><br />{sched.join(' · ')}</p>
      </Card>
      {prog.days.map((d, i) => (
        <Card key={i} title={d.name} icon="calendar">
          {d.focus && <p className="muted small">{d.focus}</p>}
          <ol className="imp-list">{d.items.map((it, j) => <li key={j}><span className="grow">{it.n || it.exercise?.name || it.s}</span><b>{it.sets} × {it.reps}{it.note ? ` ${it.note}` : ''}</b></li>)}</ol>
          {(d.cardio || []).map((c, k) => <p key={k} className="small mt-s"><Icon name="heart" size={14} /> {CARDIO[c.activity] || c.activity} : {c.duration_min} min{c.incline_pct != null ? ` · ${c.incline_pct} %` : ''}{c.speed_kmh != null ? ` · ${c.speed_kmh} km/h` : ''}, en fin de séance</p>)}
        </Card>
      ))}
      <button className="btn primary block" disabled={busy} onClick={save}><Icon name="check" size={16} />Ajouter ce programme</button>
    </Page>
  );
}
