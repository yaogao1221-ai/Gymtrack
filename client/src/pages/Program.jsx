import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, Page, Card, Icon, Sheet, Field, NumInput, Segmented, Loading, ErrorBox, Confirm, useToast } from '../components/ui.jsx';
import { post, patch, put, del } from '../lib/api.js';
import { repsLabel, weightLabel, fmtDate, CARDIO, CARDIO_ICON } from '../lib/format.js';
import { Chips } from '../components/ui.jsx';
import { ExerciseBrowser } from '../components/ExercisePicker.jsx';
import { DemoImages, ExerciseInfo } from '../components/ExerciseDemo.jsx';
import { thumb } from '../lib/exlib.js';
import { CardioWeek } from './Cardio.jsx';

export default function Program() {
  const { data, error, reload } = useApi('/program');
  const lib = useApi('/exercises');
  const [sel, setSel] = useState(0); const [edit, setEdit] = useState(false);
  const [wd, setWd] = useState(null);
  const [pe, setPe] = useState(null); const [adding, setAdding] = useState(false); const [dayEdit, setDayEdit] = useState(null); const [confirm, setConfirm] = useState(null); const [pc, setPc] = useState(null);
  const [demo, setDemo] = useState(null); const [drag, setDrag] = useState(null); const rows = useRef([]);
  const nav = useNavigate(); const toast = useToast();
  if (error && !data) return <ErrorBox error={error} retry={reload} />;
  if (!data) return <Loading />;
  const day = data.days[Math.min(sel, data.days.length - 1)];
  const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); await reload(); } catch (e) { toast(e.message, 'err'); } };
  const saveDay = (code) => run(async () => { await put('/profile', { schedule: { ...data.schedule, [wd]: code } }); setWd(null); }, 'Semaine type et calendrier mis à jour');
  // Glisser-déposer tactile : on attrape la poignée, l'exercice suit le doigt, les autres se décalent
  const dragStart = (ev, i) => {
    ev.preventDefault(); ev.stopPropagation(); ev.currentTarget.setPointerCapture?.(ev.pointerId);
    const rects = day.exercises.map((_, k) => rows.current[k]?.getBoundingClientRect());
    setDrag({ from: i, over: i, y0: ev.clientY, dy: 0, rects, h: rects[i]?.height || 80 });
    navigator.vibrate?.(15);
  };
  const dragMove = (ev) => {
    if (!drag) return;
    const dy = ev.clientY - drag.y0; const mid = drag.rects[drag.from].top + drag.rects[drag.from].height / 2 + dy;
    let over = drag.from;
    drag.rects.forEach((r, k) => { if (k < drag.from && mid < r.top + r.height / 2) over = Math.min(over, k); if (k > drag.from && mid > r.top + r.height / 2) over = Math.max(over, k); });
    setDrag({ ...drag, dy, over });
  };
  const dragEnd = () => {
    if (!drag) return; const { from, over } = drag; setDrag(null);
    if (from === over) return;
    const ids = day.exercises.map((e) => e.id); const [m] = ids.splice(from, 1); ids.splice(over, 0, m);
    run(() => post(`/program/days/${day.id}/order`, { ids }));
  };
  const shiftOf = (i) => {
    if (!drag) return undefined;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, zIndex: 5, position: 'relative' };
    if (drag.from < drag.over && i > drag.from && i <= drag.over) return { transform: `translateY(${-drag.h}px)` };
    if (drag.from > drag.over && i < drag.from && i >= drag.over) return { transform: `translateY(${drag.h}px)` };
    return { transform: 'translateY(0)' };
  };
  const cardioRow = (c) => (
    <li key={`c${c.id}`} className="ex-item cardio" onClick={() => edit && setPc({ ...c })}>
      <span className="ex-cardio"><Icon name="heart" size={20} /></span>
      <div className="ex-main">
        <div className="ex-name">{c.label}<span className="tag aqua">Cardio</span></div>
        <div className="ex-meta"><span className="pill-sets">{c.duration_min} min</span>{c.speed_kmh != null && <span>{c.speed_kmh} km/h</span>}{c.incline_pct != null && c.incline_pct > 0 && <span>{c.incline_pct} %</span>}<span className="muted">{c.placement === 'debut' ? 'échauffement' : 'fin de séance'}</span></div>
        {c.notes && <div className="ex-last">{c.notes}</div>}
        {c.last && <div className="ex-last">Dernière fois : {c.last.duration_min} min{c.last.speed_kmh ? ` · ${c.last.speed_kmh} km/h` : ''}</div>}
      </div>
      {edit && <Icon name="edit" size={16} />}
    </li>
  );
  return (
    <Page title="Programme" subtitle={data.program?.name}
      actions={<div className="row gap-s"><button className="btn sm ghost" onClick={() => nav('/programme/creer')}><Icon name="sparkles" size={16} />Créer</button><button className={`btn sm ${edit ? 'primary' : ''}`} onClick={() => setEdit(!edit)}><Icon name={edit ? 'check' : 'edit'} size={16} />{edit ? 'Terminer' : 'Modifier'}</button></div>}>
      <WeekType schedule={data.schedule} days={data.days} onPick={setWd} onOpen={(i) => setSel(i)} />
      <div className="tabs scroll-x">
        {data.days.map((d, i) => <button key={d.id} className={`tab ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)}><b>{d.name}</b><span>{d.focus}</span>{d.next_date && <span className="tab-next">{fmtDate(d.next_date, { weekday: 'short', day: 'numeric' })}</span>}</button>)}
        {edit && <button className="tab add" onClick={() => run(async () => { await post('/program/days', {}); setSel(data.days.length); }, 'Jour ajouté')}><Icon name="plus" /><span>Ajouter un jour</span></button>}
      </div>
      {day && (
        <Card className="day-card" title={day.name} action={edit
          ? <div className="row gap-s"><button className="icon-btn" aria-label="Renommer" onClick={() => setDayEdit({ ...day })}><Icon name="edit" size={18} /></button>
              <button className="icon-btn danger" aria-label="Supprimer le jour" onClick={() => setConfirm(day)}><Icon name="trash" size={18} /></button></div>
          : <button className="btn primary sm" onClick={() => nav(`/seance/${day.id}`)}><Icon name="play" size={14} />Commencer</button>}>
          <div className="day-sum">
            {day.exercises.length > 0 && <><span><b>{day.exercises.length}</b> exercices</span><span><b>{day.total_sets}</b> séries</span><span>≈ <b>{day.est_minutes}</b> min</span></>}{day.cardio.length > 0 && <span className="aqua-text"><b>{day.cardio.reduce((a, c) => a + c.duration_min, 0)}</b> min cardio</span>}
            {day.top_muscles?.length > 0 && <span className="muted">{day.top_muscles.join(' · ')}</span>}
          </div>
          <p className="muted small day-dates">{day.next_date ? `Prochaine fois : ${fmtDate(day.next_date, { weekday: 'long', day: 'numeric', month: 'short' })}` : 'Pas encore planifié dans le calendrier'}{day.last_date ? ` · dernière fois le ${fmtDate(day.last_date, { day: 'numeric', month: 'short' })}` : ''}</p>
          <ol className="ex-list">
            {day.cardio.filter((c) => c.placement === 'debut').map((c) => cardioRow(c))}
            {day.exercises.map((e, i) => (
              <li key={e.id} ref={(el) => { rows.current[i] = el; }} style={shiftOf(i)} className={`ex-item ${e.superset_group ? 'superset' : ''} ${drag?.from === i ? 'dragging' : ''} ${drag ? 'drag-on' : ''}`} onClick={() => edit && !drag && setPe({ ...e })}>
                {thumb(e.lib_id) ? <button className="ex-thumb" aria-label="Voir la démo" onClick={(ev) => { ev.stopPropagation(); setDemo(e.lib_id); }}><img src={thumb(e.lib_id)} alt="" loading="lazy" onError={(ev) => { ev.currentTarget.style.visibility = 'hidden'; }} /><span className="ex-n">{i + 1}</span></button>
                  : <span className="ex-num">{i + 1}</span>}
                <div className="ex-main">
                  <div className="ex-name">{e.name}{e.superset_group && <span className="tag">Superset {e.superset_group}</span>}</div>
                  <div className="ex-meta"><span className="pill-sets">{repsLabel(e)}</span><span className={e.target_weight == null && e.kind !== 'bodyweight' ? 'warn-text' : ''}>{weightLabel(e)}</span>{e.rest_seconds && <span className="muted">repos {e.rest_seconds >= 120 ? `${e.rest_seconds / 60} min` : `${e.rest_seconds} s`}</span>}</div>
                  {e.last && <div className="ex-last">Dernière fois : {e.last.sets.map((s) => `${s.weight != null ? Math.round(s.weight * 10) / 10 : 'PDC'}×${s.reps ?? '?'}`).join(' · ')}</div>}
                  {e.notes && <div className="ex-last">{e.notes}</div>}
                </div>
                {edit && <span className="drag-handle" role="button" aria-label="Maintenir et glisser pour déplacer" onClick={(ev) => ev.stopPropagation()}
                  onPointerDown={(ev) => dragStart(ev, i)} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd}><Icon name="grip" size={22} stroke={3.2} /></span>}
              </li>
            ))}
            {day.cardio.filter((c) => c.placement !== 'debut').map((c) => cardioRow(c))}
          </ol>
          {!day.exercises.length && !day.cardio.length && <p className="muted small center">Jour vide : touche « Modifier » pour ajouter des exercices ou du cardio.</p>}
          {edit && <div className="grid2 add-row"><button className="btn dashed" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Exercice</button>
            <button className="btn dashed" onClick={() => setPc({ activity: 'marche_inclinee', duration_min: 20, speed_kmh: 5, incline_pct: 8, placement: 'fin' })}><Icon name="heart" size={16} />Cardio</button></div>}
          {!edit && <p className="muted small mt">Touche « Modifier » pour changer les exercices, séries, répétitions, charges ou l’ordre.</p>}
        </Card>
      )}

      {!edit && <CardioWeek prog={data} day={day} onChanged={reload} />}
      <ExerciseInfo open={!!demo} libId={demo} onClose={() => setDemo(null)} />
      <ExerciseSheet pe={pe} onClose={() => setPe(null)} lib={lib.data?.exercises || []}
        onSave={(body) => run(async () => { await patch(`/program/exercises/${pe.id}`, body); setPe(null); }, 'Exercice mis à jour')}
        onDelete={() => run(async () => { await del(`/program/exercises/${pe.id}`); setPe(null); }, 'Exercice retiré')} />
      <CardioBlockSheet key={pc ? pc.id ?? 'new' : 'none'} pc={pc} onClose={() => setPc(null)}
        onSave={(body) => run(async () => { if (pc.id) await patch(`/program/cardio/${pc.id}`, body); else await post(`/program/days/${day.id}/cardio`, body); setPc(null); }, pc?.id ? 'Cardio mis à jour' : 'Cardio ajouté au jour')}
        onDelete={() => run(async () => { await del(`/program/cardio/${pc.id}`); setPc(null); }, 'Cardio retiré')} />
      <AddSheet open={adding} onClose={() => setAdding(false)} lib={lib.data?.exercises || []} reloadLib={lib.reload}
        onAdd={(body) => run(async () => { await post(`/program/days/${day.id}/exercises`, body); setAdding(false); }, 'Exercice ajouté')} />
      <Sheet open={!!dayEdit} onClose={() => setDayEdit(null)} title="Renommer le jour"
        footer={<button className="btn primary" onClick={() => run(async () => { await patch(`/program/days/${dayEdit.id}`, { name: dayEdit.name, focus: dayEdit.focus }); setDayEdit(null); }, 'Jour renommé')}>Enregistrer</button>}>
        {dayEdit && <><Field label="Nom"><input value={dayEdit.name} onChange={(e) => setDayEdit({ ...dayEdit, name: e.target.value })} /></Field>
          <Field label="Groupes musculaires"><input value={dayEdit.focus || ''} onChange={(e) => setDayEdit({ ...dayEdit, focus: e.target.value })} /></Field></>}
      </Sheet>
      <Sheet open={!!wd} onClose={() => setWd(null)} title={wd ? `Le ${WD_LABEL[wd]}` : ''}>
        {wd && <div className="pick-days">
          <button className={`chip ${data.schedule[wd] === 'rest' ? 'on' : ''}`} onClick={() => saveDay('rest')}>Repos</button>
          {data.days.map((d) => <button key={d.id} className={`chip ${data.schedule[wd] === d.code ? 'on' : ''}`} onClick={() => saveDay(d.code)}><b>{d.name}</b> · {d.focus}</button>)}
        </div>}
        <p className="muted small mt">Le calendrier des semaines à venir suit automatiquement. Les séances déjà faites ne bougent pas.</p>
      </Sheet>
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger title="Supprimer ce jour ?" confirmLabel="Supprimer"
        text={`« ${confirm?.name} — ${confirm?.focus} » sera retiré du programme et des planifications futures. Ton historique de séances est conservé.`}
        onConfirm={() => run(async () => { await del(`/program/days/${confirm.id}`); setSel(0); }, 'Jour supprimé')} />
    </Page>
  );
}

function ExerciseSheet({ pe, onClose, onSave, onDelete, lib }) {
  const [f, setF] = useState(null);
  if (pe && (!f || f.id !== pe.id)) setF(pe);
  if (!pe || !f) return null;
  const set = (x) => setF({ ...f, ...x });
  const body = () => ({ exercise_id: f.exercise_id, sets: f.sets, reps: f.reps, reps_note: f.reps_note, target_weight: f.target_weight, target_weight_max: f.target_weight_max, weight_unit: f.weight_unit, weight_note: f.weight_note, rest_seconds: f.rest_seconds, superset_group: f.superset_group, notes: f.notes });
  return (
    <Sheet open onClose={onClose} title={pe.name} footer={<><button className="btn ghost danger-text" onClick={onDelete}><Icon name="trash" size={16} />Retirer</button><button className="btn primary" onClick={() => onSave(body())}>Enregistrer</button></>}>
      <Field label="Exercice"><select value={f.exercise_id} onChange={(e) => set({ exercise_id: Number(e.target.value) })}>{lib.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <div className="grid3">
        <Field label="Séries"><NumInput value={f.sets} onChange={(v) => set({ sets: v })} /></Field>
        <Field label="Répétitions"><NumInput value={f.reps} onChange={(v) => set({ reps: v })} placeholder="?" /></Field>
        <Field label="Précision"><input value={f.reps_note || ''} onChange={(e) => set({ reps_note: e.target.value })} placeholder="par bras" /></Field>
      </div>
      <div className="grid3">
        <Field label={f.weight_note === 'assistance' ? 'Assistance' : 'Charge'}><NumInput value={f.target_weight} onChange={(v) => set({ target_weight: v })} placeholder="—" /></Field>
        <Field label="Jusqu’à (option)"><NumInput value={f.target_weight_max} onChange={(v) => set({ target_weight_max: v })} placeholder="—" /></Field>
        <Field label="Unité"><Segmented value={f.weight_unit} onChange={(v) => set({ weight_unit: v })} options={[['lbs', 'lbs'], ['kg', 'kg']]} /></Field>
      </div>
      <div className="grid3">
        <Field label="Note charge"><input value={f.weight_note || ''} onChange={(e) => set({ weight_note: e.target.value })} placeholder="de chaque côté" /></Field>
        <Field label="Repos (s)"><NumInput value={f.rest_seconds} onChange={(v) => set({ rest_seconds: v })} placeholder="défaut" /></Field>
        <Field label="Superset"><input value={f.superset_group || ''} onChange={(e) => set({ superset_group: e.target.value.toUpperCase() })} placeholder="A, B…" maxLength={2} /></Field>
      </div>
      <Field label="Notes"><textarea rows={2} value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
      {pe.technique && <p className="tip"><Icon name="info" size={14} />{pe.technique}</p>}
    </Sheet>
  );
}

function AddSheet({ open, onClose, onAdd, lib, reloadLib }) {
  const [pick, setPick] = useState(null); const [cfg, setCfg] = useState({ sets: 2, reps: 8 });
  const [custom, setCustom] = useState(null); const toast = useToast();
  const close = () => { setPick(null); setCustom(null); onClose(); };
  const createCustom = async () => {
    try { const ex = await post('/exercises', custom); await reloadLib(); setPick(ex); setCustom(null); }
    catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Sheet open={open} onClose={close} title={pick ? pick.name : 'Ajouter un exercice'}
      footer={pick && <button className="btn primary" onClick={() => { onAdd({ exercise_id: pick.id, ...cfg, weight_unit: pick.default_unit }); setPick(null); }}>Ajouter au jour</button>}>
      {custom ? (<>
        <Field label="Nom de l’exercice"><input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} autoFocus /></Field>
        <Field label="Type"><Segmented value={custom.kind} onChange={(v) => setCustom({ ...custom, kind: v })} options={[['weighted', 'Avec charge'], ['bodyweight', 'Poids du corps'], ['assisted', 'Assisté']]} /></Field>
        <Field label="Muscle principal"><select value={Object.keys(custom.muscles)[0] || ''} onChange={(e) => setCustom({ ...custom, muscles: e.target.value ? { [e.target.value]: 1 } : {} })}>
          <option value="">—</option>{Object.entries(MUSCLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <div className="row gap"><button className="btn ghost" onClick={() => setCustom(null)}>Annuler</button><button className="btn primary" disabled={!custom.name} onClick={createCustom}>Créer</button></div>
      </>) : pick ? (<>
        {pick.lib_id && <DemoImages x={{ id: pick.lib_id, img: pick.lib_id.startsWith('x_') ? 0 : 2 }} size="md" />}
        <div className="grid2">
          <Field label="Séries"><NumInput value={cfg.sets} onChange={(v) => setCfg({ ...cfg, sets: v })} /></Field>
          <Field label="Répétitions"><NumInput value={cfg.reps} onChange={(v) => setCfg({ ...cfg, reps: v })} /></Field>
          <Field label="Charge (facultatif)"><NumInput value={cfg.target_weight} onChange={(v) => setCfg({ ...cfg, target_weight: v })} /></Field>
        </div>
        {pick.technique && <p className="tip"><Icon name="info" size={14} />{pick.technique}</p>}
        <button className="btn ghost sm" onClick={() => setPick(null)}>Choisir un autre exercice</button>
      </>) : (<>
        <ExerciseBrowser onPick={(e) => { reloadLib(); setPick(e); }} />
        <button className="btn block dashed mt-s" onClick={() => setCustom({ name: '', kind: 'weighted', muscles: {} })}><Icon name="plus" size={16} />Créer un exercice personnalisé</button>
      </>)}
    </Sheet>
  );
}

const MUSCLE_LABELS = { pectoraux: 'Pectoraux', epaules_ant: 'Épaules (avant)', epaules_lat: 'Épaules (latéral)', epaules_post: 'Épaules (arrière)', triceps: 'Triceps', biceps: 'Biceps', avant_bras: 'Avant-bras', dos_largeur: 'Dos (grand dorsal)', dos_epaisseur: 'Dos (milieu)', trapezes: 'Trapèzes', lombaires: 'Lombaires', abdominaux: 'Abdominaux', quadriceps: 'Quadriceps', ischios: 'Ischio-jambiers', fessiers: 'Fessiers', adducteurs: 'Adducteurs', abducteurs: 'Abducteurs', mollets: 'Mollets' };

function CardioBlockSheet({ pc, onClose, onSave, onDelete }) {
  const [f, setF] = useState(pc);
  if (!pc || !f) return null;
  const set = (x) => setF({ ...f, ...x });
  const body = { activity: f.activity, custom_name: f.activity === 'autre' ? f.custom_name : null, duration_min: f.duration_min, speed_kmh: f.speed_kmh, incline_pct: f.incline_pct, placement: f.placement, notes: f.notes };
  return (
    <Sheet open onClose={onClose} title={pc.id ? 'Bloc cardio' : 'Ajouter un cardio'}
      footer={<>{pc.id && <button className="btn ghost danger-text" onClick={onDelete}><Icon name="trash" size={16} />Retirer</button>}<button className="btn primary" disabled={!f.duration_min || (f.activity === 'autre' && !f.custom_name)} onClick={() => onSave(body)}>Enregistrer</button></>}>
      <Field label="Activité"><Chips single value={f.activity} onChange={(v) => set({ activity: v })} options={Object.entries(CARDIO)} /></Field>
      {f.activity === 'autre' && <Field label="Nom"><input value={f.custom_name || ''} onChange={(e) => set({ custom_name: e.target.value })} placeholder="Corde à sauter" /></Field>}
      <div className="grid3">
        <Field label="Durée (min)"><NumInput value={f.duration_min} onChange={(v) => set({ duration_min: v })} /></Field>
        <Field label="Vitesse (km/h)"><NumInput value={f.speed_kmh} onChange={(v) => set({ speed_kmh: v })} placeholder="—" /></Field>
        <Field label="Inclinaison (%)"><NumInput value={f.incline_pct} onChange={(v) => set({ incline_pct: v })} placeholder="—" /></Field>
      </div>
      <Field label="Moment"><Segmented value={f.placement} onChange={(v) => set({ placement: v })} options={[['debut', 'Échauffement'], ['fin', 'Fin de séance']]} /></Field>
      <p className="tip"><Icon name="info" size={14} />En fin de séance de jambes, garde une intensité où tu peux parler : le cardio ne doit pas voler la récupération musculaire.</p>
    </Sheet>
  );
}

const WD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WD_LABEL = { mon: 'lundi', tue: 'mardi', wed: 'mercredi', thu: 'jeudi', fri: 'vendredi', sat: 'samedi', sun: 'dimanche' };
// Semaine type : relie le programme au calendrier (modifier un jour replanifie les semaines à venir)
function WeekType({ schedule, days, onPick, onOpen }) {
  const todayKey = WD[(new Date().getDay() + 6) % 7];
  return (
    <div className="week-type">
      {WD.map((k) => {
        const code = schedule?.[k] || 'rest'; const i = days.findIndex((d) => d.code === code); const d = days[i];
        return (
          <button key={k} className={`wt-day ${d ? (d.exercises.length ? 'train' : 'train cardio') : 'rest'} ${k === todayKey ? 'today' : ''}`} onClick={() => onPick(k)} onDoubleClick={() => d && onOpen(i)} title={d ? `${d.name} — ${d.focus}` : 'Repos'}>
            <span className="wt-dow">{WD_LABEL[k].slice(0, 3)}</span>
            <b>{d ? d.code.replace('D', 'J') : '—'}</b>
            <span className="wt-focus">{d ? (d.focus || '').split(/[ /]+/)[0] : 'repos'}</span>
          </button>
        );
      })}
    </div>
  );
}
