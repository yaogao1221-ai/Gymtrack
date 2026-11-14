// Compétitions de la ligue (v9) : liste, détail, création guidée. Les scores, classements et résultats viennent de la base
// (fonctions ligue_comp*), jamais calculés ici : l'appli affiche, elle ne décide pas.
import { useEffect, useMemo, useState } from 'react';
import { Icon, Sheet, Field, Segmented, Confirm, Loading, NumInput, useToast } from '../components/ui.jsx';
import { Avatar } from './LeagueSocial.jsx';
import {
  getComp, createComp, respondComp, inviteComp, cancelComp,
  COMP_TYPES, COMP_BY_ID, DURATIONS, STATUS_LABEL, timeLeft, progressOf, durationLabel, dayDiff,
} from '../lib/league.js';

const nf = (v, d = 0) => Number(v || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
const fmtD = (d) => new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const typeOf = (c) => COMP_BY_ID[c.metric] || COMP_TYPES[0];
const pseudo = (board, id) => board.members.find((m) => m.id === id)?.pseudo || 'Ancien membre';
const fmtScore = (c, v) => `${typeOf(c).fmt(v)} ${typeOf(c).unit}`;

// ---------- Carte d'une compétition (liste et accueil) ----------
export function CompCard({ c, board, me, onOpen, wide }) {
  const t = typeOf(c); const p = progressOf(c);
  const team = c.mode === 'team';
  const goalPct = team && c.goal ? Math.min(1, c.total / c.goal) : null;
  return (
    <button className={`comp-card tone-${t.tone} st-${c.status} ${wide ? 'wide' : ''}`} onClick={() => onOpen(c)}>
      <span className="comp-top"><span className="comp-ico"><Icon name={t.icon} size={18} /></span>
        <span className="comp-kind">{team ? 'Défi collectif' : t.label} · {durationLabel(c)}</span>
        <span className={`comp-status s-${c.status}`}>{c.my_state === 'invited' ? 'Invitation' : STATUS_LABEL[c.status]}</span></span>
      <b className="comp-title">{c.title}</b>
      {team
        ? <span className="comp-line"><b className="mono">{t.fmt(c.total)}</b> / {t.fmt(c.goal)} {t.unit} ensemble</span>
        : c.status === 'upcoming' ? <span className="comp-line">{c.joined} inscrit{c.joined > 1 ? 's' : ''} · {fmtD(c.start)}</span>
          : <span className="comp-line">{c.leader && c.leader.score > 0 ? <>1<sup>er</sup> {pseudo(board, c.leader.member)} · <b className="mono">{fmtScore(c, c.leader.score)}</b></> : 'Personne n’a encore marqué'}</span>}
      {c.me && !team && c.status !== 'upcoming' && <span className="comp-me">Toi : {c.me.rank}<sup>{c.me.rank === 1 ? 'er' : 'e'}</sup> · {fmtScore(c, c.me.score)}</span>}
      <span className="comp-prog"><span style={{ width: `${Math.round((goalPct ?? p) * 100)}%` }} /></span>
      <span className="comp-foot"><span>{timeLeft(c)}</span><span><Icon name="user" size={12} />{c.joined}/{c.max_n}</span></span>
    </button>
  );
}

// ---------- Liste : En cours, À venir, Terminées, Mes compétitions ----------
export function CompList({ data, board, me, onOpen, onCreate }) {
  const [tab, setTab] = useState('live');
  const list = data?.list || [];
  const groups = {
    live: list.filter((c) => c.status === 'active' || c.status === 'closing').sort((a, b) => a.end.localeCompare(b.end)),
    next: list.filter((c) => c.status === 'upcoming').sort((a, b) => a.start.localeCompare(b.start)),
    done: list.filter((c) => c.status === 'finished'),
    mine: list.filter((c) => c.my_state === 'joined' || c.my_state === 'invited' || c.creator === me),
  };
  const shown = groups[tab];
  return (
    <>
      <div className="comp-head">
        <div><h2>Compétitions</h2><p className="muted small">{groups.live.length} en cours · {groups.next.length} à venir · {groups.done.length} terminée{groups.done.length > 1 ? 's' : ''}</p></div>
        <button className="btn primary" onClick={onCreate}><Icon name="plus" size={16} />Créer</button>
      </div>
      <Segmented value={tab} onChange={setTab} options={[['live', `En cours${groups.live.length ? ` (${groups.live.length})` : ''}`], ['next', 'À venir'], ['done', 'Terminées'], ['mine', 'Les miennes']]} />
      {!shown.length ? <div className="comp-empty"><Icon name="trophy" size={28} /><p>{tab === 'live' ? 'Aucune compétition en cours.' : tab === 'next' ? 'Rien de prévu pour l’instant.' : tab === 'done' ? 'Aucun résultat encore.' : 'Tu ne participes à aucune compétition.'}</p>
        <button className="btn sm" onClick={onCreate}><Icon name="plus" size={14} />Lancer une compétition</button></div>
        : <div className="comp-grid">{shown.map((c) => <CompCard key={c.id} c={c} board={board} me={me} onOpen={onOpen} wide />)}</div>}
    </>
  );
}

// ---------- Détail ----------
export function CompSheet({ id, onClose, board, me, onChanged }) {
  const toast = useToast();
  const [c, setC] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const [inv, setInv] = useState(null); const [cancel, setCancel] = useState(false);
  const load = () => { setErr(null); getComp(id).then(setC).catch((e) => setErr(e.message)); };
  useEffect(() => { if (id) { setC(null); load(); } }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn, msg) => { setBusy(true); try { await fn(); if (msg) toast(msg); load(); onChanged?.(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const t = c ? typeOf(c) : null;
  const joined = c?.my_state === 'joined';
  const canJoin = c && !joined && ['upcoming', 'active'].includes(c.status) && (c.scope === 'league' || c.my_state === 'invited' || c.my_state === 'declined' || c.my_state === 'left') && c.joined < c.max_n;
  const others = c ? board.members.filter((m) => !c.participants.some((p) => p.member === m.id && ['joined', 'invited'].includes(p.state))) : [];
  return (
    <Sheet open={!!id} onClose={onClose} title={c?.title || 'Compétition'}
      footer={c && (<div className="row gap-s">
        {canJoin && <button className="btn primary grow" disabled={busy} onClick={() => act(() => respondComp(c.id, 'join'), 'Tu participes !')}><Icon name="check" size={16} />{c.my_state === 'invited' ? 'Accepter' : 'Rejoindre'}</button>}
        {c.my_state === 'invited' && <button className="btn" disabled={busy} onClick={() => act(() => respondComp(c.id, 'decline'), 'Invitation refusée')}>Refuser</button>}
        {joined && ['upcoming', 'active'].includes(c.status) && <button className="btn grow" onClick={() => setInv([])}><Icon name="user" size={16} />Inviter</button>}
      </div>)}>
      {err && <p className="warn-text small">{err}</p>}
      {!c ? (!err && <Loading />) : (<>
        <div className={`comp-hero tone-${t.tone}`}>
          <span className="comp-ico big"><Icon name={t.icon} size={26} /></span>
          <div className="grow"><span className="comp-kind">{c.mode === 'team' ? 'Défi collectif' : t.label} · {durationLabel(c)}</span>
            <b className="comp-hero-title">{c.title}</b>
            <span className="small">{fmtD(c.start)} → {fmtD(c.end)} · {timeLeft(c)}</span></div>
        </div>
        <div className="comp-prog big"><span style={{ width: `${Math.round((c.mode === 'team' && c.goal ? Math.min(1, c.total / c.goal) : progressOf(c)) * 100)}%` }} /></div>
        {c.description && <p className="small mt-s">{c.description}</p>}

        {c.mode === 'team' && <div className="comp-team">
          <b className="num-l">{t.fmt(c.total)}<span className="unit-s"> / {t.fmt(c.goal)} {t.unit}</span></b>
          <span className="small">{c.status === 'finished' ? (c.success ? 'Objectif atteint ensemble, bravo à tous !' : 'Objectif manqué de peu, on remet ça ?') : `${Math.round(Math.min(1, c.total / c.goal) * 100)} % de l’objectif collectif`}</span>
        </div>}

        {c.status === 'finished' && c.mode === 'solo' && c.winner && <div className="comp-winner"><Icon name="trophy" size={22} /><span><b>{pseudo(board, c.winner)}</b> remporte la compétition</span></div>}

        <Standings c={c} board={board} me={me} />
        {c.series?.length > 1 && <Race c={c} board={board} me={me} />}

        <h4 className="h-sub">Règles</h4>
        <ul className="comp-rules small">
          <li>{t.rule}</li>
          {c.metric === 'goal_days' && <li>Objectif du jour : {nf(c.goal)} pas.</li>}
          <li>{c.mode === 'team' ? 'Tout le monde additionne ses résultats pour atteindre l’objectif commun.' : 'Le plus haut total à la fin gagne. Égalité = même place.'}</li>
          <li>Seules tes vraies données comptent : séances validées, cardio enregistré, pas de l’app Santé. Les synchros en retard sont prises en compte jusqu’au lendemain de la fin, puis le résultat est figé et n’est plus jamais modifié.</li>
          <li>{c.scope === 'league' ? 'Ouverte à toute la ligue' : 'Sur invitation'} · {c.max_n} participants au maximum.</li>
        </ul>

        {c.events?.length > 0 && <><h4 className="h-sub">Événements</h4>
          <ul className="comp-events small">{c.events.map((e, i) => <li key={i}><Icon name={e.kind === 'comp_finished' ? 'trophy' : 'flame'} size={14} />
            <span className="grow">{e.kind === 'comp_created' ? `${pseudo(board, e.member)} a lancé la compétition` : e.kind === 'comp_finished' ? (e.member ? `${pseudo(board, e.member)} a gagné` : 'Compétition terminée') : e.kind}</span>
            <span className="muted xs">{new Date(e.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></li>)}</ul></>}

        <h4 className="h-sub">Participants</h4>
        <ul className="comp-people">{c.participants.map((p) => <li key={p.member}><Avatar member={board.members.find((m) => m.id === p.member) || { pseudo: '?' }} size={28} /><span className="grow">{pseudo(board, p.member)}{p.member === me && <span className="muted"> (toi)</span>}</span>
          <span className={`tag ${p.state === 'joined' ? 'good' : ''}`}>{{ joined: 'Inscrit', invited: 'Invité', declined: 'A refusé', left: 'Parti' }[p.state]}</span></li>)}</ul>

        <div className="row gap-s wrap mt">
          {joined && ['upcoming', 'active'].includes(c.status) && c.creator !== me && <button className="btn xs ghost" onClick={() => act(() => respondComp(c.id, 'leave'), 'Tu as quitté la compétition')}>Quitter la compétition</button>}
          {(c.creator === me || board.members.find((m) => m.id === me)?.role === 'admin') && ['upcoming', 'active'].includes(c.status) && <button className="btn xs ghost" onClick={() => setCancel(true)}>Annuler la compétition</button>}
        </div>
      </>)}

      <Sheet open={inv != null} onClose={() => setInv(null)} title="Inviter des participants"
        footer={<button className="btn primary block" disabled={!inv?.length || busy} onClick={() => act(() => inviteComp(c.id, inv), `${inv.length} invitation${inv.length > 1 ? 's' : ''} envoyée${inv.length > 1 ? 's' : ''}`).then(() => setInv(null))}>Inviter</button>}>
        {!others.length ? <p className="muted small">Tous les membres de la ligue sont déjà inscrits ou invités.</p>
          : <ul className="comp-pick">{others.map((m) => <li key={m.id}><label><input type="checkbox" checked={inv?.includes(m.id) || false} onChange={(e) => setInv(e.target.checked ? [...inv, m.id] : inv.filter((x) => x !== m.id))} /><Avatar member={m} size={28} /><span>{m.pseudo}</span></label></li>)}</ul>}
      </Sheet>
      <Confirm open={cancel} onClose={() => setCancel(false)} danger title="Annuler la compétition ?" confirmLabel="Annuler la compétition"
        text="Possible seulement avant le début, ou si personne d’autre n’y participe. Les autres compétitions ne sont pas touchées." onConfirm={() => act(() => cancelComp(c.id), 'Compétition annulée').then(onClose)} />
    </Sheet>
  );
}

// Classement : podium distinctif, puis la liste avec écarts, évolution de place et dernière synchro
function Standings({ c, board, me }) {
  const rows = c.standings || [];
  if (!rows.length) return <p className="muted small mt">{c.status === 'upcoming' ? 'Le classement démarre le premier jour.' : 'Aucun participant inscrit.'}</p>;
  const lead = rows[0]?.score || 0; const t = typeOf(c);
  const top = rows.slice(0, 3);
  return (<>
    <h4 className="h-sub">{c.status === 'finished' ? 'Classement final' : 'Classement'}</h4>
    {c.mode === 'solo' && rows.length >= 2 && <div className="podium2">{[top[1], top[0], top[2]].map((r, i) => r ? (
      <div key={r.member} className={`pod p${[2, 1, 3][i]} ${r.member === me ? 'me' : ''}`}>
        <Avatar member={board.members.find((m) => m.id === r.member) || { pseudo: '?' }} size={[2, 1, 3][i] === 1 ? 56 : 44} />
        <b className="pod-name">{pseudo(board, r.member)}</b>
        <span className="pod-val mono">{t.fmt(r.score)}</span>
        <span className="pod-place">{r.rank}</span>
      </div>) : <div key={i} className="pod empty" />)}</div>}
    <ol className="standings">{rows.map((r, i) => {
      const gap = lead - r.score; const prev = rows[i - 1];
      const move = r.prev_rank ? r.prev_rank - r.rank : 0;
      return (<li key={r.member} className={r.member === me ? 'me' : ''}>
        <span className="st-rank">{r.rank}</span>
        <Avatar member={board.members.find((m) => m.id === r.member) || { pseudo: '?' }} size={32} />
        <span className="grow"><b>{pseudo(board, r.member)}</b>
          <span className="muted xs">{i === 0 ? (c.mode === 'team' ? 'Meilleur contributeur' : 'En tête') : prev ? `${t.fmt(prev.score - r.score)} derrière le ${prev.rank}e · ${t.fmt(gap)} du 1er` : ''}{r.synced ? ` · synchro ${new Date(r.synced).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ' · pas encore de données'}</span></span>
        {move !== 0 && <span className={`st-move ${move > 0 ? 'up' : 'down'}`}><Icon name={move > 0 ? 'up' : 'down'} size={12} />{Math.abs(move)}</span>}
        <span className="st-score mono">{t.fmt(r.score)}<span className="unit-s"> {t.unit}</span></span>
      </li>);
    })}</ol>
  </>);
}

// Course : cumul jour par jour (données réelles, une ligne par participant, la tienne en couleur)
function Race({ c, board, me }) {
  const ids = (c.standings || []).map((r) => r.member).slice(0, 6);
  const max = Math.max(1, ...c.series.flatMap((d) => ids.map((id) => d.v[id] || 0)));
  const W = 320; const H = 120; const n = c.series.length;
  const x = (i) => (i / Math.max(1, n - 1)) * (W - 8) + 4; const y = (v) => H - 6 - (v / max) * (H - 16);
  return (<>
    <h4 className="h-sub">Évolution</h4>
    <svg className="race" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution des scores">
      {ids.map((id) => <polyline key={id} className={id === me ? 'mine' : ''} points={c.series.map((d, i) => `${x(i)},${y(d.v[id] || 0)}`).join(' ')} />)}
    </svg>
    <div className="race-legend xs muted">{ids.map((id) => <span key={id} className={id === me ? 'mine' : ''}>{pseudo(board, id)}</span>)}</div>
  </>);
}

// ---------- Création guidée ----------
const STEPS = ['Type', 'Nom', 'Durée', 'Règles', 'Participants', 'Résumé'];
export function CreateComp({ open, onClose, board, me, today, onCreated }) {
  const toast = useToast();
  const blank = { metric: null, mode: 'solo', title: '', description: '', days: 7, start: today, custom: false, goal: null, max_n: 20, scope: 'league', invite: [] };
  const [f, setF] = useState(blank); const [step, setStep] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF({ ...blank, start: today }); setStep(0); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = f.metric ? COMP_BY_ID[f.metric] : null;
  const end = addD(f.start, Math.max(1, f.days) - 1);
  const others = board.members.filter((m) => m.id !== me);
  const suggest = useMemo(() => (t ? `${f.mode === 'team' ? 'Défi collectif' : 'Défi'} ${t.label.toLowerCase()} ${f.days === 1 ? '24 h' : `${f.days} jours`}` : ''), [t, f.mode, f.days]);
  const valid = [
    !!f.metric,
    f.title.trim().length >= 2,
    f.days >= 1 && f.days <= 90 && dayDiff(today, f.start) >= 0 && dayDiff(today, f.start) <= 60,
    (f.metric !== 'goal_days' || (f.goal >= 1000 && f.goal <= 40000)) && (f.mode !== 'team' || f.goal > 0),
    f.scope === 'league' || f.invite.length > 0,
    true,
  ];
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const pickType = (id, mode = 'solo') => { const tt = COMP_BY_ID[id]; setF((x) => ({ ...x, metric: id, mode, goal: mode === 'team' ? Math.round((tt.teamGoal || 100) * Math.max(1, board.members.length) / 4 * x.days / 7) : id === 'goal_days' ? 10000 : null, title: '' })); setStep(1); };
  const submit = async () => {
    setBusy(true);
    try {
      const id = await createComp({ title: f.title.trim(), description: f.description.trim(), metric: f.metric, mode: f.mode, goal: f.goal, start: f.start, end, max_n: f.max_n, scope: f.scope, invite: f.scope === 'invite' ? f.invite : f.invite });
      toast('Compétition créée : les autres compétitions continuent normalement'); onCreated(id);
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Nouvelle compétition"
      footer={<div className="row gap-s">
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}><Icon name="left" size={16} />Retour</button>}
        {step < 5 ? <button className="btn primary grow" disabled={!valid[step]} onClick={() => { if (step === 1 && !f.title.trim()) set('title', suggest); setStep(step + 1); }}>Continuer<Icon name="right" size={16} /></button>
          : <button className="btn primary grow" disabled={busy} onClick={submit}><Icon name="check" size={16} />Créer la compétition</button>}
      </div>}>
      <ol className="wiz-steps">{STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}><button disabled={i > step && !valid.slice(0, i).every(Boolean)} onClick={() => setStep(i)}>{i < step ? <Icon name="check" size={12} /> : i + 1}</button><span>{s}</span></li>)}</ol>

      {step === 0 && <>
        <p className="small muted">Que voulez-vous mesurer ? Seules les données réellement enregistrées comptent.</p>
        <div className="wiz-types">{COMP_TYPES.map((x) => <button key={x.id} className={`wiz-type tone-${x.tone} ${f.metric === x.id && f.mode === 'solo' ? 'on' : ''}`} onClick={() => pickType(x.id)}>
          <span className="comp-ico"><Icon name={x.icon} size={18} /></span><b>{x.label}</b><span className="xs muted">{x.rule.split('.')[0]}.</span></button>)}</div>
        <h4 className="h-sub">Défi collectif</h4>
        <p className="small muted">Tout le monde additionne ses résultats pour atteindre un objectif commun.</p>
        <div className="wiz-types">{COMP_TYPES.filter((x) => x.team).map((x) => <button key={x.id} className={`wiz-type tone-${x.tone} ${f.metric === x.id && f.mode === 'team' ? 'on' : ''}`} onClick={() => pickType(x.id, 'team')}>
          <span className="comp-ico"><Icon name="user" size={18} /></span><b>{x.label} ensemble</b></button>)}</div>
      </>}

      {step === 1 && <>
        <Field label="Nom de la compétition"><input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={suggest} maxLength={60} autoFocus /></Field>
        <div className="chips">{[suggest, f.metric === 'steps' ? 'Le roi de la marche' : null, f.metric === 'workouts' ? 'Personne ne lâche' : null, 'Le perdant paie le café'].filter(Boolean).map((s) => <button key={s} className="chip" onClick={() => set('title', s)}>{s}</button>)}</div>
        <Field label="Description (facultatif)" hint="L’enjeu, une règle maison…"><textarea value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={280} rows={3} /></Field>
      </>}

      {step === 2 && <>
        <Field label="Durée"><div className="chips">{DURATIONS.map(([d, l]) => <button key={d} className={`chip ${!f.custom && f.days === d ? 'on' : ''}`} onClick={() => setF({ ...f, days: d, custom: false })}>{l}</button>)}
          <button className={`chip ${f.custom ? 'on' : ''}`} onClick={() => set('custom', true)}>Personnalisée</button></div></Field>
        {f.custom && <Field label="Nombre de jours (1 à 90)"><NumInput value={f.days} onChange={(v) => set('days', Math.min(90, Math.max(1, Math.round(v || 1))))} /></Field>}
        <Field label="Début"><div className="chips">{[[today, 'Aujourd’hui'], [addD(today, 1), 'Demain'], [addD(today, (8 - new Date(today + 'T12:00').getDay()) % 7 || 7), 'Lundi prochain']].map(([d, l]) => <button key={l} className={`chip ${f.start === d ? 'on' : ''}`} onClick={() => set('start', d)}>{l}</button>)}</div>
          <input type="date" value={f.start} min={today} max={addD(today, 60)} onChange={(e) => e.target.value && set('start', e.target.value)} className="mt-s" /></Field>
        <p className="small">Du <b>{fmtD(f.start)}</b> au <b>{fmtD(end)}</b> inclus.</p>
      </>}

      {step === 3 && t && <>
        <div className={`comp-hero tone-${t.tone}`}><span className="comp-ico"><Icon name={t.icon} size={20} /></span><div><b>{f.mode === 'team' ? `${t.label} ensemble` : t.label}</b><p className="small">{t.rule}</p></div></div>
        {f.metric === 'goal_days' && <Field label="Objectif de pas par jour" hint="Un point par jour où il est atteint."><NumInput value={f.goal} onChange={(v) => set('goal', v)} step={500} /></Field>}
        {f.mode === 'team' && <Field label={`Objectif commun (${t.unit})`} hint="Proposé selon la taille de la ligue et la durée. Un objectif irréaliste est refusé."><NumInput value={f.goal} onChange={(v) => set('goal', v)} step={t.id === 'steps' ? 10000 : 1} /></Field>}
        <Field label="Participants au maximum"><NumInput value={f.max_n} onChange={(v) => set('max_n', Math.min(50, Math.max(2, Math.round(v || 2))))} /></Field>
        <p className="xs muted">Les plafonds par jour protègent ta récupération : s’entraîner deux fois le même jour ne rapporte pas plus.</p>
      </>}

      {step === 4 && <>
        <Segmented value={f.scope} onChange={(v) => set('scope', v)} options={[['league', 'Toute la ligue'], ['invite', 'Sur invitation']]} />
        <p className="small muted">{f.scope === 'league' ? 'Tout le monde voit la compétition et peut la rejoindre. Tu peux aussi prévenir des amis précis :' : 'Seuls les invités la voient. Coche au moins une personne :'}</p>
        <ul className="comp-pick">{others.map((m) => <li key={m.id}><label><input type="checkbox" checked={f.invite.includes(m.id)} onChange={(e) => set('invite', e.target.checked ? [...f.invite, m.id] : f.invite.filter((x) => x !== m.id))} /><Avatar member={m} size={28} /><span>{m.pseudo}</span></label></li>)}</ul>
        {!others.length && <p className="muted small">Tu es seul dans la ligue pour l’instant : invite des amis avec le code de la ligue.</p>}
      </>}

      {step === 5 && t && <div className="wiz-summary">
        <div className={`comp-hero tone-${t.tone}`}><span className="comp-ico big"><Icon name={t.icon} size={24} /></span><div><span className="comp-kind">{f.mode === 'team' ? 'Défi collectif' : t.label}</span><b className="comp-hero-title">{f.title}</b></div></div>
        <dl className="cs-evidence">
          <div><dt>Durée</dt><dd>{f.days === 1 ? '24 h' : `${f.days} jours`}</dd></div>
          <div><dt>Dates</dt><dd>{fmtD(f.start)} → {fmtD(end)}</dd></div>
          {f.goal != null && <div><dt>Objectif</dt><dd>{nf(f.goal)} {f.metric === 'goal_days' ? 'pas / jour' : t.unit}</dd></div>}
          <div><dt>Participants</dt><dd>{f.scope === 'league' ? 'Toute la ligue' : `${f.invite.length} invité${f.invite.length > 1 ? 's' : ''}`} · {f.max_n} max</dd></div>
        </dl>
        <p className="small">{t.rule}</p>
        <p className="xs muted">Tu es inscrit automatiquement. Les compétitions déjà en cours ne sont pas modifiées.</p>
      </div>}
    </Sheet>
  );
}
