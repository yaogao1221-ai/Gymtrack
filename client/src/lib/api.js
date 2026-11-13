// Client API : jeton, date locale, file d'attente hors ligne pour les séances (synchro automatique)
const TOKEN_KEY = 'gt_token';
const OUTBOX_KEY = 'gt_outbox';
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
};
export { store };

export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const getToken = () => store.get(TOKEN_KEY);
export const setToken = (t) => (t ? store.set(TOKEN_KEY, t) : store.del(TOKEN_KEY));

export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const listeners = new Set();
export const onAuthRequired = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// PAGES : version GitHub Pages (données dans le téléphone, sans Claude ni serveur)
export const PAGES = !!import.meta.env.VITE_PAGES;
export const STANDALONE = !!import.meta.env.VITE_STANDALONE || PAGES;
// La ligue a besoin d'internet vers Supabase : pas dans la vue Claude (réseau externe bloqué)
export const LEAGUE_ON = !STANDALONE || PAGES;
let local;
async function localApi(path, method, body, raw) {
  local ||= await import('../local/server.js');
  const r = await local.handle(path, { method, body, today: today() });
  if (raw) return r;
  if (r.status >= 400) throw new ApiError(r.status, r.data?.error || `Erreur ${r.status}`);
  return r.data;
}

// Bus de données : toute écriture réussie prévient les écrans ouverts, qui se rechargent (une seule source : la base)
const dataListeners = new Set();
export const onDataChange = (fn) => { dataListeners.add(fn); return () => dataListeners.delete(fn); };
export const emitDataChange = (path) => dataListeners.forEach((fn) => { try { fn(path); } catch { /* écouteur fautif ignoré */ } });

export async function api(path, opts = {}) {
  const r = await rawApi(path, opts);
  if ((opts.method || 'GET') !== 'GET' && !opts.raw) emitDataChange(path);
  return r;
}
async function rawApi(path, { method = 'GET', body, raw } = {}) {
  if (STANDALONE) return localApi(path, method, body, raw);
  const headers = { 'X-Local-Date': today() };
  const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try { res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch { throw new ApiError(0, 'Pas de connexion au serveur'); }
  if (res.status === 401 && !path.startsWith('/auth')) listeners.forEach((fn) => fn());
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Erreur ${res.status}`);
  return data;
}
export const get = (p) => api(p);
export const post = (p, body = {}) => api(p, { method: 'POST', body });
export const put = (p, body = {}) => api(p, { method: 'PUT', body });
export const patch = (p, body = {}) => api(p, { method: 'PATCH', body });
export const del = (p) => api(p, { method: 'DELETE' });

// Envoi « sûr » : si le réseau tombe (salle de sport en sous-sol…), on met en file et on resynchronise plus tard.
export async function postOrQueue(path, body) {
  try { return { data: await post(path, body), queued: false }; }
  catch (e) {
    if (e.status !== 0 && e.status < 500) throw e;
    const box = store.get(OUTBOX_KEY, []);
    if (!box.some((x) => x.body.client_id === body.client_id)) box.push({ path, body, at: Date.now() });
    store.set(OUTBOX_KEY, box);
    return { data: null, queued: true };
  }
}
export const outboxCount = () => store.get(OUTBOX_KEY, []).length;
export async function flushOutbox() {
  const box = store.get(OUTBOX_KEY, []); if (!box.length) return 0;
  const left = []; let sent = 0;
  for (const item of box) {
    try { await post(item.path, item.body); sent++; }
    catch (e) { if (e.status === 0 || e.status >= 500 || e.status === 401) left.push(item); }
  }
  store.set(OUTBOX_KEY, left);
  return sent;
}
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// Téléchargement d'un export (fonctionne avec ou sans serveur)
export async function downloadFile(path, filename) {
  let blob;
  if (STANDALONE) {
    const r = await localApi(path, 'GET', undefined, true);
    if (r.status >= 400) throw new ApiError(r.status, r.data?.error || 'Erreur');
    blob = r.text != null ? new Blob([r.text], { type: 'text/csv;charset=utf-8' }) : new Blob([JSON.stringify(r.data, null, 1)], { type: 'application/json' });
  } else {
    const res = await fetch(downloadUrl(path));
    if (!res.ok) throw new ApiError(res.status, 'Téléchargement impossible');
    blob = await res.blob();
  }
  if (PAGES) {
    // iPhone : la feuille de partage permet « Enregistrer dans Fichiers », AirDrop, mail…
    const f = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title: filename }); }
      catch (e) { if (e?.name === 'AbortError') return; throw new ApiError(0, 'Partage impossible'); }
      try { localStorage.setItem('gt_last_export', JSON.stringify(today())); } catch { /* */ }
      return;
    }
  } else if (STANDALONE) {
    // Dans Claude, un téléchargement passe par la capacité « downloads » (confirmation de l'utilisateur)
    const dl = await window.claude?.use?.('downloads');
    if (!dl) throw new ApiError(0, 'Téléchargement indisponible dans cette vue');
    try { await dl.save({ filename, data: blob }); }
    catch (e) { if (e?.code === 'declined') return; throw new ApiError(0, e?.message || 'Téléchargement impossible'); }
    try { localStorage.setItem('gt_last_export', JSON.stringify(today())); } catch { /* */ }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  try { localStorage.setItem('gt_last_export', JSON.stringify(today())); } catch { /* */ }
}

export function downloadUrl(path) {
  const t = getToken(); const sep = path.includes('?') ? '&' : '?';
  return `/api${path}${sep}today=${today()}${t ? `&token=${t}` : ''}`;
}
