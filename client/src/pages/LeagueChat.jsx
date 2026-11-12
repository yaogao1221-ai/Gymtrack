import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Icon, Sheet, Segmented, Loading, useToast } from '../components/ui.jsx';
import { Avatar } from './LeagueSocial.jsx';
import { getShared, dmInbox, dmThread, dmSend, dmHide, shareEnabled, setShareEnabled, ago } from '../lib/league.js';

const LEVELS = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const GOALS = { hypertrophie: 'Prise de muscle', force: 'Force', perte_de_gras: 'Perte de gras', recomposition: 'Recomposition', sante: 'Santé' };
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const num = (v) => (v == null ? '' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }));
const load = (e) => (e.w == null ? 'charge libre' : `${num(e.w)}${e.wmax ? `–${num(e.wmax)}` : ''} ${e.unit}${e.wnote ? ` ${e.wnote}` : ''}`);

// Interrupteur « partager mon programme »
export function ShareToggle({ onChanged }) {
  const toast = useToast(); const [on, setOn] = useState(shareEnabled()); const [busy, setBusy] = useState(false);
  const flip = async () => {
    setBusy(true);
    try { await setShareEnabled(!on); setOn(!on); toast(!on ? 'Programme partagé avec la ligue' : 'Partage arrêté'); onChanged?.(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <label className="share-toggle">
      <span className="grow"><b className="small">Partager mon programme et ma progression</b><span className="muted small">Tes amis voient tes jours, exercices, charges, dernières séances et records pour te conseiller. Mis à jour à chaque ouverture de la ligue.</span></span>
      <input type="checkbox" role="switch" className="switch" checked={on} disabled={busy} onChange={flip} />
    </label>
  );
}

function Spark({ points, assisted }) {
  const vals = points.map((p) => p[1]).filter((v) => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals); const max = Math.max(...vals); const span = max - min || 1;
  const xy = vals.map((v, i) => `${(i / (vals.length - 1)) * 76 + 2},${assisted ? ((v - min) / span) * 20 + 2 : 22 - ((v - min) / span) * 20}`).join(' ');
  return <svg className="spark" viewBox="0 0 80 24" width="80" height="24" aria-hidden="true"><polyline points={xy} fill="none" stroke="url(#sg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><defs><linearGradient id="sg"><stop offset="0" stopColor="#2ee6c5" /><stop offset="1" stopColor="#ff7a3d" /></linearGradient></defs></svg>;
}

// Programme complet d'un membre + progression + dernières séances
export function ProgramSheet({ member, onClose, onAdvice }) {
  const [data, setData] = useState(undefined); const [tab, setTab] = useState('prog');
  useEffect(() => { if (!member) return; setData(undefined); setTab('prog'); getShared(member.id).then(setData).catch(() => setData(null)); }, [member]);
  const d = member ? data?.data : null;
  return (
    <Sheet open={!!member} onClose={onClose} title={member ? `Programme de ${member.pseudo}` : ''}>
      {data === undefined && <Loading />}
      {member && data === null && <p className="muted small">{member.pseudo} ne partage pas son programme pour l’instant.</p>}
      {d && <>
        <p className="muted small">{[LEVELS[d.level], GOALS[d.goal], d.per_week && `${d.per_week} séances/sem.`].filter(Boolean).join(' · ')}{data.updated_at && ` · à jour ${ago(data.updated_at)}`}</p>
        <Segmented value={tab} onChange={setTab} options={[['prog', 'Programme'], ['progress', 'Progression'], ['recent', 'Séances']]} />
        {tab === 'prog' && (d.program?.days || []).map((day) => (
          <div key={day.code} className="shared-day">
            <div className="shared-day-head"><b>{day.name}</b>{day.focus && <span className="muted small">{day.focus}</span>}</div>
            {day.cardio.filter((c) => c.at === 'debut').map((c, i) => <p key={'a' + i} className="small cardio-line"><Icon name="heart" size={12} />{c.label} {num(c.min)} min{c.kmh ? ` · ${num(c.kmh)} km/h` : ''}{c.incl ? ` · ${num(c.incl)} %` : ''}</p>)}
            <ul className="shared-ex">
              {day.exercises.map((e) => (
                <li key={e.id + '-' + e.name}>
                  <span className="grow"><span className="small">{e.ss && <span className="ss-tag">{e.ss}</span>}{e.name}</span><span className="muted small mono">{e.sets} × {e.reps || '?'}{e.reps_note ? ` ${e.reps_note}` : ''} · {load(e)}{e.rest ? ` · repos ${e.rest} s` : ''}</span>{e.notes && <span className="muted small">{e.notes}</span>}</span>
                  <button className="btn xs ghost" onClick={() => onAdvice(member, e.name)}><Icon name="chat" size={12} />Conseil</button>
                </li>
              ))}
            </ul>
            {day.cardio.filter((c) => c.at !== 'debut').map((c, i) => <p key={'b' + i} className="small cardio-line"><Icon name="heart" size={12} />{c.label} {num(c.min)} min{c.kmh ? ` · ${num(c.kmh)} km/h` : ''}{c.incl ? ` · ${num(c.incl)} %` : ''}</p>)}
          </div>
        ))}
        {tab === 'progress' && <>
          {!d.progress.length && <p className="muted small mt">Pas encore assez de séances pour voir une progression.</p>}
          <ul className="shared-ex mt">
            {d.progress.map((p) => {
              const assisted = p.kind === 'assisted'; const delta = p.last.top != null && p.first.top != null ? p.last.top - p.first.top : null;
              const good = delta != null && (assisted ? delta < 0 : delta > 0);
              return (
                <li key={p.id}>
                  <span className="grow"><span className="small">{p.name}</span>
                    <span className="muted small mono">{num(p.first.top)} → <b className="text">{num(p.last.top)}</b> {p.unit}{assisted ? ' d’assistance' : ''} · {p.sessions} séance{p.sessions > 1 ? 's' : ''}</span></span>
                  <Spark points={p.points} assisted={assisted} />
                  {delta != null && delta !== 0 && <span className={`delta mono small ${good ? 'up' : 'down'}`}>{delta > 0 ? '+' : ''}{num(delta)}</span>}
                </li>
              );
            })}
          </ul>
          {d.records.length > 0 && <><p className="muted small mt">Derniers records</p><ul className="shared-ex">{d.records.map((r, i) => <li key={i}><span className="grow small">{r.name}</span><span className="small mono">{num(r.prev)} → <b>{num(r.w)}</b> {r.unit}</span><span className="muted small">{fmtDate(r.date)}</span></li>)}</ul></>}
        </>}
        {tab === 'recent' && <>
          {!d.recent.length && <p className="muted small mt">Aucune séance enregistrée.</p>}
          {d.recent.map((w, i) => (
            <div key={i} className="shared-day">
              <div className="shared-day-head"><b>{w.name}</b><span className="muted small">{fmtDate(w.date)}{w.min ? ` · ${w.min} min` : ''}{w.rpe ? ` · effort ${num(w.rpe)}/10` : ''}</span></div>
              <ul className="shared-ex">{w.ex.map((e, j) => <li key={j}><span className="grow small">{e.name}</span><span className="muted small mono">{e.sets.map(([wt, r]) => (wt != null ? `${num(wt)}×${r ?? '?'}` : `${r ?? '?'} reps`)).join(', ')}</span></li>)}</ul>
            </div>
          ))}
        </>}
        <button className="btn primary block mt" onClick={() => onAdvice(member, null)}><Icon name="chat" size={16} />Écrire à {member.pseudo}</button>
      </>}
    </Sheet>
  );
}

// Conversation privée entre deux membres
export function ChatSheet({ chat, onClose, me, onRead }) {
  const toast = useToast(); const [msgs, setMsgs] = useState(null); const [body, setBody] = useState(''); const [about, setAbout] = useState(null); const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const with_ = chat?.member;
  const refresh = useCallback(() => with_ && dmThread(with_.id).then((m) => { setMsgs(m); onRead?.(); }).catch((e) => toast(e.message, 'err')), [with_, onRead, toast]);
  useEffect(() => {
    if (!with_) return undefined;
    setMsgs(null); setBody(''); setAbout(chat.about || null); refresh();
    const t = setInterval(refresh, 15000); return () => clearInterval(t);
  }, [chat]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);
  const send = async () => {
    setBusy(true);
    try { await dmSend(with_.id, body.trim(), about); setBody(''); setAbout(null); await refresh(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!with_} onClose={onClose} title={with_ ? with_.pseudo : ''}
      footer={with_ && <div className="chat-compose">
        {about && <span className="about-tag">À propos de : {about}<button aria-label="Retirer le sujet" onClick={() => setAbout(null)}><Icon name="x" size={12} /></button></span>}
        <div className="row gap-s"><textarea rows={2} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={about ? `Ton conseil sur ${about}…` : 'Écris un message…'} /><button className="btn primary" disabled={busy || !body.trim()} onClick={send} aria-label="Envoyer"><Icon name="up" size={18} /></button></div>
      </div>}>
      {msgs == null ? <Loading /> : (
        <div className="chat">
          {!msgs.length && <p className="muted small">Commence la conversation. Pour conseiller sur un exercice précis, ouvre son programme et touche « Conseil ».</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`bubble ${m.from === me ? 'mine' : ''}`}>
              {m.about && <span className="about-tag small">{m.about}</span>}
              <p>{m.body}</p>
              <span className="muted small">{ago(m.created_at)}{m.from === me && m.read_at ? ' · lu' : ''}</span>
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
    </Sheet>
  );
}

// Liste des conversations
export function Inbox({ board, me, onOpen, version, onCount }) {
  const toast = useToast(); const [list, setList] = useState(null); const [pick, setPick] = useState(false);
  const byId = Object.fromEntries(board.members.map((x) => [x.id, x]));
  const reload = useCallback(() => dmInbox().then((l) => { setList(l); onCount?.(l.reduce((a, c) => a + Number(c.unread || 0), 0)); }).catch((e) => { toast(e.message, 'err'); setList([]); }), [toast, onCount]);
  useEffect(() => { reload(); }, [reload, version]);
  const others = board.members.filter((x) => x.id !== me);
  return (
    <Card title="Messages privés" icon="chat" action={<button className="btn xs primary" onClick={() => setPick(!pick)}><Icon name="plus" size={12} />Nouveau</button>}>
      {pick && <div className="chips mb">{others.map((x) => <button key={x.id} className="chip" onClick={() => { setPick(false); onOpen(x); }}>{x.pseudo}</button>)}</div>}
      {list == null ? <Loading /> : !list.length ? <p className="muted small">Aucune conversation. Écris à quelqu’un pour parler programme, technique ou charges.</p> : (
        <ul className="inbox">
          {list.map((c) => {
            const m = byId[c.with] || { id: c.with, pseudo: 'Ancien membre' };
            return (
              <li key={c.with}>
                <button className="inbox-row" onClick={() => byId[c.with] && onOpen(m)}>
                  <Avatar member={m} size={40} />
                  <span className="grow"><span className="row gap-s"><b>{m.pseudo}</b><span className="muted small">{ago(c.last_at)}</span></span><span className={`small ellipsis ${c.unread ? '' : 'muted'}`}>{c.last_from === me ? 'Toi : ' : ''}{c.last}</span></span>
                  {c.unread > 0 && <span className="unread">{c.unread}</span>}
                </button>
                <button className="icon-btn sm" aria-label="Masquer la conversation" onClick={async () => { try { await dmHide(c.with); reload(); } catch (e) { toast(e.message, 'err'); } }}><Icon name="trash" size={14} /></button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
