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
