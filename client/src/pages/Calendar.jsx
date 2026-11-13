import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, Page, Icon, Sheet, Field, NumInput, Segmented, Loading, useToast } from '../components/ui.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';
import { post, patch, del, today } from '../lib/api.js';
import { addDays, weekStart, fmtDay, iso, CARDIO, CARDIO_ICON, mins } from '../lib/format.js';

const monthOf = (d) => d.slice(0, 7);
// Libellé court et lisible d'une séance : « Pecs », « Dos », « Full A », « Push », « Cardio »
const ABBR = { Pectoraux: 'Pecs', Quadriceps: 'Jambes', Ischios: 'Jambes', Corps: 'Full', Épaules: 'Épaules' };
export const shortDay = (name = '', focus = '') => {
  if (/^cardio/i.test(name)) return 'Cardio';
  if (/^jour \d/i.test(name)) { const w = (focus || '').split(/[ /·,]+/)[0]; return ABBR[w] || w || name.replace('Jour ', 'J'); }
  return name.replace(/^Full body /, 'Full ').replace(/^Haut /, 'Haut ').slice(0, 9);
};
const isCardioDay = (name = '') => /^cardio/i.test(name);

export default function Calendar() {
  return <Page tabs={<SectionTabs group="training" />} title="Calendrier"><CalendarView /></Page>;
}

export function CalendarView({ home }) {
  const [params] = useSearchParams();
  const t = today();
  const [month, setMonth] = useState(monthOf(params.get('d') || t));
  const [selected, setSelected] = useState(params.get('d') || null);
  const [adding, setAdding] = useState(null); const [dragId, setDragId] = useState(null); const [reflow, setReflow] = useState(null);
  const nav = useNavigate(); const toast = useToast();
  const first = `${month}-01`;
  const gridStart = weekStart(first);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const { data, reload } = useApi(`/calendar?from=${cells[0]}&to=${cells[41]}`);
  const program = useApi('/program');
  const shift = (n) => { const d = new Date(first + 'T12:00:00'); d.setMonth(d.getMonth() + n); setMonth(iso(d).slice(0, 7)); };
  const run = async (fn, msg) => { try { const r = await fn(); if (msg) toast(typeof msg === 'function' ? msg(r) : msg); reload(); } catch (e) { toast(e.message, 'err'); } };
  const [view, setView] = useState('month');
  const by = (date) => ({
    events: data?.events.filter((e) => e.date === date) || [],
    workouts: data?.workouts.filter((w) => w.date === date) || [],
    cardio: data?.cardio.filter((c) => c.date === date) || [],
    metrics: data?.metrics?.filter((m) => m.date === date) || [],
    plan: data?.plans?.find((p) => p.start_date <= date && p.end_date >= date) || null,
    deadlines: data?.deadlines?.filter((g) => g.date === date) || [],
    blocks: (data?.events || []).filter((e) => e.date === date && e.type === 'workout' && e.status === 'planned').flatMap((e) => data?.blocks?.[e.program_day_id] || []),
  });
  const inMonth = (d) => monthOf(d) === month;
  const sum = data ? {
    done: data.workouts.filter((w) => inMonth(w.date)).length,
    planned: data.events.filter((e) => inMonth(e.date) && e.type === 'workout' && e.status === 'planned' && e.date >= t).length,
    cardio: data.cardio.filter((c) => inMonth(c.date)).length,
    weigh: (data.metrics || []).filter((m) => inMonth(m.date) && m.weight_kg != null).length,
  } : null;
  const title = new Date(first + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const sel = selected && by(selected);

  const tools = (
      <div className="row gap-s wrap cal-tools">
        <button className="btn sm primary" onClick={() => setReflow({ from: t, program_day_id: program.data?.days[0]?.id, weeks: 4 })}><Icon name="calendar" size={16} />Reprendre par…</button>
        <button className="btn sm" onClick={() => run(() => post('/calendar/plan', { from: weekStart(t), weeks: 4 }), (r) => `${r.created} jour(s) planifié(s)${r.skipped ? `, ${r.skipped} déjà occupé(s)` : ''}`)}><Icon name="sparkles" size={16} />Planifier 4 sem.</button>
      </div>);
  return (
    <>
      <div className={`cal card ${home ? 'home' : ''}`}>
        <div className="cal-head">
          <div className="cal-title"><h2 className="cap">{title}</h2>{sum && <span className="muted xs">{sum.done} faite{sum.done > 1 ? 's' : ''} · {sum.planned} à venir{sum.cardio ? ` · ${sum.cardio} cardio` : ''}</span>}</div>
          <div className="row gap-s">
            <button className={`icon-btn sm ${view === 'agenda' ? 'on' : ''}`} onClick={() => setView(view === 'agenda' ? 'month' : 'agenda')} aria-label={view === 'agenda' ? 'Vue mois' : 'Vue liste'}><Icon name={view === 'agenda' ? 'calendar' : 'menu'} size={16} /></button>
            {view === 'month' && <><button className="icon-btn sm" onClick={() => shift(-1)} aria-label="Mois précédent"><Icon name="left" size={16} /></button>
            <button className="icon-btn sm" onClick={() => shift(1)} aria-label="Mois suivant"><Icon name="right" size={16} /></button></>}
          </div>
        </div>
      {view === 'agenda' ? <Agenda from={t} by={by} data={data} onPick={setSelected} onGo={(id) => nav(`/seance/${id}`)} /> : <>
        <div className="cal-grid">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
          {!data ? <div className="cal-loading"><Loading /></div> : cells.map((date) => {
            const x = by(date);
            return (
              <button key={date} className={`cal-cell ${x.events.some((e) => e.deload) ? 'deload' : ''} ${monthOf(date) !== month ? 'out' : ''} ${date === t ? 'today' : ''} ${date === selected ? 'sel' : ''}`}
                onClick={() => setSelected(date)} onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && run(() => patch(`/calendar/${dragId}`, { date }), 'Séance déplacée')}>
                <span className="cal-num">{Number(date.slice(8))}</span>
                <span className="cal-items">
                  {x.workouts.map((w) => <i key={`w${w.id}`} className="cal-chip done">{shortDay(w.name, w.focus)}</i>)}
                  {x.events.filter((e) => e.type === 'workout' && e.status === 'planned').map((e) => (
                    <i key={e.id} className={`cal-chip planned ${isCardioDay(e.day_name) ? 'car' : ''}`} draggable onDragStart={() => setDragId(e.id)} onDragEnd={() => setDragId(null)}>{shortDay(e.day_name, e.focus)}</i>
                  ))}
                  {x.events.filter((e) => e.type === 'workout' && e.status === 'skipped').map((e) => <i key={e.id} className="cal-chip skipped">{shortDay(e.day_name, e.focus)}</i>)}
                  {!x.workouts.length && x.cardio.length > 0 && <i className="cal-chip done car">Cardio</i>}
                </span>
                <span className="cal-marks">
                  {x.cardio.length > 0 ? <i className="mk cardio" title="Cardio fait" /> : (x.blocks.length || x.events.some((e) => e.type === 'cardio' && e.status === 'planned')) ? <i className="mk cardio ring" title="Cardio prévu" /> : null}
                  {x.metrics.some((m) => m.weight_kg != null || m.waist_cm != null) && <i className="mk body" title="Pesée / mesure" />}
                  {x.deadlines.length > 0 && <i className="mk goal" title="Échéance d’objectif" />}
                </span>
                {x.plan && <span className={`cal-plan ${x.plan.start_date === date ? 'start' : ''} ${x.plan.end_date === date ? 'end' : ''}`} title={`Cure : ${x.plan.label}`} />}
              </button>
            );
          })}
        </div>
        <div className="legend xs muted cal-legend"><span><i className="lg done" />faite</span><span><i className="lg planned" />prévue</span><span><i className="lg car" />cardio</span><span><i className="mk body" />pesée</span>{data?.plans?.length > 0 && <span><i className="cal-plan-key" />cure</span>}</div>
      </>}
      {tools}
      </div>

      <Sheet open={!!reflow} onClose={() => setReflow(null)} title="Reprendre le programme"
        footer={<button className="btn primary" disabled={!reflow?.program_day_id} onClick={() => run(async () => { const r = await post('/calendar/reflow', reflow); setReflow(null); return r; }, (r) => `Programme recalé à partir du ${fmtDay(r.from)}`)}>Recaler le calendrier</button>}>
        {reflow && <>
          <p className="small">Tu as sauté une séance ou tu veux changer l’ordre ? Choisis le jour et la séance par laquelle tu reprends : la suite du programme s’enchaîne dans l’ordre, et tes jours de repos restent à leur place.</p>
          <Field label="À partir du"><input type="date" value={reflow.from} onChange={(e) => setReflow({ ...reflow, from: e.target.value })} /></Field>
          <Field label="Je commence par">
            <div className="pick-days">{(program.data?.days || []).map((d) => (
              <button key={d.id} type="button" className={`chip ${reflow.program_day_id === d.id ? 'on' : ''}`} onClick={() => setReflow({ ...reflow, program_day_id: d.id })}><b>{d.name}</b> · {d.focus}</button>
            ))}</div>
          </Field>
          <Field label="Sur"><Segmented value={reflow.weeks} onChange={(v) => setReflow({ ...reflow, weeks: v })} options={[[2, '2 sem.'], [4, '4 sem.'], [8, '8 sem.']]} /></Field>
          <p className="muted small">Les séances déjà faites ou marquées sautées ne bougent pas. Le reste des séances prévues sur la période est remplacé.</p>
        </>}
      </Sheet>
      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected ? fmtDay(selected) : ''}>
        {sel && (<>
          {sel.workouts.map((w) => <Link key={w.id} className="cal-row done" to={`/historique/${w.id}`}><Icon name="check" size={16} /><span><b>{w.name}</b> {w.focus}</span><span className="muted small">{mins(Math.round(w.duration_sec / 60))}</span></Link>)}
          {sel.cardio.map((c) => <Link key={c.id} className="cal-row done" to="/cardio"><i className="act">{CARDIO_ICON[c.activity]}</i><span><b>{c.custom_name || CARDIO[c.activity]}</b></span><span className="muted small">{mins(c.duration_min)}</span></Link>)}
          {sel.events.filter((e) => e.status !== 'done').map((e) => (
            <div key={e.id} className={`cal-row ${e.status}`}>
              <i className="act">{e.type === 'workout' ? 'MU' : e.type === 'cardio' ? CARDIO_ICON[e.cardio_activity] || 'CA' : 'RE'}</i>
              <span className="grow"><b>{e.type === 'workout' ? `${e.day_name} — ${e.focus}` : e.type === 'cardio' ? `Cardio ${CARDIO[e.cardio_activity] || ''} ${e.planned_minutes ? `${e.planned_minutes} min` : ''}` : 'Repos'}</b>
                {e.status === 'skipped' && <span className="muted small"> (sautée)</span>}{e.notes && <span className="muted small block">{e.notes}</span>}</span>
              <div className="cal-actions">
                {e.type === 'workout' && e.status === 'planned' && <button className="btn xs primary" onClick={() => nav(`/seance/${e.program_day_id}`)}><Icon name="play" size={12} />Go</button>}
                <label className="btn xs ghost date-move" title="Déplacer"><Icon name="calendar" size={14} /><input type="date" value={e.date} onChange={(ev) => ev.target.value && run(() => patch(`/calendar/${e.id}`, { date: ev.target.value }).then(() => setSelected(ev.target.value)), 'Déplacé')} /></label>
                {e.status === 'planned' && e.type !== 'rest' && <button className="btn xs ghost" onClick={() => run(() => patch(`/calendar/${e.id}`, { status: 'skipped' }), 'Marquée comme sautée')}>Sauter</button>}
                {e.status === 'skipped' && <button className="btn xs ghost" onClick={() => run(() => patch(`/calendar/${e.id}`, { status: 'planned' }))}>Rétablir</button>}
                <button className="icon-btn sm danger" aria-label="Supprimer" onClick={() => run(() => del(`/calendar/${e.id}`), 'Supprimé')}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
          {sel.blocks.length > 0 && <p className="small cal-blocks"><Icon name="heart" size={14} />Avec la séance : {sel.blocks.map((b) => `${b.label} ${Math.round(b.duration_min)} min ${b.placement === 'debut' ? 'en début' : 'en fin'}`).join(' · ')}</p>}
          {sel.metrics.map((m) => <Link key={m.id} className="cal-row done body" to="/nutrition?v=poids"><Icon name="scale" size={16} /><span className="grow"><b>{[m.weight_kg != null && `${String(m.weight_kg).replace('.', ',')} kg`, m.waist_cm != null && `taille ${m.waist_cm} cm`, m.body_fat_pct != null && `${m.body_fat_pct} % de gras`].filter(Boolean).join(' · ')}</b></span><span className="muted small">pesée</span></Link>)}
          {sel.deadlines.map((g) => <Link key={g.id} className="cal-row" to="/objectifs"><Icon name="target" size={16} /><span className="grow"><b>Échéance : {g.title}</b></span></Link>)}
          {sel.plan && <p className="muted small">Cure {sel.plan.label.toLowerCase()} · semaine {Math.floor((new Date(selected) - new Date(sel.plan.start_date)) / 864e5 / 7) + 1} sur {sel.plan.weeks}</p>}
          {!sel.workouts.length && !sel.cardio.length && !sel.events.length && !sel.metrics.length && <p className="muted">Rien de prévu ce jour-là.</p>}
          <h3 className="sub">Ajouter</h3>
          {adding ? (
            <div className="add-box">
              <Segmented value={adding.type} onChange={(v) => setAdding({ ...adding, type: v })} options={[['workout', 'Muscu'], ['cardio', 'Cardio'], ['rest', 'Repos']]} />
              {adding.type === 'workout' && <Field label="Séance"><select value={adding.program_day_id || ''} onChange={(e) => setAdding({ ...adding, program_day_id: Number(e.target.value) })}>
                <option value="">Choisir…</option>{program.data?.days.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.focus}</option>)}</select></Field>}
              {adding.type === 'cardio' && <div className="grid2">
                <Field label="Activité"><select value={adding.cardio_activity} onChange={(e) => setAdding({ ...adding, cardio_activity: e.target.value })}>{Object.entries(CARDIO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                <Field label="Minutes"><NumInput value={adding.planned_minutes} onChange={(v) => setAdding({ ...adding, planned_minutes: v })} /></Field></div>}
              <div className="row gap mt-s"><button className="btn ghost" onClick={() => setAdding(null)}>Annuler</button>
                <button className="btn primary" disabled={adding.type === 'workout' && !adding.program_day_id} onClick={() => run(async () => { await post('/calendar', { ...adding, date: selected }); setAdding(null); }, 'Ajouté au calendrier')}>Ajouter</button></div>
            </div>
          ) : <div className="row gap-s wrap">
            <button className="btn sm" onClick={() => setAdding({ type: 'workout' })}>Séance muscu</button>
            <button className="btn sm" onClick={() => setAdding({ type: 'cardio', cardio_activity: 'marche_inclinee', planned_minutes: 20 })}>Cardio</button>
            <button className="btn sm" onClick={() => run(() => post('/calendar', { type: 'rest', date: selected, title: 'Repos' }), 'Jour de repos ajouté')}>Repos</button>
            {selected <= t && <Link className="btn sm" to="/nutrition?v=poids"><Icon name="scale" size={14} />Pesée</Link>}
          </div>}
        </>)}
      </Sheet>
    </>
  );
}

// Agenda : les 14 prochains jours en liste, avec tout ce qui les concerne (muscu, cardio, pesée, cure, échéances)
function Agenda({ from, by, data, onPick, onGo }) {
  if (!data) return <Loading />;
  const days = Array.from({ length: 14 }, (_, i) => addDays(from, i));
  return (
    <div className="agenda">
      {days.map((d) => {
        const x = by(d); const w = x.events.find((e) => e.type === 'workout' && e.status === 'planned');
        const rest = x.events.some((e) => e.type === 'rest') && !w && !x.workouts.length;
        return (
          <div key={d} className={`ag-day ${d === from ? 'today' : ''} ${rest ? 'rest' : ''}`} onClick={() => onPick(d)}>
            <div className="ag-date"><span className="muted small">{new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}</span><b>{Number(d.slice(8))}</b></div>
            <div className="ag-body">
              {x.workouts.map((wk) => <div key={wk.id} className="ag-item done mus"><Icon name="check" size={14} /><span className="grow"><b>{wk.name}</b> <span className="muted">{wk.focus}</span></span></div>)}
              {w && <div className="ag-item mus"><Icon name="dumbbell" size={14} /><span className="grow"><b>{w.day_name}</b> <span className="muted">{w.focus}</span>{w.deload ? <span className="tag">deload</span> : null}</span>
                {d === from && <button className="btn xs primary" onClick={(e) => { e.stopPropagation(); onGo(w.program_day_id); }}><Icon name="play" size={12} />Go</button>}</div>}
              {x.blocks.map((b, i) => <div key={i} className="ag-item car sub"><Icon name="heart" size={14} /><span>{b.label} · {Math.round(b.duration_min)} min {b.placement === 'debut' ? 'avant' : 'après'}</span></div>)}
              {x.cardio.map((c) => <div key={c.id} className="ag-item done car"><Icon name="heart" size={14} /><span>{c.custom_name || CARDIO[c.activity]} · {mins(c.duration_min)}{c.distance_km ? ` · ${String(c.distance_km).replace('.', ',')} km` : ''}</span></div>)}
              {x.events.filter((e) => e.type === 'cardio' && e.status === 'planned').map((e) => <div key={e.id} className="ag-item car"><Icon name="heart" size={14} /><span>Cardio {CARDIO[e.cardio_activity] || ''} {e.planned_minutes ? `· ${e.planned_minutes} min` : ''}</span></div>)}
              {x.metrics.filter((m) => m.weight_kg != null).map((m) => <div key={m.id} className="ag-item body"><Icon name="scale" size={14} /><span>Pesée · {String(m.weight_kg).replace('.', ',')} kg</span></div>)}
              {x.deadlines.map((g) => <div key={g.id} className="ag-item goal"><Icon name="target" size={14} /><span>Échéance : {g.title}</span></div>)}
              {rest && <span className="muted small">Repos</span>}
              {!rest && !w && !x.workouts.length && !x.cardio.length && !x.metrics.length && !x.deadlines.length && <span className="muted small">Libre</span>}
              {x.plan && x.plan.start_date === d && <span className="tag">Début de la cure : {x.plan.label}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
