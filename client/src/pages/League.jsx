import { useCallback, useEffect, useState } from 'react';
import { Page, Card, Icon, Field, Segmented, Sheet, Confirm, Loading, NumInput, useToast } from '../components/ui.jsx';
import {
  getMembership, createLeague, joinLeague, restoreFromKey, leaveLeague, setStake, sendSteps, syncBoard,
  ranking, CATEGORIES, POINTS, personalKey, LEAGUE_URL, LEAGUE_KEY,
} from '../lib/league.js';

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
    <Page title="Ligue" subtitle="Défie tes amis chaque semaine et chaque mois">
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
        {mode === 'restore' && <Field label="Ta clé personnelle" hint="Elle s’affiche dans la ligue, rubrique « Mes pas ». Utile après un changement de téléphone."><input value={f.key} onChange={set('key')} className="mono" placeholder="xxxxxxxx-….xxxx" /></Field>}
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
  const load = useCallback(async () => {
    setError(null);
    try { setData(await syncBoard()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data && !error) return <Page title="Ligue"><Loading /></Page>;
  if (!data) return <Page title="Ligue"><Card><p className="warn-text small">{error}</p><button className="btn sm" onClick={load}>Réessayer</button></Card></Page>;

  const { summary, board } = data;
  const cur = summary.periods.find((p) => p.kind === kind && p.current);
  const prev = summary.periods.find((p) => p.kind === kind && !p.current);
  const category = CATEGORIES.find((c) => c.id === cat);
  const rows = ranking(board, cur.key, category);
  const label = kind === 'week' ? 'semaine' : 'mois';
  const fmt = (c, v) => (c.fmt ? c.fmt(v) : Math.round(v).toLocaleString('fr-FR'));
  const titles = ['points', 'km', 'iron'].map((id) => {
    const c = CATEGORIES.find((x) => x.id === id); const r = ranking(board, prev.key, c);
    return { c, winner: r[0]?.value > 0 ? r[0] : null };
  });
  const general = ranking(board, cur.key, CATEGORIES[0]);
  const prevGeneral = ranking(board, prev.key, CATEGORIES[0]).filter((r) => r.stats);
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
      <div className="row gap-s wrap mb">
        <button className="btn primary sm" onClick={invite}><Icon name="plus" size={14} />Inviter des amis</button>
      </div>
      {error && <p className="warn-text small">{error}</p>}
      <Segmented value={kind} onChange={setKind} options={[['week', 'Cette semaine'], ['month', 'Ce mois']]} />

      <Card title={kind === 'week' ? 'Titres de la semaine dernière' : 'Titres du mois dernier'} icon="trophy">
        <div className="titles">
          {titles.map(({ c, winner }) => (
            <div key={c.id} className={`title-card t-${c.id}`}>
              <span className="muted small">{c.short === 'Champion' ? 'Champion' : `${c.short} of the ${kind === 'week' ? 'week' : 'month'}`}</span>
              <b>{winner ? winner.pseudo : '—'}</b>
              <span className="small mono">{winner ? `${fmt(c, winner.value)} ${c.unit}` : 'personne'}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Classement de la ${label}`} icon="chart">
        <div className="chips mb">
          {CATEGORIES.map((c) => <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.label}</button>)}
        </div>
        <Podium rows={rows} me={m.member_id} unit={category.unit} fmt={(v) => fmt(category, v)} />
        <ol className="rank-list" start={4}>
          {rows.slice(3).map((r, i) => (
            <li key={r.id} className={r.id === m.member_id ? 'me' : ''}><span className="rank mono">{i + 4}</span><span className="grow">{r.pseudo}</span><b className="mono">{fmt(category, r.value)}</b><span className="muted small">{category.unit}</span></li>
          ))}
        </ol>
        {rows.every((r) => r.value === 0) && <p className="muted small">Personne n’a encore marqué cette {label}. Une séance ou une sortie cardio suffit pour entrer au classement.</p>}
      </Card>

      <Card title={kind === 'week' ? 'Enjeu de la semaine' : 'Enjeu du mois'} icon="flame"
        action={<button className="btn xs" onClick={() => setStakeEdit(stake || '')}><Icon name="edit" size={12} />Modifier</button>}>
        {stake ? <p className="stake">« {stake} »</p> : <p className="muted small">Aucun enjeu fixé. Exemple : « Le dernier paie le café à tout le monde ».</p>}
        {stake && general.length > 1 && <p className="small">Si ça s’arrêtait maintenant : <b>{general.at(-1).pseudo}</b> devrait l’honorer.</p>}
        {stake && prevGeneral.length > 1 && <p className="small">{kind === 'week' ? 'Semaine dernière' : 'Mois dernier'} : <b>{prevGeneral.at(-1).pseudo}</b> doit honorer l’enjeu.</p>}
      </Card>

      <Card title="Mes pas" icon="heart" action={<button className="btn xs" onClick={() => setShortcut(true)}>Raccourci iPhone</button>}>
        <p className="muted small">L’iPhone compte tes pas dans l’app Santé. Le raccourci les envoie à la ligue en un geste, ou automatiquement chaque soir. Tu peux aussi les saisir ici.</p>
        <div className="row gap-s">
          <NumInput value={steps} onChange={setSteps} placeholder="Pas aujourd’hui" />
          <button className="btn sm" disabled={!steps} onClick={saveSteps}>Envoyer</button>
        </div>
      </Card>

      <Card title="Mes badges" icon="sparkles">
        <div className="badges">
          {summary.badges.map((b) => <span key={b.id} className={`badge-pill ${b.got ? 'got' : ''}`}>{b.got && <Icon name="check" size={12} />}{b.label}</span>)}
        </div>
        <p className="muted small mt">Série en cours : {summary.streak} semaine{summary.streak > 1 ? 's' : ''} d’affilée avec au moins une séance.</p>
      </Card>

      <Card title="Barème" icon="info">
        <p className="small">Séance muscu {POINTS.workout} pts · 1 km de cardio {POINTS.km} pts · record battu {POINTS.record} pts · 1 000 pas {POINTS.steps1000} pt.</p>
        <p className="muted small">Iron : séances × {POINTS.workout} + séries validées + records × {POINTS.record}. Les records comptent ta progression à toi, donc un débutant peut battre un costaud.</p>
        <button className="btn xs ghost mt" onClick={() => setLeave(true)}>Quitter la ligue</button>
      </Card>

      <Sheet open={stakeEdit != null} onClose={() => setStakeEdit(null)} title={kind === 'week' ? 'Enjeu de la semaine' : 'Enjeu du mois'}
        footer={<button className="btn primary block" onClick={async () => { try { await setStake(kind, stakeEdit); setStakeEdit(null); load(); toast('Enjeu enregistré'); } catch (e) { toast(e.message, 'err'); } }}>Enregistrer</button>}>
        <Field label="Ce que doit faire le dernier du classement général" hint="Visible par toute la ligue. Laisse vide pour retirer l’enjeu.">
          <input value={stakeEdit || ''} onChange={(e) => setStakeEdit(e.target.value)} maxLength={120} placeholder="Paie le café à tout le monde" />
        </Field>
      </Sheet>
      <ShortcutSheet open={shortcut} onClose={() => setShortcut(false)} m={m} />
      <Confirm open={leave} onClose={() => setLeave(false)} danger title="Quitter la ligue ?" confirmLabel="Quitter"
        text="Tu disparais du classement. Tes données d’entraînement restent sur ton téléphone." onConfirm={async () => { try { await leaveLeague(); onLeft(); } catch (e) { toast(e.message, 'err'); } }} />
    </Page>
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

function ShortcutSheet({ open, onClose, m }) {
  const toast = useToast();
  const key = personalKey(m);
  const copy = async (t, what) => { try { await navigator.clipboard.writeText(t); toast(`${what} copié`); } catch { toast('Copie impossible : sélectionne le texte', 'err'); } };
  const url = `${LEAGUE_URL}/rest/v1/rpc/ligue_pas`;
  return (
    <Sheet open={open} onClose={onClose} title="Raccourci « Mes pas »">
      <ol className="howto">
        <li>Ouvre l’app <b>Raccourcis</b>, touche <b>+</b> et nomme le raccourci « GymTrack pas ».</li>
        <li>Ajoute l’action <b>Rechercher des échantillons de santé</b> : type <b>Nombre de pas</b>, date de début <b>aujourd’hui</b>.</li>
        <li>Ajoute <b>Calculer les statistiques</b> : <b>Somme</b> des échantillons.</li>
        <li>Ajoute <b>Obtenir le contenu de l’URL</b> avec l’adresse ci-dessous, puis touche la flèche : méthode <b>POST</b>, un en-tête <b>apikey</b>, et un corps <b>JSON</b> avec deux champs : <b>p_key</b> (texte : ta clé) et <b>p_steps</b> (nombre : le résultat des statistiques).</li>
        <li>Pour l’envoi automatique : onglet <b>Automatisation</b> → <b>Heure de la journée</b> (par exemple 22 h, tous les jours) → <b>Exécuter immédiatement</b> → choisis ce raccourci.</li>
      </ol>
      <Field label="Adresse (URL)"><div className="copy-row"><code>{url}</code><button className="btn xs" onClick={() => copy(url, 'Adresse')}>Copier</button></div></Field>
      <Field label="En-tête apikey"><div className="copy-row"><code>{LEAGUE_KEY}</code><button className="btn xs" onClick={() => copy(LEAGUE_KEY, 'Clé de l’API')}>Copier</button></div></Field>
      <Field label="Ta clé personnelle (p_key)" hint="Garde-la pour toi : elle permet aussi de récupérer ta place dans la ligue sur un nouveau téléphone."><div className="copy-row"><code>{key}</code><button className="btn xs" onClick={() => copy(key, 'Clé personnelle')}>Copier</button></div></Field>
      <p className="muted small">Chaque envoi remplace le total du jour, tu peux donc le lancer plusieurs fois sans compter en double.</p>
    </Sheet>
  );
}
