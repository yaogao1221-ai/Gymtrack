import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, Page, Card, Icon, Ring, Sheet, Field, Loading, ErrorBox, useToast } from '../components/ui.jsx';
import { post, patch, put, today } from '../lib/api.js';
import { DAYS, fmtDate } from '../lib/format.js';

const SEV = { important: ['Important', 'danger'], attention: ['À revoir', 'warn'], info: ['Info', 'info'], ok: ['OK', 'ok'] };
const CAT = { volume: 'Volume', redondance: 'Redondance', desequilibre: 'Équilibre', repartition: 'Répartition', douleur: 'Douleur', recuperation: 'Récupération', historique: 'Historique' };
const STATUS = { absent: ['Absent', 'danger'], faible: ['Faible', 'warn'], limite: ['Limite', 'info'], optimal: ['Optimal', 'ok'], eleve: ['Élevé', 'info'] };

export default function Coach() {
  const { data: a, error, reload } = useApi('/analysis');
  const pains = useApi('/pains');
  const [pain, setPain] = useState(null); const [busy, setBusy] = useState(null); const toast = useToast();
  if (error && !a) return <ErrorBox error={error} retry={reload} />;
  if (!a) return <Loading />;
  const act = async (fn, msg, key) => { setBusy(key); try { await fn(); toast(msg); await reload(); pains.reload(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); } };
  const progression = a.progression.filter((p) => p.type !== 'info');
  const setup = a.progression.filter((p) => p.type === 'info');
  const maxSets = Math.max(...a.volume.muscles.map((m) => Math.max(m.sets, m.opt_high)), 1);
  const activePains = (pains.data?.reports || []).filter((p) => !p.resolved);
  return (
    <Page title="Analyse" subtitle="Analyse de ton programme, de ta récupération et de ta progression">
      <div className="grid-2col">
        <Card title="Récupération estimée" icon="bolt">
          <div className="row gap">
            <Ring value={a.recovery.score / 100} size={84} stroke={9} label={a.recovery.score} color={a.recovery.score >= 75 ? 'var(--accent2)' : a.recovery.score >= 55 ? 'var(--warn)' : 'var(--danger)'} />
            <div><b className="big">{a.recovery.label}</b><ul className="factors">{a.recovery.factors.map((f, i) => <li key={i} className={f.impact < 0 ? 'neg' : ''}>{f.text}{f.impact ? ` (${f.impact})` : ''}</li>)}</ul></div>
          </div>
          <div className="pains">
            {activePains.map((p) => (
              <div key={p.id} className="pain-row"><span><b>{pains.data.areas[p.area]}</b> {p.intensity}/10 · {fmtDate(p.date)}</span>
                <button className="btn xs ghost" onClick={() => act(() => patch(`/pains/${p.id}`, { resolved: true }), 'Douleur marquée comme résolue', `p${p.id}`)}>Résolue</button></div>
            ))}
            <button className="btn sm" onClick={() => setPain({ area: 'epaule', intensity: 3, date: today(), notes: '' })}><Icon name="plus" size={14} />Signaler une douleur</button>
          </div>
        </Card>

        <Card title="Progression proposée" icon="up">
          {progression.length ? <ul className="recs">{progression.map((p) => (
            <li key={p.key} className={`rec ${p.type}`}>
              <div className="rec-head"><b>{p.title}</b><span className="muted small">{p.day_name}</span></div>
              <p className="small">{p.reason}</p>
              {p.patch ? <div className="row gap-s"><button className="btn xs primary" disabled={busy === p.key} onClick={() => act(() => post('/analysis/apply', { key: p.key }), 'Programme mis à jour', p.key)}><Icon name="check" size={14} />Valider : {p.proposed_label}</button>
                <button className="btn xs ghost" onClick={() => act(() => post('/analysis/dismiss', { key: p.key }), 'Proposition ignorée', p.key)}>Ignorer</button></div>
                : <button className="btn xs ghost" onClick={() => act(() => post('/analysis/dismiss', { key: p.key }), 'Masqué', p.key)}>Compris</button>}
            </li>
          ))}</ul> : <p className="muted small">Aucune modification proposée pour l’instant. Le coach propose une hausse quand toutes les séries prévues sont réussies avec une bonne technique, et ne change jamais rien sans ta validation.</p>}
          {setup.length > 0 && <details className="mt-s"><summary className="small muted">{setup.length} exercice(s) sans charge définie</summary><ul className="small muted">{setup.map((s) => <li key={s.key}>{s.exercise} ({s.day_name})</li>)}</ul></details>}
        </Card>
      </div>

      <Card title="Analyse du programme" icon="brain">
        <ul className="findings">{a.findings.map((f) => (
          <li key={f.id} className={`finding ${SEV[f.severity][1]}`}>
            <div className="row gap-s"><span className={`badge ${SEV[f.severity][1]}`}>{SEV[f.severity][0]}</span><span className="muted small">{CAT[f.category]}</span></div>
            <b>{f.title}</b><p className="small">{f.detail}</p>
          </li>
        ))}</ul>
      </Card>

      <div className="grid-2col">
        <Card title="Volume hebdomadaire par muscle" icon="chart">
          <p className="muted small">Séries effectives / semaine (exercice principal = 1, muscle secondaire = 0,5). Zone verte : volume conseillé pour ton niveau ({a.level}).</p>
          <ul className="vol-list">{a.volume.muscles.map((m) => (
            <li key={m.key}>
              <span className="vol-name">{m.label}</span>
              <span className="vol-bar"><i className="zone" style={{ left: `${(m.opt_low / maxSets) * 100}%`, width: `${((m.opt_high - m.opt_low) / maxSets) * 100}%` }} /><i className={`fill ${STATUS[m.status][1]}`} style={{ width: `${(m.sets / maxSets) * 100}%` }} /></span>
              <span className={`vol-val ${STATUS[m.status][1]}`}>{m.sets}</span>
            </li>
          ))}</ul>
          <p className="muted small mt-s">Total : {a.volume.total_sets} séries / semaine · {a.volume.per_day.map((d) => `${d.name.replace('Jour ', 'J')} ≈ ${d.est_minutes} min`).join(' · ')}</p>
        </Card>

        <Card title="Répartition & jours de récupération" icon="calendar">
          <div className="week-row">{DAYS.map(([k, l]) => { const c = a.schedule.current[k]; const d = a.volume.per_day.find((x) => x.code === c); return <div key={k} className={`wd ${c === 'rest' ? 'rest' : d?.lower ? 'lower' : 'upper'}`}><span>{l}</span><b>{c === 'rest' ? '—' : c.replace('D', 'J')}</b></div>; })}</div>
          {a.schedule.issues.length ? <ul className="small">{a.schedule.issues.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="small ok-text">Au moins 48 h entre deux sollicitations lourdes d’un même muscle, et des jours de repos bien placés.</p>}
          {a.schedule.proposed && (<>
            <h3 className="sub">Proposition</h3>
            <div className="week-row">{DAYS.map(([k, l]) => { const c = a.schedule.proposed[k]; return <div key={k} className={`wd ${c === 'rest' ? 'rest' : 'upper'}`}><span>{l}</span><b>{c === 'rest' ? '—' : c.replace('D', 'J')}</b></div>; })}</div>
            <button className="btn sm primary mt-s" onClick={() => act(() => put('/profile', { schedule: a.schedule.proposed }), 'Planning type mis à jour', 'sched')}>Appliquer ce planning</button>
          </>)}
          <p className="muted small mt-s">J = jour du programme. Vert : bas du corps. Modifie ton planning et tes disponibilités dans le <Link className="link" to="/profil">profil</Link>.</p>
        </Card>
      </div>

      {a.suggestions.length > 0 && <Card title="Exercices complémentaires suggérés" icon="plus">
        <ul className="recs">{a.suggestions.map((s) => (
          <li key={s.key} className="rec">
            <div className="rec-head"><b>{s.exercise}</b><span className="tag">{s.muscle}</span></div>
            <p className="small">{s.reason} Proposé : {s.sets} × {s.reps} en fin de {s.day_name}.{s.technique ? ` ${s.technique}` : ''}</p>
            <div className="row gap-s"><button className="btn xs primary" disabled={busy === s.key} onClick={() => act(() => post('/analysis/apply', { key: s.key }), 'Exercice ajouté au programme', s.key)}><Icon name="plus" size={14} />Ajouter au programme</button>
              <button className="btn xs ghost" onClick={() => act(() => post('/analysis/dismiss', { key: s.key }), 'Suggestion ignorée', s.key)}>Ignorer</button></div>
          </li>
        ))}</ul>
      </Card>}

      <Card title="Cardio" icon="heart" action={<Link className="link" to="/cardio">Voir le plan</Link>}>
        <p className="small">{a.cardio.rationale[0]} Semaine en cours : {a.cardio.weeks[0].sessions} × {a.cardio.weeks[0].minutes} min ({a.cardio.weeks[0].intensity}). Fait : {a.cardio.done_this_week.minutes} min.</p>
      </Card>
      <p className="muted small center">Recommandations basées sur des principes de coaching reconnus (volume, récupération, progression). Elles ne remplacent pas l’avis d’un professionnel de santé en cas de douleur.</p>

      <Sheet open={!!pain} onClose={() => setPain(null)} title="Signaler une douleur"
        footer={<button className="btn primary" onClick={() => act(async () => { await post('/pains', pain); setPain(null); }, 'Douleur enregistrée : le coach adapte ses recommandations', 'pain')}>Enregistrer</button>}>
        {pain && (<>
          <Field label="Zone"><select value={pain.area} onChange={(e) => setPain({ ...pain, area: e.target.value })}>{Object.entries(pains.data?.areas || {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label={`Intensité : ${pain.intensity}/10`}><input type="range" min="1" max="10" value={pain.intensity} onChange={(e) => setPain({ ...pain, intensity: Number(e.target.value) })} /></Field>
          <Field label="Date"><input type="date" value={pain.date} onChange={(e) => setPain({ ...pain, date: e.target.value })} /></Field>
          <Field label="Description"><textarea rows={2} value={pain.notes} onChange={(e) => setPain({ ...pain, notes: e.target.value })} placeholder="Pendant quel exercice, type de douleur…" /></Field>
        </>)}
      </Sheet>
    </Page>
  );
}
