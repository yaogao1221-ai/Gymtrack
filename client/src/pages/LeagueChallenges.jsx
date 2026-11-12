import { useState } from 'react';
import { Card, Icon, Sheet, Field, Segmented, NumInput, useToast } from '../components/ui.jsx';
import { Avatar } from './LeagueSocial.jsx';
import { createChallenge, hideChallenge, totalPoints } from '../lib/league.js';

export const METRICS = {
  steps: { label: 'Pas', unit: 'pas', value: (p) => p.steps || 0 },
  km: { label: 'Kilomètres de cardio', unit: 'km', value: (p) => p.stats?.km || 0 },
  workouts: { label: 'Séances de muscu', unit: 'séances', value: (p) => p.stats?.workouts || 0 },
  sets: { label: 'Séries validées', unit: 'séries', value: (p) => p.stats?.sets || 0 },
  cardio_min: { label: 'Minutes de cardio', unit: 'min', value: (p) => p.stats?.cardio_min || 0 },
  points: { label: 'Points de ligue', unit: 'pts', value: (p) => totalPoints(p.stats, p.steps) },
};
const TEMPLATES = {
  week: [['50 000 pas dans la semaine', 'steps', 50000], ['4 séances de muscu', 'workouts', 4], ['15 km de cardio', 'km', 15], ['60 séries validées', 'sets', 60], ['150 min de cardio', 'cardio_min', 150]],
  month: [['250 000 pas dans le mois', 'steps', 250000], ['16 séances de muscu', 'workouts', 16], ['60 km de cardio', 'km', 60], ['600 min de cardio', 'cardio_min', 600], ['500 points', 'points', 500]],
};
const fmt = (v) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function Challenges({ board, me, list, keys, onChanged, compact }) {
  const toast = useToast(); const [create, setCreate] = useState(false);
  const cur = list.filter((c) => c.period === keys.week || c.period === keys.month);
  const past = list.filter((c) => c.period === keys.prevWeek || c.period === keys.prevMonth);
  const hide = async (id) => { try { await hideChallenge(id); toast('Défi retiré'); onChanged(); } catch (e) { toast(e.message, 'err'); } };
  const rows = (c) => board.members.map((m) => {
    const v = METRICS[c.metric].value(m.periods?.[c.period] || {});
    return { m, v, pct: Math.min(100, (v / c.target) * 100), done: v >= c.target };
  }).sort((a, b) => b.v - a.v);
  return (
    <Card title="Défis" icon="target" action={<button className="btn xs primary" onClick={() => setCreate(true)}><Icon name="plus" size={12} />Lancer un défi</button>}>
      {!cur.length && <p className="muted small">Aucun défi en cours. Lance-en un : tout le monde le voit et chacun avance avec ses propres chiffres.</p>}
      {cur.map((c) => {
        const r = rows(c); const mine = r.find((x) => x.m.id === me);
        return (
          <div key={c.id} className="challenge">
            <div className="challenge-head">
              <span className="grow"><b>{c.title}</b><span className="muted small">{c.kind === 'week' ? 'Cette semaine' : 'Ce mois'} · objectif {fmt(c.target)} {METRICS[c.metric].unit}{mine ? ` · toi ${fmt(mine.v)}` : ''}</span></span>
              {c.creator === me && <button className="icon-btn sm" aria-label="Retirer le défi" onClick={() => hide(c.id)}><Icon name="trash" size={14} /></button>}
            </div>
            <ul className="challenge-rows">
              {(compact ? r.slice(0, 3) : r).map(({ m, v, pct, done }) => (
                <li key={m.id} className={m.id === me ? 'me' : ''}>
                  <Avatar member={m} size={26} />
                  <span className="name small">{m.pseudo}</span>
                  <div className="bar"><span style={{ width: `${pct}%` }} className={done ? 'done' : ''} /></div>
                  <span className="mono small val">{done ? <Icon name="check" size={14} /> : `${Math.round(pct)} %`}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {!compact && past.length > 0 && <>
        <p className="muted small mt">Défis terminés</p>
        <ul className="plain-list">
          {past.map((c) => { const winners = rows(c).filter((x) => x.done); return <li key={c.id}><span className="grow small">{c.title}</span><span className="small">{winners.length ? winners.map((x) => x.m.pseudo).join(', ') : 'personne'}</span></li>; })}
        </ul>
      </>}
      <CreateSheet open={create} onClose={() => setCreate(false)} keys={keys} onCreated={() => { setCreate(false); onChanged(); }} />
    </Card>
  );
}

function CreateSheet({ open, onClose, keys, onCreated }) {
  const toast = useToast(); const [kind, setKind] = useState('week'); const [f, setF] = useState({ title: '', metric: 'steps', target: null }); const [busy, setBusy] = useState(false);
  const ok = f.title.trim().length >= 2 && Number(f.target) > 0;
  const go = async () => {
    setBusy(true);
    try { await createChallenge(f.title.trim(), f.metric, Number(f.target), kind, kind === 'week' ? keys.week : keys.month); toast('Défi lancé à toute la ligue'); setF({ title: '', metric: 'steps', target: null }); onCreated(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Lancer un défi" footer={<button className="btn primary block" disabled={!ok || busy} onClick={go}>{busy ? '…' : 'Lancer le défi'}</button>}>
      <Segmented value={kind} onChange={setKind} options={[['week', 'Cette semaine'], ['month', 'Ce mois']]} />
      <Field label="Idées" className="mt">
        <div className="chips">{TEMPLATES[kind].map(([t, m, v]) => <button key={t} className={`chip ${f.title === t ? 'on' : ''}`} onClick={() => setF({ title: t, metric: m, target: v })}>{t}</button>)}</div>
      </Field>
      <Field label="Nom du défi"><input value={f.title} maxLength={60} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex. : 10 000 pas par jour" /></Field>
      <Field label="Ce qui compte">
        <select value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>{Object.entries(METRICS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</select>
      </Field>
      <Field label={`Objectif (${METRICS[f.metric].unit})`}><NumInput value={f.target} onChange={(v) => setF({ ...f, target: v })} placeholder="50000" /></Field>
      <p className="muted small">Le défi utilise les chiffres que chacun partage déjà avec la ligue : séances, séries, cardio et pas.</p>
    </Sheet>
  );
}
