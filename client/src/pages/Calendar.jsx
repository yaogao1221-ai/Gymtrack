import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, Page, Icon, Sheet, Field, NumInput, Segmented, Loading, useToast } from '../components/ui.jsx';
import { post, patch, del, today } from '../lib/api.js';
import { addDays, weekStart, fmtDay, iso, CARDIO, CARDIO_ICON, mins } from '../lib/format.js';

const monthOf = (d) => d.slice(0, 7);

export default function Calendar() {
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
  const by = (date) => ({
    events: data?.events.filter((e) => e.date === date) || [],
    workouts: data?.workouts.filter((w) => w.date === date) || [],
    cardio: data?.cardio.filter((c) => c.date === date) || [],
  });
  const title = new Date(first + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const sel = selected && by(selected);

  return (
    <Page title="Calendrier" subtitle="Planifie, déplace et consulte tes séances">
      <div className="row gap-s wrap cal-actions">
        <button className="btn sm primary" onClick={() => setReflow({ from: t, program_day_id: program.data?.days[0]?.id, weeks: 4 })}><Icon name="calendar" size={16} />Reprendre par…</button>
        <button className="btn sm" onClick={() => run(() => post('/calendar/plan', { from: weekStart(t), weeks: 4 }), (r) => `${r.created} jour(s) planifié(s)${r.skipped ? `, ${r.skipped} déjà occupé(s)` : ''}`)}><Icon name="sparkles" size={16} />Planifier 4 sem.</button>
      </div>
      <div className="cal card">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mois précédent"><Icon name="left" /></button>
          <h2 className="cap">{title}</h2>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Mois suivant"><Icon name="right" /></button>
        </div>
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
                  {x.workouts.map((w) => <i key={`w${w.id}`} className="cal-chip done">{w.name.replace('Jour ', 'J')}</i>)}
                  {x.events.filter((e) => e.type === 'workout' && e.status === 'planned').map((e) => (
                    <i key={e.id} className="cal-chip planned" draggable onDragStart={() => setDragId(e.id)} onDragEnd={() => setDragId(null)}>{(e.day_name || '').replace('Jour ', 'J')}</i>
                  ))}
                  {x.events.filter((e) => e.type === 'workout' && e.status === 'skipped').map((e) => <i key={e.id} className="cal-chip skipped">{(e.day_name || '').replace('Jour ', 'J')}</i>)}
                  {x.cardio.length > 0 ? <i className="cal-dot mint" /> : x.events.some((e) => e.type === 'cardio' && e.status === 'planned') ? <i className="cal-dot ring-mint" /> : null}
                  {x.events.some((e) => e.type === 'rest') && !x.workouts.length && <i className="cal-rest">repos</i>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="legend small muted"><span><i className="cal-chip done">J1</i>faite</span><span><i className="cal-chip planned">J2</i>prévue</span><span><i className="cal-dot mint" />cardio</span><span className="hide-mobile">Glisse une séance prévue pour la déplacer</span></div>
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
          {!sel.workouts.length && !sel.cardio.length && !sel.events.length && <p className="muted">Rien de prévu ce jour-là.</p>}
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
          </div>}
        </>)}
      </Sheet>
    </Page>
  );
}
