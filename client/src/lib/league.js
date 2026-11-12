// Ligue entre amis : base partagée Supabase (projet « gymtrack-ligue »), accessible seulement par fonctions RPC.
// Chaque membre a un identifiant + un jeton secret gardés sur son téléphone. Seuls des totaux sont envoyés.
import { get, store } from './api.js';

export const LEAGUE_URL = 'https://osrhhlqtstbxzecmfobm.supabase.co';
const KEY = 'sb_publishable_L48MGoKPcoawJMvpeYw12w_g7HH2iy3'; // clé publique (anon) : les droits sont dans les fonctions SQL
export const LEAGUE_KEY = KEY;
const LS = 'gt_league';

export const POINTS = { workout: 10, km: 5, record: 15, steps1000: 1 };

export const getMembership = () => store.get(LS);
export const setMembership = (m) => (m ? store.set(LS, m) : store.del(LS));
// Clé personnelle : sert au raccourci iPhone et à récupérer son accès sur un nouveau téléphone
export const personalKey = (m) => (m ? `${m.member_id}.${m.token}` : '');

export async function rpc(fn, body) {
  let res;
  try {
    res = await fetch(`${LEAGUE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch { throw new Error('Pas de connexion : la ligue a besoin d’internet'); }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = new Error(data?.message || `Erreur ${res.status}`); e.code = data?.code; throw e;
  }
  return data;
}

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } };

export async function createLeague(name, pseudo) {
  const r = await rpc('ligue_create', { p_name: name, p_pseudo: pseudo });
  setMembership(r); await afterJoin(r); return r;
}
export async function joinLeague(code, pseudo) {
  const r = await rpc('ligue_join', { p_code: code, p_pseudo: pseudo });
  setMembership(r); await afterJoin(r); return r;
}
async function afterJoin(m) { const z = tz(); if (z) await rpc('ligue_tz', { p_member: m.member_id, p_token: m.token, p_tz: z }).catch(() => {}); }

// Récupération sur un autre téléphone : on colle sa clé personnelle
export async function restoreFromKey(key) {
  const [member_id, token] = String(key || '').trim().split('.');
  if (!member_id || !token) throw new Error('Clé incomplète');
  await pushShare();
  const board = await rpc('ligue_board', { p_member: member_id, p_token: token, p_periods: [] });
  const me = board.members.find((x) => x.id === member_id);
  const m = { member_id, token, code: board.league.code, league: board.league.name, pseudo: me?.pseudo };
  setMembership(m); await afterJoin(m); return m;
}

export async function leaveLeague() {
  const m = getMembership(); if (!m) return;
  await rpc('ligue_leave', { p_member: m.member_id, p_token: m.token });
  setMembership(null);
}
export const setStake = (kind, text) => { const m = getMembership(); return rpc('ligue_stake', { p_member: m.member_id, p_token: m.token, p_kind: kind, p_text: text }); };
export const sendSteps = (steps) => rpc('ligue_pas', { p_key: personalKey(getMembership()), p_steps: steps });

// Envoie ses totaux (semaine/mois en cours et précédents), puis récupère le tableau de la ligue
export async function syncBoard() {
  const m = getMembership(); if (!m) return null;
  const summary = await get('/league/summary');
  await rpc('ligue_push', { p_member: m.member_id, p_token: m.token, p_periods: summary.periods.map(({ key, kind, from, to, stats }) => ({ key, kind, from, to, stats })) });
  const board = await rpc('ligue_board', { p_member: m.member_id, p_token: m.token, p_periods: summary.periods.map(({ key, from, to }) => ({ key, from, to })) });
  return { summary, board };
}

// Scores
export const ironScore = (s) => (s ? s.workouts * POINTS.workout + s.sets + s.prs * POINTS.record : 0);
export const totalPoints = (s, steps) => (s ? s.workouts * POINTS.workout + Math.round(s.km * POINTS.km) + s.prs * POINTS.record : 0) + Math.floor((steps || 0) / 1000) * POINTS.steps1000;

export const CATEGORIES = [
  { id: 'points', label: 'Classement général', short: 'Champion', unit: 'pts', value: (s, steps) => totalPoints(s, steps) },
  { id: 'km', label: 'Runner', short: 'Runner', unit: 'km', value: (s) => s?.km || 0, fmt: (v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) },
  { id: 'iron', label: 'Iron (muscu)', short: 'Iron', unit: 'pts', value: (s) => ironScore(s) },
  { id: 'steps', label: 'Marcheur', short: 'Marcheur', unit: 'pas', value: (_, steps) => steps || 0, fmt: (v) => v.toLocaleString('fr-FR') },
];

export function ranking(board, periodKey, cat) {
  return board.members
    .map((m) => { const p = m.periods?.[periodKey] || {}; return { id: m.id, pseudo: m.pseudo, value: cat.value(p.stats, p.steps), stats: p.stats, steps: p.steps || 0 }; })
    .sort((a, b) => b.value - a.value || a.pseudo.localeCompare(b.pseudo));
}

// Données Santé envoyées par le raccourci iPhone
export const healthLink = (m) => `${LEAGUE_URL}/functions/v1/sante?k=${personalKey(m)}`;
export const SANTE_BASE = `${LEAGUE_URL}/functions/v1/sante?k=`;
export async function getHealth(days = 30) {
  const m = getMembership(); if (!m) return null;
  const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  return rpc('ligue_health', { p_member: m.member_id, p_token: m.token, p_from: from });
}
export const setShortcutUrl = (url) => { const m = getMembership(); return rpc('ligue_shortcut', { p_member: m.member_id, p_token: m.token, p_url: url }); };

// Conseils de récupération à partir du sommeil et du pouls au repos (jamais d'ordre, juste un signal)
export function healthAdvice(rows) {
  if (!rows?.length) return null;
  const last7 = rows.slice(-7);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const sleep = last7.map((r) => Number(r.sleep_h)).filter((x) => x > 0);
  const rhrAll = rows.map((r) => r.rhr).filter((x) => x > 0);
  const lastNight = rows.at(-1)?.sleep_h != null ? Number(rows.at(-1).sleep_h) : null;
  const baseline = rhrAll.length >= 5 ? avg(rhrAll.slice(0, -1)) : null;
  const todayRhr = rows.at(-1)?.rhr ?? null;
  const tips = [];
  if (lastNight != null && lastNight < 6) tips.push({ level: 'warn', text: `Nuit courte (${lastNight.toLocaleString('fr-FR')} h) : garde tes charges, vise la technique et évite d’ajouter du volume aujourd’hui.` });
  if (baseline && todayRhr && todayRhr >= baseline + 5) tips.push({ level: 'warn', text: `Pouls au repos à ${todayRhr} (ta moyenne : ${Math.round(baseline)}) : signe de fatigue ou de début de rhume. Séance légère ou cardio doux.` });
  if (sleep.length >= 4 && avg(sleep) < 7) tips.push({ level: 'info', text: `Moyenne de sommeil sur 7 jours : ${avg(sleep).toFixed(1).replace('.', ',')} h. Viser 7 à 9 h aide la récupération et la progression.` });
  if (!tips.length && (lastNight != null || todayRhr)) tips.push({ level: 'ok', text: 'Sommeil et pouls au repos dans ta normale : feu vert pour ta séance prévue.' });
  return { avgSleep: avg(sleep), baseline, todayRhr, lastNight, tips };
}

// Lobby : photo de profil, fil de messages (féliciter, motiver, chambrer)
const auth = () => { const m = getMembership(); return { p_member: m.member_id, p_token: m.token }; };
export const setPhoto = (photo) => rpc('ligue_photo', { ...auth(), p_photo: photo });
export const getFeed = () => rpc('ligue_feed', { ...auth(), p_limit: 80 });
export const postMessage = (target, tone, body) => rpc('ligue_post', { ...auth(), p_target: target || null, p_tone: tone, p_body: body });
export const hidePost = (id) => rpc('ligue_post_hide', { ...auth(), p_post: id });

// Recadre au carré et compresse (≈ 10 Ko) : la photo est stockée dans la ligue
export async function resizePhoto(file, size = 192) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Image illisible')); i.src = url; });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas'); c.width = c.height = size;
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

const FEED_SEEN = 'gt_league_feed_seen';
export const feedSeen = () => store.get(FEED_SEEN) || '';
export const markFeedSeen = (iso) => store.set(FEED_SEEN, iso);

export const TONES = [
  { id: 'bravo', label: '👏 Féliciter', short: 'Bravo' },
  { id: 'motive', label: '💪 Motiver', short: 'Motivation' },
  { id: 'chambre', label: '😈 Chambrer', short: 'Chambrage' },
];

// Phrases toutes prêtes, adaptées aux chiffres de la personne visée
export function quickLines(tone, p, s) {
  const n = p || 'toi';
  const km = s?.km ? s.km.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : null;
  const w = s?.workouts || 0;
  if (tone === 'bravo') return [
    `Énorme semaine ${n}, respect !`,
    w ? `${w} séance${w > 1 ? 's' : ''} cette semaine, machine.` : `Propre ${n}, continue comme ça.`,
    km ? `${km} km au compteur, les jambes de feu !` : `Bien joué ${n}, ça paie.`,
    s?.prs ? `Record battu, la barre a pleuré.` : `Régulier comme une horloge, chapeau.`,
  ];
  if (tone === 'motive') return [
    `Allez ${n}, une séance et tu remontes au classement !`,
    `On t’attend à la salle ${n}, pas d’excuse.`,
    `Petite sortie cardio demain ? Je te suis.`,
    `La régularité gagne toujours. Lâche rien.`,
  ];
  return [
    w ? `${w} séance${w > 1 ? 's' : ''} ? Moi je fais ça en échauffement.` : `${n}, t’as confondu la salle et le canapé ?`,
    km ? `${km} km… tu cours ou tu promènes le chien ?` : `Ta paire de baskets se demande si elle a un propriétaire.`,
    `Le podium a envoyé un avis de recherche : ${n}, vu nulle part.`,
    `Prépare ta carte bleue ${n}, l’enjeu c’est pour toi.`,
    `${n} soulève surtout des excuses.`,
  ];
}

export function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400); return d === 1 ? 'hier' : d < 7 ? `il y a ${d} j` : new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Programme partagé (volontaire) et messages privés
const SHARE = 'gt_league_share';
export const shareEnabled = () => store.get(SHARE) === true;
export async function setShareEnabled(on) {
  if (on) { await rpc('ligue_share', { ...auth(), p_data: await get('/league/share') }); store.set(SHARE, true); }
  else { await rpc('ligue_share', { ...auth(), p_data: null }); store.del(SHARE); }
}
export async function pushShare() { if (!shareEnabled()) return; try { await rpc('ligue_share', { ...auth(), p_data: await get('/league/share') }); } catch { /* réessayé à la prochaine synchro */ } }
export const getShared = (of) => rpc('ligue_shared', { ...auth(), p_of: of });
export const dmInbox = () => rpc('ligue_dm_inbox', auth());
export const dmThread = (w) => rpc('ligue_dm_thread', { ...auth(), p_with: w });
export const dmSend = (to, body, about) => rpc('ligue_dm_send', { ...auth(), p_to: to, p_body: body, p_about: about || null });
export const dmHide = (w) => rpc('ligue_dm_hide', { ...auth(), p_with: w });

// Défis de la ligue (semaine ou mois en cours)
export const getChallenges = (periods) => rpc('ligue_challenges', { ...auth(), p_periods: periods });
export const createChallenge = (title, metric, target, kind, period) => rpc('ligue_challenge_create', { ...auth(), p_title: title, p_metric: metric, p_target: target, p_kind: kind, p_period: period });
export const hideChallenge = (id) => rpc('ligue_challenge_hide', { ...auth(), p_id: id });
