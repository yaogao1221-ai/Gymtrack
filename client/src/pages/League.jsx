import { TROPHY_BY_CAT, TrophyChampion, Badge3D, BADGE_ART } from '../components/Art3D.jsx';
import { useCallback, useEffect, useState } from 'react';
import { SectionTabs } from '../components/SectionTabs.jsx';
import { Page, Card, Fold, Icon, Field, Segmented, Sheet, Confirm, Loading, NumInput, useToast } from '../components/ui.jsx';
import {
  getMembership, createLeague, joinLeague, restoreFromKey, leaveLeague, setStake, sendSteps, syncBoard,
  ranking, CATEGORIES, POINTS, personalKey, SANTE_BASE, getHealth, setShortcutUrl, getFeed, feedSeen, markFeedSeen, getChallenges,
  getComps, getEvents, renameLeague, ago, COMP_BY_ID,
} from '../lib/league.js';
import { CompCard, CompList, CompSheet, CreateComp } from './LeagueComps.jsx';
import { Avatar } from './LeagueSocial.jsx';
import { Lobby, Feed, ComposeSheet, MemberSheet } from './LeagueSocial.jsx';
import { ProgramSheet, ChatSheet, Inbox } from './LeagueChat.jsx';
import { Challenges } from './LeagueChallenges.jsx';

const APP_URL = 'https://yaogao1221-ai.github.io/Gymtrack/';

export default function League() {
  const [m, setM] = useState(getMembership());
  return m ? <Board m={m} onLeft={() => setM(null)} /> : <Join onJoined={setM} />;
}

function Join({ onJoined }) {
  const toast = useToast();
  const [mode, setMode] = useState('join');
  const [f, setF] = useState({ pseudo: '', code: '', name: '', key: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = async () => {
    setBusy(true);
    try {
      const r = mode === 'create' ? await createLeague(f.name, f.pseudo) : mode === 'join' ? await joinLeague(f.code, f.pseudo) : await restoreFromKey(f.key);
      toast(mode === 'create' ? `Ligue créée : code ${r.code}` : `Bienvenue dans « ${r.league} »`);
      onJoined(r);
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const ok = mode === 'create' ? f.name.trim().length >= 2 && f.pseudo.trim().length >= 2 : mode === 'join' ? f.code.trim().length >= 6 && f.pseudo.trim().length >= 2 : f.key.includes('.');
  return (
    <Page title="Ligue">
      <Card>
        <ul className="league-pitch">
          <li><Icon name="trophy" size={18} /><span><b>Podiums</b> de la semaine et du mois : Runner (km), Iron (muscu), Marcheur (pas) et classement général.</span></li>
          <li><Icon name="flame" size={18} /><span><b>Enjeux</b> entre vous : le dernier paie le café, le resto, les protéines…</span></li>
          <li><Icon name="info" size={18} /><span>Seuls tes <b>totaux</b> sont partagés (km, séances, séries, records, pas). Le détail de tes séances reste sur ton téléphone.</span></li>
        </ul>
      </Card>
      <Segmented value={mode} onChange={setMode} options={[['join', 'Rejoindre'], ['create', 'Créer'], ['restore', 'Récupérer']]} />
      <Card>
        {mode === 'create' && <Field label="Nom de la ligue"><input value={f.name} onChange={set('name')} placeholder="Les monstres du lundi" maxLength={40} /></Field>}
        {mode === 'join' && <Field label="Code de la ligue" hint="6 caractères, donné par la personne qui a créé la ligue"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="ABC234" maxLength={6} autoCapitalize="characters" className="mono" /></Field>}
        {mode !== 'restore' && <Field label="Ton pseudo"><input value={f.pseudo} onChange={set('pseudo')} placeholder="Anis" maxLength={20} /></Field>}
        {mode === 'restore' && <Field label="Ta clé personnelle" hint="Elle est dans ton lien « Mes pas → Automatique » (le texte entre k= et &n=). Utile après un changement de téléphone."><input value={f.key} onChange={set('key')} className="mono" placeholder="xxxxxxxx-….xxxx" /></Field>}
        <button className="btn primary block" disabled={!ok || busy} onClick={go}>{busy ? '…' : mode === 'create' ? 'Créer la ligue' : mode === 'join' ? 'Rejoindre' : 'Récupérer mon accès'}</button>
      </Card>
    </Page>
  );
}

function Board({ m, onLeft }) {
  const toast = useToast();
  const [data, setData] = useState(null); const [error, setError] = useState(null);
  const [kind, setKind] = useState('week'); const [cat, setCat] = useState('points');
  const [stakeEdit, setStakeEdit] = useState(null); const [shortcut, setShortcut] = useState(false); const [leave, setLeave] = useState(false);
  const [steps, setSteps] = useState(null);
  const [view, setView] = useState('home');
  const [comps, setComps] = useState(null); const [events, setEvents] = useState([]); const [compId, setCompId] = useState(null); const [creating, setCreating] = useState(false); const [people, setPeople] = useState(false);
  const loadComps = useCallback(() => { getComps().then(setComps).catch(() => setComps((c) => c || { list: [], trophies: {} })); getEvents(30).then((e) => setEvents(e || [])).catch(() => {}); }, []);
  useEffect(() => { loadComps(); }, [loadComps]); const [feed, setFeed] = useState([]); const [seen, setSeen] = useState(feedSeen());
  const [draft, setDraft] = useState(null); const [member, setMember] = useState(null);
  const [prog, setProg] = useState(null); const [chat, setChat] = useState(null); const [inboxV, setInboxV] = useState(0); const [unread, setUnread] = useState(0);
  useEffect(() => { setUnread(data?.board?.unread || 0); }, [data]);
  const [challenges, setChallenges] = useState([]);
  const chKeys = data ? Object.fromEntries([['week', 'week', true], ['prevWeek', 'week', false], ['month', 'month', true], ['prevMonth', 'month', false]].map(([k, kind, c]) => [k, data.summary.periods.find((p) => p.kind === kind && p.current === c)?.key])) : null;
  const loadChallenges = useCallback(() => { if (chKeys) getChallenges(Object.values(chKeys)).then((l) => setChallenges(l || [])).catch(() => {}); }, [chKeys?.week, chKeys?.month]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadChallenges(); }, [loadChallenges]);
  const openChat = useCallback((member, about) => { setProg(null); setChat({ member, about, n: Date.now() }); }, []);
  const onRead = useCallback(() => setInboxV((v) => v + 1), []);
  const loadFeed = useCallback(() => getFeed().then((f) => setFeed(f || [])).catch(() => {}), []);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await syncBoard()); } catch (e) { setError(e.message); }
    loadFeed(); loadComps();
  }, [loadFeed, loadComps]);
  useEffect(() => { load(); }, [load]);
  // Les badges débloqués depuis la dernière visite s'animent une fois, puis sont marqués comme vus
  useEffect(() => { if (!data) return; const t = setTimeout(() => { try { localStorage.setItem('gt_badges_seen', JSON.stringify(data.summary.badges.filter((b) => b.got).map((b) => b.id))); } catch { /* */ } }, 4000); return () => clearTimeout(t); }, [data]);
  useEffect(() => { if (view === 'feed' && feed[0]) { markFeedSeen(feed[0].created_at); } }, [view, feed]);
  const fresh = feed.filter((p) => p.author !== m.member_id && p.created_at > seen).length;
  const compose = (target, tone) => setDraft({ target, tone, n: Date.now() });
  const switchView = (v) => { if (view === 'feed') setSeen(feedSeen()); setView(v); };

  if (!data && !error) return <Page title="Ligue"><Loading /></Page>;
  if (!data) return <Page title="Ligue"><Card><p className="warn-text small">{error}</p><button className="btn sm" onClick={load}>Réessayer</button></Card></Page>;

  const { summary, board } = data;
  const seenBadges = (() => { try { return JSON.parse(localStorage.getItem('gt_badges_seen') || '[]'); } catch { return []; } })();
  const cur = summary.periods.find((p) => p.kind === kind && p.current);
  const prev = summary.periods.find((p) => p.kind === kind && !p.current);
  const category = CATEGORIES.find((c) => c.id === cat);
  const rows = ranking(board, cur.key, category);
  const label = kind === 'day' ? 'journée' : kind === 'week' ? 'semaine' : 'mois';
  const dayCur = summary.periods.find((p) => p.kind === 'day' && p.current); const dayPrev = summary.periods.find((p) => p.kind === 'day' && !p.current);
  const dayLeader = dayCur ? ranking(board, dayCur.key, CATEGORIES[0])[0] : null; const dayWinner = dayPrev ? ranking(board, dayPrev.key, CATEGORIES[0])[0] : null;
  const fmt = (c, v) => (c.fmt ? c.fmt(v) : Math.round(v).toLocaleString('fr-FR'));
  const titles = ['points', 'progress', 'km'].map((id) => {
    const c = CATEGORIES.find((x) => x.id === id); const r = ranking(board, prev.key, c);
    return { c, winner: r[0]?.value > 0 ? r[0] : null };
  });
  const general = ranking(board, cur.key, CATEGORIES[0]);
  const prevGeneral = ranking(board, prev.key, CATEGORIES[0]).filter((r) => r.stats);
  const weekKey = summary.periods.find((p) => p.kind === 'week' && p.current).key;
  const monthKey = summary.periods.find((p) => p.kind === 'month' && p.current).key;
  const weekRows = ranking(board, weekKey, CATEGORIES[0]);
  const stake = kind === 'week' ? board.league.stake_week : board.league.stake_month;
  const invite = async () => {
    const text = `Rejoins ma ligue GymTrack « ${board.league.name} » ! Installe l’appli : ${APP_URL} puis Plus → Ligue → Rejoindre, code ${board.league.code}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Invitation copiée'); } } catch { /* partage annulé */ }
  };
  const saveSteps = async () => {
    try { const r = await sendSteps(Number(steps)); toast(`${Number(r.pas).toLocaleString('fr-FR')} pas enregistrés pour aujourd’hui`); setSteps(null); load(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <Page title={board.league.name} subtitle={`${board.members.length} membre${board.members.length > 1 ? 's' : ''} · code ${board.league.code}`}
      actions={<button className="icon-btn" aria-label="Actualiser" onClick={load}><Icon name="bolt" /></button>}>
      {error && <p className="warn-text small">{error}</p>}
      <div className="lg-tabs"><Segmented value={view} onChange={switchView} options={[['home', 'Accueil'], ['comps', 'Compétitions'], ['board', 'Classement'], ['feed', fresh ? `Fil (${fresh})` : 'Fil'], ['msgs', unread ? `Messages (${unread})` : 'Messages']]} /></div>
      {view === 'board' && (dayLeader?.value > 0 || dayWinner?.value > 0) && <div className="day-winner">
        <Icon name="trophy" size={18} />
        <span className="grow">{dayLeader?.value > 0 ? <span>Gagnant du jour : <b>{dayLeader.pseudo}</b> <span className="mono small">{dayLeader.value} pts</span></span> : 'Personne n’a encore marqué aujourd’hui'}{dayWinner?.value > 0 && <span className="muted small">Hier : {dayWinner.pseudo} ({dayWinner.value} pts)</span>}</span>
      </div>}
      {view === 'home' && <LeagueHome board={board} me={m.member_id} comps={comps} events={events} weekRows={weekRows} onOpen={(c) => setCompId(c.id)} onCreate={() => setCreating(true)}
        onInvite={invite} onPeople={() => setPeople(true)} onAll={() => setView('comps')} onBoard={() => setView('board')} />}
      {view === 'comps' && (comps ? <CompList data={comps} board={board} me={m.member_id} onOpen={(c) => setCompId(c.id)} onCreate={() => setCreating(true)} /> : <Loading />)}
      {view === 'home' && <Lobby board={board} curKey={weekKey} me={m.member_id} rows={weekRows} feed={feed} onReload={load} onCompose={compose} onOpenMember={setMember} onProgram={setProg} onChat={openChat} />}
      {view === 'msgs' && <Inbox board={board} me={m.member_id} onOpen={(x) => openChat(x)} version={inboxV} onCount={setUnread} />}
      {view === 'feed' && <Feed board={board} feed={feed} me={m.member_id} onCompose={compose} onHidden={loadFeed} />}
      {view === 'board' && <>
      <Segmented value={kind} onChange={setKind} options={[['day', 'Aujourd’hui'], ['week', 'Semaine'], ['month', 'Mois']]} />

      <Card title={kind === 'day' ? 'Titres d’hier' : kind === 'week' ? 'Titres de la semaine dernière' : 'Titres du mois dernier'} icon="trophy">
        <div className="titles">
          {titles.map(({ c, winner }) => (
            <div key={c.id} className={`title-card t-${c.id}`}>
              {(() => { const T = TROPHY_BY_CAT[c.id] || TrophyChampion; return <T size={64} animated={!!winner} />; })()}
              <span className="muted small">{c.short === 'Champion' ? 'Champion' : `${c.short} of the ${kind}`}</span>
              <b>{winner ? winner.pseudo : '—'}</b>
              <span className="small mono">{winner ? `${fmt(c, winner.value)} ${c.unit}` : 'personne'}</span>
            </div>
          ))}
        </div>
      </Card>

      <Challenges board={board} me={m.member_id} list={challenges} keys={chKeys} onChanged={loadChallenges} />
      <Card title={`Classement de la ${label}`} icon="chart">
        <div className="chips scroll mb">
          {CATEGORIES.map((c) => <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.label}</button>)}
        </div>
        <p className="muted small">{category.hint}</p>
        <Podium rows={rows} me={m.member_id} unit={category.unit} fmt={(v) => fmt(category, v)} />
        <ol className="rank-list" start={4}>
          {rows.slice(3).map((r, i) => (
            <li key={r.id} className={r.id === m.member_id ? 'me' : ''}><span className="rank mono">{i + 4}</span><span className="grow">{r.pseudo}</span><b className="mono">{fmt(category, r.value)}</b><span className="muted small">{category.unit}</span></li>
          ))}
        </ol>
        {rows.every((r) => r.value === 0) && <p className="muted small">Personne n’a encore marqué cette {label}. Une séance ou une sortie cardio suffit pour entrer au classement.</p>}
      </Card>

      {kind !== 'day' && <Card title={kind === 'week' ? 'Enjeu de la semaine' : 'Enjeu du mois'} icon="flame"
        action={<button className="btn xs" onClick={() => setStakeEdit(stake || '')}><Icon name="edit" size={12} />Modifier</button>}>
        {stake ? <p className="stake">« {stake} »</p> : <p className="muted small">Aucun enjeu fixé. Exemple : « Le dernier paie le café à tout le monde ».</p>}
        {stake && general.length > 1 && <p className="small">Si ça s’arrêtait maintenant : <b>{general.at(-1).pseudo}</b> devrait l’honorer.</p>}
        {stake && prevGeneral.length > 1 && <p className="small">{kind === 'week' ? 'Semaine dernière' : 'Mois dernier'} : <b>{prevGeneral.at(-1).pseudo}</b> doit honorer l’enjeu.</p>}
      </Card>}

      <HealthCard onOpen={() => setShortcut(true)} />
      <Card title="Saisir mes pas" icon="heart">
        <div className="row gap-s">
          <NumInput value={steps} onChange={setSteps} placeholder="Pas aujourd’hui" />
          <button className="btn sm" disabled={!steps} onClick={saveSteps}>Envoyer</button>
        </div>
      </Card>

      <Card title="Mes badges" icon="sparkles">
        <div className="badges">
          {summary.badges.map((b) => { const [glyph, tone] = BADGE_ART[b.id] || ['record', 'violet']; const fresh = b.got && !seenBadges.includes(b.id); return <div key={b.id} className={`badge3d ${b.got ? 'got' : 'locked'} ${fresh ? 'unlock' : ''}`}><Badge3D unlocked={b.got} glyph={glyph} tone={tone} label={b.label} size={68} /><span className="small"><b>{b.label}</b></span><span className="xs muted">{b.cond}</span>
            {!b.got && b.goal != null && <><div className="bar thin"><span style={{ width: `${Math.round((b.cur / b.goal) * 100)}%` }} /></div><span className="xs muted">{Number(b.cur).toLocaleString('fr-FR')} / {Number(b.goal).toLocaleString('fr-FR')}</span></>}
            {fresh && <span className="xs unlock-tag">Débloqué !</span>}</div>; })}
        </div>
        <p className="muted small mt">Série en cours : {summary.streak} semaine{summary.streak > 1 ? 's' : ''} d’affilée avec au moins une séance.</p>
      </Card>

      <Fold title="Barème" icon="info">
        <p className="small"><b>Général, sur 100</b> : régularité 40 % (tes séances par rapport à <i>ton</i> objectif), progression 30 % (part de tes exercices où tu bats ton propre record), participation 30 % (jours actifs, 6 sur 7 suffisent).</p>
        <p className="small">Faire plus que ton objectif ne rapporte rien de plus, et un jour de repos ne coûte rien : le classement récompense la constance et le progrès, pas le volume. Un débutant peut battre un costaud.</p>
        <ul className="small rules-list">{CATEGORIES.map((c) => <li key={c.id}><b>{c.label}</b> : {c.hint}</li>)}</ul>
        <button className="btn xs ghost mt" onClick={() => setLeave(true)}>Quitter la ligue</button>
      </Fold>
      </>}
      <ComposeSheet draft={draft} onClose={() => setDraft(null)} board={board} me={m.member_id} curKey={weekKey} onSent={() => { loadFeed(); setView('feed'); }} />
      <MemberSheet member={member} onClose={() => setMember(null)} board={board} me={m.member_id} curKey={weekKey} monthKey={monthKey} rows={weekRows} feed={feed} onCompose={compose} onProgram={(x) => { setMember(null); setProg(x); }} onChat={(x) => { setMember(null); openChat(x); }} />
      <CompSheet id={compId} onClose={() => setCompId(null)} board={board} me={m.member_id} onChanged={loadComps} />
      <CreateComp open={creating} onClose={() => setCreating(false)} board={board} me={m.member_id} today={comps?.today || summary.periods[0].from} onCreated={(id) => { setCreating(false); loadComps(); setView('comps'); setCompId(id); }} />
      <PeopleSheet open={people} onClose={() => setPeople(false)} board={board} me={m.member_id} trophies={comps?.trophies || {}} onOpen={(x) => { setPeople(false); setMember(x); }} onInvite={invite} onRenamed={load} />
      <ProgramSheet member={prog} onClose={() => setProg(null)} onAdvice={openChat} />
      <ChatSheet chat={chat} onClose={() => setChat(null)} me={m.member_id} onRead={onRead} />

      <Sheet open={stakeEdit != null} onClose={() => setStakeEdit(null)} title={kind === 'week' ? 'Enjeu de la semaine' : 'Enjeu du mois'}
        footer={<button className="btn primary block" onClick={async () => { try { await setStake(kind, stakeEdit); setStakeEdit(null); load(); toast('Enjeu enregistré'); } catch (e) { toast(e.message, 'err'); } }}>Enregistrer</button>}>
        <Field label="Ce que doit faire le dernier du classement général" hint="Visible par toute la ligue. Laisse vide pour retirer l’enjeu.">
          <input value={stakeEdit || ''} onChange={(e) => setStakeEdit(e.target.value)} maxLength={120} placeholder="Paie le café à tout le monde" />
        </Field>
      </Sheet>
      <ShortcutSheet open={shortcut} onClose={() => setShortcut(false)} m={m} url={board.league.shortcut_url} onSaved={load} />
      <Confirm open={leave} onClose={() => setLeave(false)} danger title="Quitter la ligue ?" confirmLabel="Quitter"
        text="Tu disparais du classement. Tes données d’entraînement restent sur ton téléphone." onConfirm={async () => { try { await leaveLeague(); onLeft(); } catch (e) { toast(e.message, 'err'); } }} />
    </Page>
  );
}

// Accueil de la ligue : l'essentiel visible tout de suite
function LeagueHome({ board, me, comps, events, weekRows, onOpen, onCreate, onInvite, onPeople, onAll, onBoard }) {
  const list = comps?.list || [];
  const live = list.filter((c) => c.status === 'active' || c.status === 'closing').sort((a, b) => a.end.localeCompare(b.end));
  const next = list.filter((c) => c.status === 'upcoming').sort((a, b) => a.start.localeCompare(b.start))[0];
  const invites = list.filter((c) => c.my_state === 'invited' && ['upcoming', 'active'].includes(c.status));
  const results = list.filter((c) => c.status === 'finished').slice(0, 3);
  const myRank = weekRows.findIndex((r) => r.id === me) + 1;
  const name = (id) => board.members.find((x) => x.id === id)?.pseudo || 'Ancien membre';
  const evText = (e) => ({
    comp_created: `${name(e.member)} a lancé « ${e.data?.title} »`,
    comp_finished: e.data?.success != null ? `« ${e.data?.title} » : objectif collectif ${e.data.success ? 'atteint' : 'manqué'}` : e.member ? `${name(e.member)} remporte « ${e.data?.title} »` : `« ${e.data?.title} » est terminée`,
    workout: `${name(e.member)} a terminé une séance`,
    record: `${name(e.member)} a battu ${e.data?.n > 1 ? `${e.data.n} records` : 'un record'}`,
  }[e.kind] || e.kind);
  const evIcon = { comp_created: 'flame', comp_finished: 'trophy', workout: 'dumbbell', record: 'up' };
  return (<>
    <section className="lg-hero">
      <div className="lg-avatars">{board.members.slice(0, 5).map((x) => <Avatar key={x.id} member={x} size={34} />)}{board.members.length > 5 && <span className="lg-more">+{board.members.length - 5}</span>}</div>
      <div className="lg-stats">
        <div><b className="num-l">{board.members.length}</b><span className="xs">membres</span></div>
        <div><b className="num-l">{live.length}</b><span className="xs">en cours</span></div>
        <div><b className="num-l">{myRank || '—'}<sup>{myRank === 1 ? 'er' : myRank ? 'e' : ''}</sup></b><span className="xs">ta place (semaine)</span></div>
      </div>
      <div className="lg-actions">
        <button className="btn primary" onClick={onCreate}><Icon name="plus" size={16} />Compétition</button>
        <button className="btn" onClick={onInvite}><Icon name="user" size={16} />Inviter</button>
        <button className="btn" onClick={onPeople}><Icon name="menu" size={16} />Membres</button>
      </div>
    </section>

    {invites.map((c) => <button key={c.id} className="lg-invite" onClick={() => onOpen(c)}><Icon name="flame" size={18} /><span className="grow"><b>Invitation : {c.title}</b><span className="xs muted">{COMP_BY_ID[c.metric]?.label} · touche pour voir les règles et accepter</span></span><Icon name="right" size={16} /></button>)}

    <div className="lg-sec"><h2>Compétitions en cours</h2><button className="link small" onClick={onAll}>Tout voir</button></div>
    {!comps ? <Loading /> : live.length ? <div className="comp-rail">{live.map((c) => <CompCard key={c.id} c={c} board={board} me={me} onOpen={onOpen} />)}</div>
      : <button className="comp-empty" onClick={onCreate}><Icon name="trophy" size={26} /><p>Aucune compétition en cours.<br /><b>Lance la première</b> : pas, séances, régularité…</p></button>}
    {next && <><div className="lg-sec"><h2>Prochaine</h2></div><CompCard c={next} board={board} me={me} onOpen={onOpen} wide /></>}

    <div className="lg-sec"><h2>Classement de la semaine</h2><button className="link small" onClick={onBoard}>Détail</button></div>
    <ol className="standings mini">{weekRows.slice(0, 3).concat(myRank > 3 ? [weekRows[myRank - 1]] : []).map((r) => {
      const rank = weekRows.indexOf(r) + 1;
      return <li key={r.id} className={r.id === me ? 'me' : ''}><span className="st-rank">{rank}</span><Avatar member={board.members.find((x) => x.id === r.id)} size={30} /><span className="grow"><b>{r.pseudo}</b></span><span className="st-score mono">{r.value}<span className="unit-s"> pts</span></span></li>;
    })}</ol>

    {results.length > 0 && <><div className="lg-sec"><h2>Résultats récents</h2></div>
      <ul className="lg-results">{results.map((c) => <li key={c.id}><button onClick={() => onOpen(c)}><Icon name="trophy" size={18} /><span className="grow"><b>{c.title}</b><span className="xs muted">{c.mode === 'team' ? (c.success ? 'Objectif collectif atteint' : 'Objectif collectif manqué') : c.winner ? `Gagné par ${name(c.winner)}` : 'Aucun gagnant'}</span></span><Icon name="right" size={14} /></button></li>)}</ul></>}

    {events.length > 0 && <><div className="lg-sec"><h2>Activité récente</h2></div>
      <ul className="lg-events">{events.slice(0, 6).map((e) => <li key={e.id}><span className={`lg-ev-ico k-${e.kind}`}><Icon name={evIcon[e.kind] || 'info'} size={14} /></span><span className="grow small">{evText(e)}</span><span className="xs muted">{ago(e.at)}</span></li>)}</ul></>}
  </>);
}

// Membres : rôles, palmarès (victoires figées), renommer la ligue (admin)
function PeopleSheet({ open, onClose, board, me, trophies, onOpen, onInvite, onRenamed }) {
  const toast = useToast(); const [name, setName] = useState(null);
  const admin = board.members.find((x) => x.id === me)?.role === 'admin';
  return (
    <Sheet open={open} onClose={onClose} title={`Membres (${board.members.length})`} footer={<button className="btn primary block" onClick={onInvite}><Icon name="plus" size={16} />Inviter des amis · code {board.league.code}</button>}>
      <ul className="comp-people big">{board.members.map((x) => <li key={x.id}><button onClick={() => onOpen(x)}><Avatar member={x} size={36} /><span className="grow"><b>{x.pseudo}</b>{x.id === me && <span className="muted"> (toi)</span>}
        <span className="xs muted">{x.role === 'admin' ? 'Admin · ' : ''}membre depuis {new Date(x.since).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span></span>
        {trophies[x.id] > 0 && <span className="tag good"><Icon name="trophy" size={12} />{trophies[x.id]}</span>}</button></li>)}</ul>
      {admin && <><h4 className="h-sub">Paramètres (admin)</h4>
        <Field label="Nom de la ligue"><div className="row gap-s"><input value={name ?? board.league.name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <button className="btn sm" disabled={!name || name === board.league.name} onClick={async () => { try { await renameLeague(name); toast('Ligue renommée'); setName(null); onRenamed(); } catch (e) { toast(e.message, 'err'); } }}>Enregistrer</button></div></Field></>}
    </Sheet>
  );
}

function Podium({ rows, me, unit, fmt }) {
  const top = rows.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  return (
    <div className="podium">
      {order.map((r, i) => {
        const place = [2, 1, 3][i];
        return (
          <div key={place} className={`step p${place} ${r && r.id === me ? 'me' : ''}`}>
            <span className="who">{r && r.value > 0 ? r.pseudo : '—'}</span>
            <span className="val mono">{r && r.value > 0 ? `${fmt(r.value)} ${unit}` : ''}</span>
            <div className="block"><b>{place}</b></div>
          </div>
        );
      })}
    </div>
  );
}

function HealthCard({ onOpen }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { getHealth(7).then(setRows).catch(() => setRows([])); }, []);
  const last = rows?.at(-1);
  const today = new Date(); const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const nf = (v, d = 0) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d });
  return (
    <Card title="Mes données Santé" icon="heart" action={<button className="btn xs primary" onClick={onOpen}>{last ? 'Raccourci' : 'Connecter'}</button>}>
      {!rows ? <p className="muted small">Chargement…</p> : !last
        ? <p className="small">Relie l’app Santé de ton iPhone : pas, distance, calories actives, pouls au repos et sommeil arrivent tout seuls chaque soir. Touche <b>Connecter</b>.</p>
        : <>
          <div className="health-grid">
            {last.steps != null && <div><b className="mono">{nf(last.steps)}</b><span className="muted small">pas</span></div>}
            {last.km != null && <div><b className="mono">{nf(last.km, 1)}</b><span className="muted small">km</span></div>}
            {last.kcal != null && <div><b className="mono">{nf(last.kcal)}</b><span className="muted small">kcal actives</span></div>}
            {last.rhr != null && <div><b className="mono">{last.rhr}</b><span className="muted small">pouls repos</span></div>}
            {last.sleep_h != null && <div><b className="mono">{nf(last.sleep_h, 1)} h</b><span className="muted small">sommeil</span></div>}
          </div>
          <p className="muted small">{last.day === iso ? 'Reçu aujourd’hui' : `Dernier envoi : ${new Date(last.day + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`} à {new Date(last.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.</p>
        </>}
    </Card>
  );
}

function ShortcutSheet({ open, onClose, m, url, onSaved }) {
  const toast = useToast();
  const key = personalKey(m);
  const [guide, setGuide] = useState(false); const [link, setLink] = useState('');
  const copy = async (t, what) => { try { await navigator.clipboard.writeText(t); toast(`Copié : ${what.toLowerCase()}`); } catch { toast('Copie impossible : sélectionne le texte', 'err'); } };
  const template = `${SANTE_BASE}[Texte]&pas=[Statistiques]&km=[Statistiques 2]&kcal=[Statistiques 3]&fc=[Échantillons de santé 4]&sommeil=[Statistiques 5]`;
  const saveLink = async () => { try { await setShortcutUrl(link); toast('Lien enregistré : tes amis peuvent installer le raccourci'); setLink(''); onSaved(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <Sheet open={open} onClose={onClose} title="Relier l’app Santé">
      {url ? <>
        <ol className="howto big">
          <li><button className="btn primary block" onClick={() => copy(key, 'Ta clé')}>1. Copier ma clé</button></li>
          <li><a className="btn primary block" href={url} target="_blank" rel="noreferrer">2. Installer le raccourci</a><span className="muted small">Touche <b>Configurer le raccourci</b>, colle ta clé quand elle est demandée, puis <b>Ajouter</b>. Autorise l’accès à Santé au premier lancement.</span></li>
          <li><b>3. Tous les soirs, tout seul</b><span className="muted small">App Raccourcis → onglet <b>Automatisation</b> → <b>+</b> → <b>Heure de la journée</b> (22 h, chaque jour) → <b>Exécuter immédiatement</b> → « GymTrack Santé ».</span></li>
        </ol>
        <p className="muted small">Chaque envoi remplace les chiffres du jour : le lancer plusieurs fois ne compte pas en double.</p>
      </> : <p className="small">Le raccourci de la ligue n’existe pas encore. Une seule personne le crée (2 minutes de plus que le précédent), puis colle son lien ici : tous les autres l’installeront en un geste.</p>}

      <button className="btn sm ghost block mt" onClick={() => setGuide(!guide)}>{guide ? 'Masquer le guide' : url ? 'Recréer le raccourci (guide)' : 'Je le crée : afficher le guide'}</button>
      {guide && <>
        <ol className="howto mt">
          <li>App <b>Raccourcis</b> → <b>+</b>. Nomme-le <b>GymTrack Santé</b>.</li>
          <li>Action <b>Texte</b> : colle ta clé <button className="btn xs" onClick={() => copy(key, 'Ta clé')}>Copier ma clé</button></li>
          <li><b>Rechercher des échantillons de santé</b> : <b>Nombre de pas</b>, date de début <b>Aujourd’hui</b>. Puis <b>Calculer les statistiques</b> : <b>Somme</b>.</li>
          <li>Pareil avec <b>Distance (marche et course)</b> → Somme, puis <b>Énergie active</b> → Somme.</li>
          <li><b>Rechercher des échantillons de santé</b> : <b>Fréquence cardiaque au repos</b>, trier par <b>Date de début</b>, <b>Plus récent en premier</b>, limite <b>1</b>.</li>
          <li><i>Facultatif</i> : <b>Analyse du sommeil</b> sur les dernières 24 h → <b>Calculer les statistiques</b> : Somme.</li>
          <li><b>Obtenir le contenu de l’URL</b> : écris l’adresse ci-dessous en remplaçant chaque [crochet] par la variable du même nom (touche-la au-dessus du clavier). Tu peux enlever les morceaux que tu n’as pas faits.</li>
          <li><b>Afficher le résultat</b> (facultatif), puis ▶︎ pour tester : « GymTrack ✓ … pas · … km » doit s’afficher.</li>
          <li><b>Pour le partager sans ta clé</b> : appui long sur le raccourci → <b>Dupliquer</b>. Dans la copie, remplace ta clé par <b>COLLE-TA-CLÉ</b>, ouvre ses réglages (ⓘ) → <b>Configuration</b> / questions d’importation → ajoute une question sur l’action <b>Texte</b> : « Colle ta clé GymTrack ». Puis <b>Partager</b> → <b>Copier le lien iCloud</b>, et colle-le ci-dessous.</li>
        </ol>
        <Field label="Adresse à mettre dans « Obtenir le contenu de l’URL »"><div className="copy-row"><code>{template}</code><button className="btn xs" onClick={() => copy(SANTE_BASE, 'Début de l’adresse')}>Copier</button></div></Field>
        <Field label="Lien iCloud du raccourci partagé" hint="Visible par toute la ligue. Il ne contient pas ta clé si tu as suivi l’étape 9.">
          <div className="row gap-s"><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.icloud.com/shortcuts/…" /><button className="btn sm" disabled={!link} onClick={saveLink}>Enregistrer</button></div>
        </Field>
      </>}
    </Sheet>
  );
}
