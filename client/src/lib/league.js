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
  // Totaux par jour pour les compétitions (remplacés à chaque synchro, jamais additionnés)
  if (summary.days?.length) await rpc('ligue_days', { p_member: m.member_id, p_token: m.token, p_days: summary.days }).catch(() => {});
  const board = await rpc('ligue_board', { p_member: m.member_id, p_token: m.token, p_periods: summary.periods.map(({ key, from, to }) => ({ key, from, to })) });
  for (const p of summary.periods) PERIOD_BY_KEY[p.key] = p;
  return { summary, board };
}

// Scores équitables (v7) : on récompense la régularité par rapport à SON objectif, la progression et la participation,
// pas le volume. Au-delà de l'objectif, rien de plus : s'entraîner plus que prévu ne fait pas gagner, se reposer ne fait pas perdre.
const DAY = 86400000;
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY) + 1;
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const PERIOD_BY_KEY = {};
const per = (x) => (typeof x === 'string' ? PERIOD_BY_KEY[x] : x);
export function elapsedDays(period) { period = per(period); if (!period) return 7; const t = todayIso(); const end = period.to < t ? period.to : t; return Math.max(1, daysBetween(period.from, end)); }
export function regularity(s, period) {
  if (!s) return 0; const target = s.target || 4; const exp = Math.max(1, Math.round((target * elapsedDays(period)) / 7));
  return Math.min(1, (s.workouts + Math.min(s.cardio_n || 0, 1) * 0.5) / exp);
}
// Part des exercices travaillés sur la période où tu as battu ton propre record : un débutant et un costaud partent à égalité
export const progression = (s) => (s && s.trained >= 2 ? Math.min(1, s.improved / s.trained) : null);
// Jours actifs, plafonnés à 6 sur 7 : un jour de repos par semaine ne coûte rien
export function participation(s, period) { if (!s) return 0; const d = elapsedDays(period); const cap = Math.max(1, Math.round(d * 6 / 7)); return Math.min(1, (s.active_days ?? Math.min(d, s.workouts + (s.cardio_n || 0))) / cap); }
export function fairScore(s, period) {
  if (!s) return 0; const r = regularity(s, period); const p = progression(s); const a = participation(s, period);
  return Math.round(p == null ? (r * 40 + a * 30) / 70 * 100 : r * 40 + p * 30 + a * 30);
}
export const ironScore = (s) => (s ? Math.min(s.workouts, (s.target || 4) + 1) * POINTS.workout + s.prs * POINTS.record : 0);
export const totalPoints = (s, _steps, period) => fairScore(s, period);

const pct = (v) => `${Math.round(v * 100)}`;
export const CATEGORIES = [
  { id: 'points', label: 'Général', short: 'Champion', unit: 'pts', value: (s, steps, per) => fairScore(s, per), hint: 'Régularité 40 % · progression 30 % · participation 30 %' },
  { id: 'regularity', label: 'Régularité', short: 'Régulier', unit: '%', value: (s, _, per) => regularity(s, per) * 100, fmt: (v) => pct(v / 100), hint: 'Séances faites par rapport à ton propre objectif' },
  { id: 'progress', label: 'Progression', short: 'Progression', unit: '%', value: (s) => (progression(s) ?? 0) * 100, fmt: (v) => pct(v / 100), hint: 'Part de tes exercices où tu as battu ton record' },
  { id: 'participation', label: 'Participation', short: 'Présent', unit: '%', value: (s, _, per) => participation(s, per) * 100, fmt: (v) => pct(v / 100), hint: 'Jours actifs (6 sur 7 suffisent pour le maximum)' },
  { id: 'iron', label: 'Iron', short: 'Iron', unit: 'pts', value: (s) => ironScore(s), hint: `Séances muscu (jusqu’à ton objectif + 1) × ${POINTS.workout} + records × ${POINTS.record}` },
  { id: 'km', label: 'Runner', short: 'Runner', unit: 'km', value: (s) => s?.km || 0, fmt: (v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }), hint: 'Kilomètres de cardio' },
  { id: 'steps', label: 'Marcheur', short: 'Marcheur', unit: 'pas', value: (_, steps) => steps || 0, fmt: (v) => v.toLocaleString('fr-FR'), hint: 'Pas envoyés depuis l’iPhone ou saisis' },
];

export function ranking(board, periodKey, cat, period) {
  return board.members
    .map((m) => { const p = m.periods?.[periodKey] || {}; return { id: m.id, pseudo: m.pseudo, photo: m.photo, value: cat.value(p.stats, p.steps, period ?? per(periodKey)), stats: p.stats, steps: p.steps || 0 }; })
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
// Sa propre photo de la ligue (pour le visuel du bilan), gardée en cache sur le téléphone
const PHOTO = 'gt_league_photo';
export async function myPhoto() {
  const m = getMembership(); if (!m) return null;
  try { const b = await rpc('ligue_board', { p_member: m.member_id, p_token: m.token, p_periods: [] }); const p = b.members.find((x) => x.id === m.member_id)?.photo || null; if (p) store.set(PHOTO, p); else store.del(PHOTO); return p; } catch { return store.get(PHOTO) || null; }
}
export const hidePost = (id) => rpc('ligue_post_hide', { ...auth(), p_post: id });
export const REACTIONS = [['fire', '🔥'], ['muscle', '💪'], ['clap', '👏'], ['heart', '❤️'], ['laugh', '😂']];
export const react = (post, emoji) => rpc('ligue_react', { ...auth(), p_post: post, p_emoji: emoji });
export const comment = (post, body) => rpc('ligue_comment', { ...auth(), p_post: post, p_body: body });
export const hideComment = (id) => rpc('ligue_comment_hide', { ...auth(), p_id: id });

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

// Notifications push (Web Push) : l'iPhone les autorise seulement si l'appli est ajoutée à l'écran d'accueil (iOS 16.4+)
const VAPID_PUBLIC = 'BFnYJCjnHaKA0Bel7vtLNQoa4rNmiwXJrPPpn1xJXU02JUr185-BEVMEezqnrKa6mRS4KS2cp7LVe5TW7hdwol8';
const PUSH = 'gt_league_push';
const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
export function pushSupport() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { ok: false, reason: ios && !standalone ? 'install' : 'unsupported' };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  return { ok: true, ios, standalone };
}
export const pushPrefs = () => store.get(PUSH);
export async function enablePush(prefs = { dm: true, post: true, challenge: true }) {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications refusées');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) });
  const j = sub.toJSON();
  await rpc('ligue_push_sub', { ...auth(), p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_prefs: prefs });
  store.set(PUSH, prefs);
}
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
    if (sub) { await rpc('ligue_push_off', { ...auth(), p_endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
  } finally { store.del(PUSH); }
}

// ---------- Compétitions (v9) : toute la logique (scores, classements, fin, résultats) est calculée par la base ----------
export const getComps = () => rpc('ligue_comps', auth());
export const getComp = (id) => rpc('ligue_comp', { ...auth(), p_id: id });
export const createComp = (c) => rpc('ligue_comp_create', { ...auth(), p_c: c });
export const respondComp = (id, action) => rpc('ligue_comp_respond', { ...auth(), p_id: id, p_action: action });
export const inviteComp = (id, members) => rpc('ligue_comp_invite', { ...auth(), p_id: id, p_members: members });
export const cancelComp = (id) => rpc('ligue_comp_cancel', { ...auth(), p_id: id });
export const getEvents = (limit = 40) => rpc('ligue_events', { ...auth(), p_limit: limit });
export const renameLeague = (name) => rpc('ligue_settings', { ...auth(), p_name: name });

const nf = (v, d = 0) => Number(v || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
// Types de compétition réellement calculables avec les données disponibles (pas Apple Santé, séances validées, cardio, records)
export const COMP_TYPES = [
  { id: 'steps', label: 'Pas', icon: 'heart', tone: 'steps', unit: 'pas', team: true, fmt: (v) => nf(v), rule: 'Total de pas envoyés par l’app Santé (raccourci) ou saisis. Un seul total par jour, remplacé à chaque envoi : jamais compté deux fois.', teamGoal: 300000 },
  { id: 'goal_days', label: 'Objectif quotidien', icon: 'target', tone: 'goal', unit: 'jours', fmt: (v) => nf(v), rule: 'Un point par jour où tu atteins l’objectif de pas fixé.', needsGoal: true },
  { id: 'workouts', label: 'Séances', icon: 'dumbbell', tone: 'iron', unit: 'séances', team: true, fmt: (v) => nf(v), rule: 'Séances de muscu avec au moins une série validée. Une par jour au maximum, et 6 jours sur 7 au plus : le repos ne coûte rien.', teamGoal: 30 },
  { id: 'active_days', label: 'Régularité', icon: 'calendar', tone: 'reg', unit: 'jours', team: true, fmt: (v) => nf(v), rule: 'Jours avec une séance de muscu ou de cardio. 6 jours sur 7 suffisent pour le maximum.', teamGoal: 40 },
  { id: 'sets', label: 'Volume', icon: 'chart', tone: 'vol', unit: 'séries', fmt: (v) => nf(v), rule: 'Séries validées, 30 par jour au maximum pour ne pas pousser au surentraînement.' },
  { id: 'prs', label: 'Progression', icon: 'up', tone: 'prog', unit: 'records', fmt: (v) => nf(v), rule: 'Records personnels battus (ta meilleure charge sur un exercice). 5 par jour au maximum. Chacun se bat contre lui-même.' },
  { id: 'km', label: 'Cardio km', icon: 'bolt', tone: 'run', unit: 'km', team: true, fmt: (v) => nf(v, 1), rule: 'Kilomètres de cardio enregistrés, 42,2 km par jour au maximum.', teamGoal: 150 },
  { id: 'cardio_min', label: 'Cardio minutes', icon: 'timer', tone: 'run', unit: 'min', team: true, fmt: (v) => nf(v), rule: 'Minutes de cardio enregistrées, 3 h par jour au maximum.', teamGoal: 1200 },
];
export const COMP_BY_ID = Object.fromEntries(COMP_TYPES.map((t) => [t.id, t]));
export const DURATIONS = [[1, '24 h'], [3, '3 jours'], [7, '7 jours'], [14, '14 jours'], [30, '30 jours']];
export const STATUS_LABEL = { upcoming: 'À venir', active: 'En cours', closing: 'Résultats provisoires', finished: 'Terminée' };

const DAYMS = 86400000;
export const dayDiff = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAYMS);
export function timeLeft(c) {
  if (c.status === 'upcoming') { const d = dayDiff(c.today, c.start); return d <= 1 ? 'Commence demain' : `Commence dans ${d} jours`; }
  if (c.status === 'active') {
    const d = dayDiff(c.today, c.end);
    if (d === 0) { const now = new Date(); const h = 23 - now.getHours(); return h <= 0 ? 'Dernière heure' : `Finit dans ${h} h`; }
    return d === 1 ? 'Finit demain soir' : `Encore ${d + 1} jours`;
  }
  if (c.status === 'closing') return 'Résultats figés demain (synchros en retard comptées)';
  return `Terminée le ${new Date(c.end + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}
export function progressOf(c) {
  const total = dayDiff(c.start, c.end) + 1;
  if (c.status === 'upcoming') return 0;
  if (c.status !== 'active') return 1;
  return Math.min(1, (dayDiff(c.start, c.today) + 1) / total);
}
export const durationLabel = (c) => { const n = dayDiff(c.start, c.end) + 1; return n === 1 ? '24 h' : `${n} jours`; };
