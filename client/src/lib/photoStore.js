// Photos de progression : gardées seulement sur ce téléphone (IndexedDB), jamais envoyées en ligne.
// Base à part de celle des séances pour que l'export .json reste léger.
const DB = 'gymtrack-photos'; const STORE = 'photos';
export const POSES = [['face', 'Face'], ['profil', 'Profil'], ['dos', 'Dos']];

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: 'id' }); s.createIndex('date', 'date'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode); const out = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res(out?.result ?? out); }; t.onerror = () => { db.close(); rej(t.error); };
  });
}
export const listPhotos = async () => (await tx('readonly', (s) => s.getAll())).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
export const savePhoto = (p) => tx('readwrite', (s) => { s.put(p); });
export const deletePhoto = (id) => tx('readwrite', (s) => { s.delete(id); });

// Réduit la photo (1080 px max, JPEG) : ~150 Ko au lieu de plusieurs Mo
export async function shrink(file, max = 1080) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
  } finally { URL.revokeObjectURL(url); }
}
