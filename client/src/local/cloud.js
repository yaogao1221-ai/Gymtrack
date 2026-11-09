// Sauvegarde durable dans le compte Claude (capacité « db » de l'artifact), privée à l'utilisateur.
// Les données sont compressées puis découpées en morceaux (< 256 Kio par document).
const CHUNK = 180000;
let ctxPromise;

export function cloud() {
  if (import.meta.env.VITE_PAGES) return Promise.resolve(null);
  ctxPromise ||= (async () => {
    try {
      for (let i = 0; i < 30 && !window.claude?.use; i++) await new Promise((r) => setTimeout(r, 100));
      if (!window.claude?.use) return null;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return null;
      const uid = await user.id();
      return uid ? { db, base: `data/users/${uid}` } : null;
    } catch { return null; }
  })();
  return ctxPromise;
}

const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const gz = typeof CompressionStream !== 'undefined';
async function pack(text) {
  if (!gz) return { data: text, enc: 'plain' };
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return { data: b64(new Uint8Array(await new Response(stream).arrayBuffer())), enc: 'gzip-b64' };
}
async function unpack(data, enc) {
  if (enc !== 'gzip-b64') return data;
  const stream = new Blob([unb64(data)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export async function remoteMeta() {
  const c = await cloud(); if (!c) return null;
  const snap = await c.db.doc(`${c.base}/gymtrack_meta`).get();
  return snap.exists ? snap.data() : null;
}

export async function upload(json, updatedAt) {
  const c = await cloud(); if (!c) return false;
  const { data, enc } = await pack(JSON.stringify(json));
  const n = Math.max(1, Math.ceil(data.length / CHUNK));
  for (let i = 0; i < n; i++) await c.db.doc(`${c.base}/gymtrack_c${i}`).set({ d: data.slice(i * CHUNK, (i + 1) * CHUNK) });
  await c.db.doc(`${c.base}/gymtrack_meta`).set({ n, enc, updatedAt, v: 1 });
  return true;
}

export async function download(meta) {
  const c = await cloud(); if (!c) return null;
  let data = '';
  for (let i = 0; i < meta.n; i++) {
    const s = await c.db.doc(`${c.base}/gymtrack_c${i}`).get();
    if (!s.exists) throw new Error('Sauvegarde incomplète');
    data += s.data().d;
  }
  return JSON.parse(await unpack(data, meta.enc));
}
