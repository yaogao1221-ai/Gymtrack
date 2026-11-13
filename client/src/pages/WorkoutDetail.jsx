import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, Page, Card, Icon, Loading, ErrorBox, Confirm, NumInput, Field, useToast } from '../components/ui.jsx';
import { patch, del } from '../lib/api.js';
import { fmtDay, dur, n0 } from '../lib/format.js';

export default function WorkoutDetail() {
  const { id } = useParams(); const nav = useNavigate(); const toast = useToast();
  const { data: w, error, reload, setData } = useApi(`/workouts/${id}`);
  const [edit, setEdit] = useState(false); const [confirm, setConfirm] = useState(false);
  if (error && !w) return <ErrorBox error={error} retry={reload} />;
  if (!w) return <Loading />;
  const saveSet = async (s, k, v) => { try { setData(await patch(`/workouts/${w.id}/sets/${s.id}`, { [k]: v })); } catch (e) { toast(e.message, 'err'); } };
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
      {w.exercises.map((ex) => (
        <Card key={`${ex.position}-${ex.exercise_id}`} title={ex.name}>
          <table className="sets-table"><thead><tr><th>Série</th><th>{ex.kind === 'assisted' ? 'Assistance' : 'Charge'}</th><th>Reps</th></tr></thead>
            <tbody>{ex.sets.map((s) => (
              <tr key={s.id}><td>{s.set_index}</td>
                <td>{edit ? <Cell value={s.weight} onSave={(v) => saveSet(s, 'weight', v)} /> : `${s.weight ?? 'PDC'} ${s.weight != null ? s.weight_unit : ''}`}</td>
                <td>{edit ? <Cell value={s.reps} onSave={(v) => saveSet(s, 'reps', v == null ? null : Math.round(v))} /> : <>{s.reps ?? '—'}{s.target_reps && s.reps < s.target_reps ? <span className="warn-text small"> / {s.target_reps}</span> : null}</>}</td></tr>
            ))}</tbody></table>
        </Card>
      ))}
      <Card title="Notes">
        {edit ? (<>
          <Field label={`Effort ressenti : ${w.rpe ?? '—'}/10`}><input type="range" min="1" max="10" defaultValue={w.rpe ?? 7} onMouseUp={(e) => saveMeta({ rpe: Number(e.target.value) })} onTouchEnd={(e) => saveMeta({ rpe: Number(e.target.value) })} /></Field>
          <textarea rows={3} defaultValue={w.notes || ''} onBlur={(e) => saveMeta({ notes: e.target.value })} />
        </>) : <p className={w.notes ? '' : 'muted'}>{w.notes || 'Aucune note.'}</p>}
      </Card>
      <button className="btn ghost danger-text block" onClick={() => setConfirm(true)}><Icon name="trash" size={16} />Supprimer cette séance</button>
      <Confirm open={confirm} onClose={() => setConfirm(false)} danger title="Supprimer la séance ?" confirmLabel="Supprimer" text="Toutes ses séries seront supprimées de l’historique et des statistiques."
        onConfirm={async () => { try { await del(`/workouts/${w.id}`); toast('Séance supprimée'); nav('/', { replace: true }); } catch (e) { toast(e.message, 'err'); } }} />
    </Page>
  );
}

function Cell({ value, onSave }) {
  const [v, setV] = useState(value);
  return <NumInput className="cell" value={v} onChange={setV} onBlur={(e) => { const t = e.target.value.replace(',', '.'); const n = t === '' ? null : Number(t); if (n !== value && (n == null || !Number.isNaN(n))) onSave(n); }} />;
}
