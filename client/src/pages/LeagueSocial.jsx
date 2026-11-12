import { useRef, useState } from 'react';
import { Card, Icon, Field, Sheet, useToast } from '../components/ui.jsx';
import { ShareToggle } from './LeagueChat.jsx';
import { setPhoto, resizePhoto, postMessage, hidePost, TONES, quickLines, ago, totalPoints } from '../lib/league.js';

const HUES = [18, 168, 262, 330, 42, 205, 290];
const hue = (id = '') => HUES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];

export function Avatar({ member, size = 44 }) {
  const st = { width: size, height: size, fontSize: size * 0.4 };
  if (member?.photo) return <img className="avatar" src={member.photo} alt="" style={st} />;
  return <span className="avatar initials" style={{ ...st, background: `hsl(${hue(member?.id)} 70% 45%)` }}>{(member?.pseudo || '?').slice(0, 1).toUpperCase()}</span>;
}

function PhotoButton({ me, onSaved }) {
  const toast = useToast(); const input = useRef(null); const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setBusy(true);
    try { await setPhoto(await resizePhoto(f)); toast('Photo mise à jour'); onSaved(); } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <>
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
      <button className="avatar-edit" onClick={() => input.current.click()} disabled={busy} aria-label="Changer ma photo">
        <Avatar member={me} size={64} /><span className="cam"><Icon name="camera" size={14} /></span>
      </button>
    </>
  );
}

const statLine = (s, steps) => [
  `${s?.workouts || 0} séance${(s?.workouts || 0) > 1 ? 's' : ''}`,
  `${(s?.km || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`,
  `${(steps || 0).toLocaleString('fr-FR')} pas`,
  s?.prs ? `${s.prs} record${s.prs > 1 ? 's' : ''}` : null,
].filter(Boolean).join(' · ');

export function Lobby({ board, curKey, me, rows, feed, onReload, onCompose, onOpenMember, onProgram, onChat }) {
  const mine = board.members.find((x) => x.id === me);
  const rank = (id) => rows.findIndex((r) => r.id === id) + 1;
  const received = (id) => feed.filter((p) => p.target === id).length;
  return (
    <>
      <Card className="me-card">
        <div className="row gap">
          <PhotoButton me={mine} onSaved={onReload} />
          <div className="grow">
            <b className="me-name">{mine?.pseudo}</b>
            <p className="muted small">{mine?.photo ? 'Touche ta photo pour la changer' : 'Touche le rond pour ajouter ta photo'}</p>
          </div>
        </div>
        <ShareToggle onChanged={onReload} />
      </Card>
      <Card title="Participants" icon="user">
        <ul className="lobby-list">
          {board.members.map((x) => {
            const p = x.periods?.[curKey] || {};
            return (
              <li key={x.id} className={x.id === me ? 'me' : ''}>
                <button className="lobby-row" onClick={() => onOpenMember(x)}>
                  <Avatar member={x} />
                  <span className="grow">
                    <span className="row gap-s"><b>{x.pseudo}</b>{x.id === me && <span className="muted small">(toi)</span>}</span>
                    <span className="muted small">{statLine(p.stats, p.steps)}</span>
                  </span>
                  <span className="lobby-rank"><b className="mono">{rank(x.id)}<sup>{rank(x.id) === 1 ? 'er' : 'e'}</sup></b><span className="muted small mono">{totalPoints(p.stats, p.steps)} pts</span></span>
                </button>
                {x.id !== me && (
                  <div className="lobby-acts">
                    {x.shares && <button className="chip prog-chip" onClick={() => onProgram(x)}><Icon name="dumbbell" size={13} />Programme</button>}
                    <button className="chip" onClick={() => onChat(x)}><Icon name="chat" size={13} />Écrire</button>
                    {TONES.map((t) => <button key={t.id} className={`chip tone-${t.id}`} onClick={() => onCompose(x, t.id)}>{t.label}</button>)}
                    {received(x.id) > 0 && <span className="muted small">{received(x.id)} message{received(x.id) > 1 ? 's' : ''}</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="muted small mt">Chiffres de la semaine en cours. Touche quelqu’un pour voir sa fiche.</p>
      </Card>
    </>
  );
}

export function Feed({ board, feed, me, onCompose, onHidden }) {
  const toast = useToast();
  const byId = Object.fromEntries(board.members.map((x) => [x.id, x]));
  const hide = async (id) => { try { await hidePost(id); toast('Message retiré'); onHidden(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <Card title="Le fil" icon="chat" action={<button className="btn xs primary" onClick={() => onCompose(null, 'motive')}><Icon name="plus" size={12} />Message</button>}>
      {!feed.length && <p className="muted small">Rien pour l’instant. Lance les hostilités : félicite, motive ou chambre quelqu’un depuis le lobby.</p>}
      <ul className="feed">
        {feed.map((p) => {
          const a = byId[p.author]; const t = p.target ? byId[p.target] : null; const tone = TONES.find((x) => x.id === p.tone);
          return (
            <li key={p.id} className={`post tone-${p.tone} ${p.target === me ? 'to-me' : ''}`}>
              <Avatar member={a || { id: p.author, pseudo: '?' }} size={36} />
              <div className="grow">
                <div className="post-head">
                  <b>{a?.pseudo || 'Ancien membre'}</b>
                  <span className="muted small">{t ? <>→ <b>{t.id === me ? 'toi' : t.pseudo}</b></> : '→ tout le monde'}</span>
                  <span className={`tone-tag tone-${p.tone}`}>{tone?.label}</span>
                </div>
                <p className="post-body">{p.body}</p>
                <div className="row gap-s">
                  <span className="muted small">{ago(p.created_at)}</span>
                  {a && p.author !== me && <button className="btn xs ghost" onClick={() => onCompose(a, p.tone === 'chambre' ? 'chambre' : 'bravo')}>Répondre</button>}
                  {p.can_hide && <button className="btn xs ghost" onClick={() => hide(p.id)}><Icon name="trash" size={12} />{p.author === me ? 'Retirer' : 'Effacer de ma fiche'}</button>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function ComposeSheet({ draft, onClose, board, me, curKey, onSent }) {
  const toast = useToast(); const [busy, setBusy] = useState(false);
  const [body, setBody] = useState(''); const [tone, setTone] = useState(draft?.tone || 'motive'); const [target, setTarget] = useState(draft?.target?.id || null);
  const [key, setKey] = useState(null);
  const k = draft ? `${draft.target?.id}-${draft.tone}-${draft.n}` : null;
  if (k !== key) { setKey(k); if (draft) { setTone(draft.tone); setTarget(draft.target?.id || null); setBody(''); } }
  const tm = board.members.find((x) => x.id === target);
  const p = tm?.periods?.[curKey] || {};
  const lines = quickLines(tone, tm?.pseudo, p.stats);
  const send = async () => {
    setBusy(true);
    try { await postMessage(target, tone, body.trim()); toast(tone === 'chambre' ? 'Envoyé. Ça va piquer.' : 'Message envoyé'); onSent(); onClose(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!draft} onClose={onClose} title={tm ? `Message à ${tm.pseudo}` : 'Message à la ligue'}
      footer={<button className="btn primary block" disabled={busy || !body.trim()} onClick={send}>{busy ? '…' : 'Envoyer'}</button>}>
      <Field label="Pour">
        <div className="chips">
          <button className={`chip ${!target ? 'on' : ''}`} onClick={() => setTarget(null)}>Tout le monde</button>
          {board.members.filter((x) => x.id !== me).map((x) => <button key={x.id} className={`chip ${target === x.id ? 'on' : ''}`} onClick={() => setTarget(x.id)}>{x.pseudo}</button>)}
        </div>
      </Field>
      <Field label="Ton">
        <div className="chips">{TONES.map((t) => <button key={t.id} className={`chip tone-${t.id} ${tone === t.id ? 'on' : ''}`} onClick={() => setTone(t.id)}>{t.label}</button>)}</div>
      </Field>
      <Field label="Idées toutes prêtes" hint="Touche une phrase pour la reprendre, puis modifie-la si tu veux.">
        <div className="quick-lines">{lines.map((l) => <button key={l} className="quick-line" onClick={() => setBody(l)}>{l}</button>)}</div>
      </Field>
      <Field label="Ton message" hint={`${body.length}/200 · visible par toute la ligue. La personne visée peut l’effacer de sa fiche.`}>
        <textarea rows={3} maxLength={200} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Écris ici…" />
      </Field>
    </Sheet>
  );
}

export function MemberSheet({ member, onClose, board, me, curKey, monthKey, rows, feed, onCompose, onProgram, onChat }) {
  if (!member) return <Sheet open={false} onClose={onClose} />;
  const w = member.periods?.[curKey] || {}; const mo = member.periods?.[monthKey] || {};
  const rank = rows.findIndex((r) => r.id === member.id) + 1;
  const msgs = feed.filter((p) => p.target === member.id).slice(0, 5);
  const byId = Object.fromEntries(board.members.map((x) => [x.id, x]));
  return (
    <Sheet open onClose={onClose} title={member.pseudo}>
      <div className="member-hero">
        <Avatar member={member} size={88} />
        <div><b className="mono big">{rank}<sup>{rank === 1 ? 'er' : 'e'}</sup></b><span className="muted small"> au général cette semaine</span></div>
      </div>
      <div className="member-stats">
        <div><span className="muted small">Cette semaine</span><p className="small">{statLine(w.stats, w.steps)}</p><p className="small mono">{totalPoints(w.stats, w.steps)} pts</p></div>
        <div><span className="muted small">Ce mois</span><p className="small">{statLine(mo.stats, mo.steps)}</p><p className="small mono">{totalPoints(mo.stats, mo.steps)} pts</p></div>
      </div>
      <div className="row gap-s wrap mt">
        {member.shares && <button className="btn sm primary" onClick={() => onProgram(member)}><Icon name="dumbbell" size={14} />{member.id === me ? 'Voir ce que je partage' : 'Voir son programme et sa progression'}</button>}
        {member.id !== me && <button className="btn sm" onClick={() => onChat(member)}><Icon name="chat" size={14} />Écrire</button>}
        {!member.shares && member.id !== me && <span className="muted small">Ne partage pas son programme</span>}
      </div>
      {member.id !== me && <div className="chips mt">{TONES.map((t) => <button key={t.id} className={`chip tone-${t.id}`} onClick={() => { onClose(); onCompose(member, t.id); }}>{t.label}</button>)}</div>}
      {msgs.length > 0 && <>
        <p className="muted small mt">Derniers messages reçus</p>
        <ul className="feed compact">
          {msgs.map((p) => <li key={p.id} className={`post tone-${p.tone}`}><Avatar member={byId[p.author]} size={28} /><div className="grow"><p className="post-body"><b>{byId[p.author]?.pseudo || '?'}</b> {p.body}</p><span className="muted small">{ago(p.created_at)}</span></div></li>)}
        </ul>
      </>}
    </Sheet>
  );
}
