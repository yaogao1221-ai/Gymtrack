import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApi, Page, Card, Icon, Loading, ErrorBox, Confirm, NumInput, Field, useToast } from '../components/ui.jsx';
import { patch, del, post } from '../lib/api.js';
import ExercisePicker from '../components/ExercisePicker.jsx';
import { fmtDay, dur, n0 } from '../lib/format.js';

export default function WorkoutDetail() {
  const { id } = useParams(); const nav = useNavigate(); const toast = useToast(); const [sp] = useSearchParams();
  const { data: w, error, reload, setData } = useApi(`/workouts/${id}`);
  const [edit, setEdit] = useState(false); const [confirm, setConfirm] = useState(false); const [picker, setPicker] = useState(null); const [rmEx, setRmEx] = useState(null);
  if (error && !w) return <ErrorBox error={error} retry={reload} />;
  if (!w) return <Loading />;
  const saveSet = async (s, k, v) => { try { setData(await patch(`/workouts/${w.id}/sets/${s.id}`, { [k]: v })); } catch (e) { toast(e.message, 'err'); } };
  const run = async (fn) => { try { setData(await fn()); } catch (e) { toast(e.message, 'err'); } };
  const pick = (e) => {
    const p = picker; setPicker(null);
    if (p.ex) run(() => patch(`/workouts/${w.id}/exercises`, { position: p.ex.position, exercise_id: p.ex.exercise_id, new_exercise_id: e.id })).then(() => toast(`Remplacé par ${e.name} dans l’historique`));
    else run(() => post(`/workouts/${w.id}/sets`, { exercise_id: e.id, weight: null, reps: null })).then(() => toast(`${e.name} ajouté : renseigne la charge et les reps`));
  };
  const saveMeta = async (body) => { try { setData(await patch(`/workouts/${w.id}`, body)); } catch (e) { toast(e.message, 'err'); } };
  return (
    <Page title={w.name} subtitle={fmtDay(w.date)} back={() => nav(-1)}
      actions={<button className={`btn sm ${edit ? 'primary' : ''}`} onClick={() => setEdit(!edit)}><Icon name={edit ? 'check' : 'edit'} size={16} />{edit ? 'OK' : 'Corriger'}</button>}>
      <div className="summary card"><div><b>{dur(w.duration_sec)}</b><span>durée</span></div><div><b>{w.sets_done}</b><span>séries</span></div><div><b>{n0(w.volume_lbs)}</b><span>lbs soulevées</span></div><div><b>{w.rpe ?? '—'}</b><span>RPE</span></div></div>
      {w.review && (w.review.records.length > 0 || w.review.compare || w.review.first_time) && (
        <Card title="Bilan de la séance" icon="trophy" className="review-card">
          {w.review.records.length > 0 && <ul className="plain-list">{w.review.records.map((r) => (
            <li key={r.name}><Icon name="trophy" size={16} className="gold" /><span className="grow"><b>{r.name}</b></span><span className="mono small">{r.type === '1rm' ? `1RM estimé ${r.value.toLocaleString('fr-FR')} ${r.unit}` : r.type === 'assistance' ? `${r.value} ${r.unit} d’assistance` : `${r.value} ${r.unit} × ${r.reps}`}</span></li>
          ))}</ul>}
          {w.review.records.length === 0 && <p className="small muted">Pas de record cette fois : la régularité fait la progression.</p>}
          {w.review.compare && <div className="review-cmp">
            <div><b className={w.review.compare.volume_delta >= 0 ? 'ok-text' : 'warn-text'}>{w.review.compare.volume_delta > 0 ? '+' : ''}{n0(w.review.compare.volume_delta)}</b><span>lbs de volume</span></div>
            <div><b>{w.review.compare.sets_delta > 0 ? '+' : ''}{w.review.compare.sets_delta}</b><span>séries</span></div>
            <div><b>{w.review.compare.duration_delta > 0 ? '+' : ''}{Math.round(w.review.compare.duration_delta / 60)} min</b><span>durée</span></div>
          </div>}
          {w.review.compare && <p className="muted small">Comparé à ta dernière séance « {w.name} » du {fmtDay(w.review.compare.date)}.</p>}
          {w.review.first_time && <p className="muted small">Première fois que tu fais cette séance : elle sert de référence pour la prochaine.</p>}
        </Card>
      )}
      {sp.get('debrief') && !edit && <Debrief w={w} />}
      {w.exercises.map((ex) => (
        <Card key={`${ex.position}-${ex.exercise_id}`} title={ex.name}
          action={edit ? <button className="btn xs ghost" onClick={() => setPicker({ ex, title: `Changer ${ex.name}` })}><Icon name="skip" size={14} />Changer</button> : null}>
          <table className="sets-table"><thead><tr><th>Série</th><th>{ex.kind === 'assisted' ? 'Assistance' : 'Charge'}</th><th>Reps</th>{edit && <th />}</tr></thead>
            <tbody>{ex.sets.map((s) => (
              <tr key={s.id}><td>{s.set_index}</td>
                <td>{edit ? <Cell value={s.weight} onSave={(v) => saveSet(s, 'weight', v)} /> : `${s.weight ?? 'PDC'} ${s.weight != null ? s.weight_unit : ''}`}</td>
                <td>{edit ? <Cell value={s.reps} onSave={(v) => saveSet(s, 'reps', v == null ? null : Math.round(v))} /> : <>{s.reps ?? '—'}{s.target_reps && s.reps < s.target_reps ? <span className="warn-text small"> / {s.target_reps}</span> : null}</>}</td>
                {edit && <td><button className="icon-btn sm" aria-label="Supprimer la série" onClick={() => (ex.sets.length > 1 ? run(() => del(`/workouts/${w.id}/sets/${s.id}`)) : setRmEx(ex))}><Icon name="trash" size={15} /></button></td>}</tr>
            ))}</tbody></table>
          {edit && <div className="row gap-s wrap mt-s"><button className="btn xs ghost" onClick={() => run(() => post(`/workouts/${w.id}/sets`, { exercise_id: ex.exercise_id, position: ex.position }))}><Icon name="plus" size={14} />Série</button>
            <button className="btn xs ghost danger-text" onClick={() => setRmEx(ex)}>Retirer l’exercice</button></div>}
        </Card>
      ))}
      {edit && <button className="btn block dashed" onClick={() => setPicker({ title: 'Ajouter un exercice' })}><Icon name="plus" size={16} />Ajouter un exercice oublié</button>}
      <Card title="Notes">
        {edit ? (<>
          <Field label={`Effort ressenti : ${w.rpe ?? '—'}/10`}><input type="range" min="1" max="10" defaultValue={w.rpe ?? 7} onMouseUp={(e) => saveMeta({ rpe: Number(e.target.value) })} onTouchEnd={(e) => saveMeta({ rpe: Number(e.target.value) })} /></Field>
          <textarea rows={3} defaultValue={w.notes || ''} onBlur={(e) => saveMeta({ notes: e.target.value })} />
        </>) : <p className={w.notes ? '' : 'muted'}>{w.notes || 'Aucune note.'}</p>}
      </Card>
      <button className="btn ghost danger-text block" onClick={() => setConfirm(true)}><Icon name="trash" size={16} />Supprimer cette séance</button>
      <ExercisePicker open={!!picker} onClose={() => setPicker(null)} title={picker?.title} like={picker?.ex} onPick={pick} />
      <Confirm open={!!rmEx} onClose={() => setRmEx(null)} danger title={`Retirer ${rmEx?.name || ''} ?`} confirmLabel="Retirer" text="Ses séries seront retirées de cette séance, de l’historique et des statistiques."
        onConfirm={() => run(() => post(`/workouts/${w.id}/exercises/remove`, { position: rmEx.position, exercise_id: rmEx.exercise_id }))} />
      <Confirm open={confirm} onClose={() => setConfirm(false)} danger title="Supprimer la séance ?" confirmLabel="Supprimer" text="Toutes ses séries seront supprimées de l’historique et des statistiques."
        onConfirm={async () => { try { await del(`/workouts/${w.id}`); toast('Séance supprimée'); nav('/', { replace: true }); } catch (e) { toast(e.message, 'err'); } }} />
    </Page>
  );
}

function Cell({ value, onSave }) {
  const [v, setV] = useState(value);
  return <NumInput className="cell" value={v} onChange={setV} onBlur={(e) => { const t = e.target.value.replace(',', '.'); const n = t === '' ? null : Number(t); if (n !== value && (n == null || !Number.isNaN(n))) onSave(n); }} />;
}

// Débrief du coach : muscles travaillés, ce qui change la prochaine fois (à valider), prochaine séance
const MUS = { pectoraux: 'Pectoraux', epaules_ant: 'Épaules avant', epaules_lat: 'Épaules latérales', epaules_post: 'Épaules arrière', triceps: 'Triceps', biceps: 'Biceps', avant_bras: 'Avant-bras',
  dos_largeur: 'Grand dorsal', dos_epaisseur: 'Milieu du dos', trapezes: 'Trapèzes', lombaires: 'Lombaires', abdominaux: 'Abdos', quadriceps: 'Quadriceps', ischios: 'Ischios', fessiers: 'Fessiers', adducteurs: 'Adducteurs', abducteurs: 'Abducteurs', mollets: 'Mollets' };
function Debrief({ w }) {
  const ana = useApi('/analysis'); const dash = useApi('/dashboard'); const toast = useToast();
  const [done, setDone] = useState({});
  const mus = {}; for (const ex of w.exercises) for (const [k, c] of Object.entries(ex.muscles || {})) mus[k] = (mus[k] || 0) + c * ex.sets.length;
  const top = Object.entries(mus).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]);
  const exIds = new Set(w.exercises.map((e) => e.exercise_id));
  const prog = (ana.data?.progression || []).filter((p) => exIds.has(p.exercise_id) && (!w.program_day_id || p.day_id === w.program_day_id));
  const next = prog.filter((p) => p.patch); const holds = prog.filter((p) => p.type === 'hold');
  const missed = w.exercises.filter((ex) => ex.sets.some((x) => x.target_reps && x.reps < x.target_reps - 1));
  const act = async (p, ok) => { try { await post(ok ? '/analysis/apply' : '/analysis/dismiss', { key: p.key }); setDone({ ...done, [p.key]: ok ? 'ok' : 'no' }); if (ok) toast('Programme mis à jour pour la prochaine fois'); } catch (e) { toast(e.message, 'err'); } };
  const n = dash.data?.next;
  return (
    <Card title="Débrief du coach" icon="chat" className="debrief">
      {top.length > 0 && <><h3>Muscles travaillés</h3><div className="db-mus">{top.map(([k, v]) => <span key={k}>{MUS[k] || k} <b>{Math.round(v * 10) / 10}</b></span>)}</div></>}
      <h3>La prochaine fois</h3>
      {!ana.data ? <p className="muted small">Calcul…</p> : next.length ? <ul className="db-next">{next.map((p) => (
        <li key={p.key} className={done[p.key] || ''}>
          <span className="grow"><b>{p.title}</b><br /><span className="muted small">{p.reason}</span></span>
          {p.patch && !done[p.key] && <span className="col gap-s"><button className="btn xs primary" onClick={() => act(p, true)}>Valider</button><button className="btn xs ghost" onClick={() => act(p, false)}>Non</button></span>}
          {done[p.key] === 'ok' && <Icon name="check" size={18} />}
        </li>))}</ul>
        : !holds.length && <p className="small">Rien à changer : garde les mêmes charges et vise toutes tes répétitions.</p>}
      {holds.length > 0 && <p className="small muted">On garde la charge sur {holds.map((p) => p.exercise).join(', ')}{holds.some((p) => p.key.endsWith(':pain')) ? ' (douleur suivie : technique parfaite, amplitude réduite si besoin)' : ' (récupération à surveiller)'}.</p>}
      {missed.length > 0 && <p className="small muted">Répétitions manquées sur {missed.map((e) => e.name).join(', ')} : si ça se répète à la prochaine séance, je te proposerai de baisser un peu.</p>}
      <h3>Ce soir</h3>
      <p className="small">Un repas avec 30 à 40 g de protéines et 7 à 9 h de sommeil{w.rpe >= 9 ? ' : séance très dure, demain repos ou cardio léger' : ''}.</p>
      {n && <p className="small">Prochaine séance : <b>{n.name}{n.focus ? ` · ${n.focus}` : ''}</b>{n.date ? ` le ${fmtDay(n.date)}` : ''}. <Link className="link" to="/">Accueil</Link></p>}
    </Card>
  );
}
