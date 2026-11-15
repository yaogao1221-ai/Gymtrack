import { useEffect, useMemo, useState } from 'react';
import { useApi, Page, Card, Icon, Sheet, Field, Confirm, useToast } from '../components/ui.jsx';
import { today } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';
import { POSES, listPhotos, savePhoto, deletePhoto, shrink } from '../lib/photoStore.js';

const n1 = (v) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const signed = (v, u) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${n1(Math.abs(v))} ${u}`;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

// Pesée la plus proche (avant ou le jour même, sinon la première après) d'une date de photo
function metricsAt(metrics, date) {
  const before = metrics.filter((m) => m.date <= date);
  const pick = (k) => (before.find((m) => m[k] != null) || [...metrics].reverse().find((m) => m.date > date && m[k] != null))?.[k] ?? null;
  return { weight: pick('weight_kg'), waist: pick('waist_cm') };
}

export default function Photos() {
  const [photos, setPhotos] = useState(null); const [urls, setUrls] = useState({});
  const [pose, setPose] = useState('face'); const [pair, setPair] = useState([null, null]); const [cut, setCut] = useState(50);
  const [add, setAdd] = useState(null); const [view, setView] = useState(null); const [rm, setRm] = useState(null);
  const m = useApi('/body-metrics'); const metrics = m.data || []; const toast = useToast();

  const load = async () => { try { setPhotos(await listPhotos()); } catch { setPhotos([]); } };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!photos) return undefined;
    const u = Object.fromEntries(photos.map((p) => [p.id, URL.createObjectURL(p.blob)])); setUrls(u);
    return () => Object.values(u).forEach((x) => URL.revokeObjectURL(x));
  }, [photos]);

  const ofPose = useMemo(() => (photos || []).filter((p) => p.pose === pose), [photos, pose]);
  const dates = useMemo(() => [...new Set((photos || []).map((p) => p.date))].sort().reverse(), [photos]);
  // Par défaut : la plus ancienne contre la plus récente
  const a = ofPose.find((p) => p.id === pair[0]) || ofPose[0]; const b = ofPose.find((p) => p.id === pair[1]) || ofPose.at(-1);
  const last = dates[0]; const since = last ? days(last, today()) : null;

  const saveAdd = async () => {
    const files = Object.entries(add.files).filter(([, f]) => f);
    if (!files.length) { toast('Choisis au moins une photo', 'err'); return; }
    try {
      for (const [p, f] of files) await savePhoto({ id: `${add.date}-${p}-${Date.now()}`, date: add.date, pose: p, blob: await shrink(f) });
      setAdd(null); await load(); toast('Photos enregistrées sur ce téléphone');
    } catch { toast('Impossible d’enregistrer la photo', 'err'); }
  };
  const share = async (list) => {
    const files = list.map((p) => new File([p.blob], `gymtrack-${p.date}-${p.pose}.jpg`, { type: 'image/jpeg' }));
    if (navigator.canShare?.({ files })) { try { await navigator.share({ files }); } catch { /* annulé */ } return; }
    for (const f of files) { const u = URL.createObjectURL(f); const l = document.createElement('a'); l.href = u; l.download = f.name; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
  };

  if (!photos) return null;
  const ma = a && metricsAt(metrics, a.date); const mb = b && metricsAt(metrics, b.date);
  const two = a && b && a.id !== b.id;

  return (
    <Page title="Photos" actions={<button className="btn primary sm" onClick={() => setAdd({ date: today(), files: {} })}><Icon name="camera" size={15} />Nouvelles photos</button>}>
      {since != null && since >= 28 && <p className="note"><Icon name="camera" size={15} />Tes dernières photos datent de {since} jours : c’est le bon moment pour en refaire.</p>}

      {!photos.length ? (
        <Card title="Photos de progression" icon="camera">
          <p>Une photo de face, de profil et de dos une fois par mois montre ce que la balance ne voit pas.</p>
          <ul className="small muted tips-list"><li>Même endroit, même lumière, même heure (le matin à jeun).</li><li>Téléphone à hauteur de poitrine, à 2 m environ.</li><li>Les photos restent sur ce téléphone et ne sont jamais envoyées.</li></ul>
          <button className="btn primary block mt-s" onClick={() => setAdd({ date: today(), files: {} })}><Icon name="camera" size={15} />Prendre mes premières photos</button>
        </Card>
      ) : (<>
        <div className="chips">{POSES.map(([k, l]) => <button key={k} className={`chip ${pose === k ? 'on' : ''}`} onClick={() => { setPose(k); setPair([null, null]); }}>{l}</button>)}</div>

        <Card title="Avant / après" icon="image">
          {!ofPose.length ? <p className="muted">Pas encore de photo de {POSES.find(([k]) => k === pose)[1].toLowerCase()}.</p> : (<>
            <div className="ba">
              <img src={urls[b.id]} alt={`Après, ${fmtDate(b.date)}`} />
              {two && <div className="ba-before" style={{ clipPath: `inset(0 ${100 - cut}% 0 0)` }}><img src={urls[a.id]} alt={`Avant, ${fmtDate(a.date)}`} /></div>}
              {two && <div className="ba-line" style={{ left: `${cut}%` }} />}
              {two && <span className="ba-tag l">{fmtDate(a.date, { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
              <span className="ba-tag r">{fmtDate(b.date, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
            </div>
            {two && <input className="ba-range" type="range" min="0" max="100" value={cut} onChange={(e) => setCut(Number(e.target.value))} aria-label="Glisser entre avant et après" />}
            {two ? (
              <div className="ba-stats">
                <div><span className="muted xs">Écart</span><b>{days(a.date, b.date)} jours</b></div>
                {ma.weight != null && mb.weight != null && <div><span className="muted xs">Poids</span><b>{signed(mb.weight - ma.weight, 'kg')}</b><span className="muted xs">{n1(ma.weight)} → {n1(mb.weight)}</span></div>}
                {ma.waist != null && mb.waist != null && <div><span className="muted xs">Tour de taille</span><b>{signed(mb.waist - ma.waist, 'cm')}</b><span className="muted xs">{n1(ma.waist)} → {n1(mb.waist)}</span></div>}
              </div>
            ) : <p className="muted small mt-s">Ajoute une deuxième série de photos pour comparer.</p>}
            {ofPose.length > 1 && (
              <div className="row gap-s mt-s">
                <Field label="Avant" className="grow"><select value={a.id} onChange={(e) => setPair([e.target.value, b.id])}>{ofPose.map((p) => <option key={p.id} value={p.id}>{fmtDate(p.date)}</option>)}</select></Field>
                <Field label="Après" className="grow"><select value={b.id} onChange={(e) => setPair([a.id, e.target.value])}>{ofPose.map((p) => <option key={p.id} value={p.id}>{fmtDate(p.date)}</option>)}</select></Field>
              </div>
            )}
          </>)}
        </Card>

        <Card title="Toutes mes photos" icon="calendar" action={<button className="link small" onClick={() => share(photos)}>Exporter</button>}>
          {dates.map((d) => (
            <div key={d} className="ph-day">
              <div className="ph-date"><b>{fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' })}</b>{metricsAt(metrics, d).weight != null && <span className="muted small"> · {n1(metricsAt(metrics, d).weight)} kg</span>}</div>
              <div className="ph-row">{photos.filter((p) => p.date === d).map((p) => <button key={p.id} className="ph-thumb" onClick={() => setView(p)}><img src={urls[p.id]} alt={`${p.pose}, ${fmtDate(d)}`} /><span>{POSES.find(([k]) => k === p.pose)?.[1]}</span></button>)}</div>
            </div>
          ))}
          <p className="muted xs mt-s">Les photos restent sur ce téléphone et ne sont pas dans l’export .json. « Exporter » les envoie dans Photos ou Fichiers.</p>
        </Card>
      </>)}

      <Sheet open={!!add} onClose={() => setAdd(null)} title="Nouvelles photos" footer={<><button className="btn ghost" onClick={() => setAdd(null)}>Annuler</button><button className="btn primary" onClick={saveAdd}>Enregistrer</button></>}>
        {add && (<>
          <Field label="Date"><input type="date" value={add.date} max={today()} onChange={(e) => e.target.value && setAdd({ ...add, date: e.target.value })} /></Field>
          <div className="ph-pick">
            {POSES.map(([k, l]) => (
              <label key={k} className={`ph-slot ${add.files[k] ? 'on' : ''}`}>
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0] || null; if (add.prev?.[k]) URL.revokeObjectURL(add.prev[k]); setAdd({ ...add, files: { ...add.files, [k]: f }, prev: { ...add.prev, [k]: f ? URL.createObjectURL(f) : null } }); }} />
                {add.files[k] ? <img src={add.prev[k]} alt={l} /> : <Icon name="camera" size={22} />}
                <span>{l}</span>
              </label>
            ))}
          </div>
          <p className="muted small">Même endroit et même lumière à chaque fois, pour que la comparaison soit juste.</p>
        </>)}
      </Sheet>

      <Sheet open={!!view} onClose={() => setView(null)} title={view ? `${POSES.find(([k]) => k === view.pose)?.[1]} · ${fmtDate(view.date)}` : ''}
        footer={view && <><button className="btn ghost danger-text" onClick={() => setRm(view)}><Icon name="trash" size={15} />Supprimer</button><button className="btn" onClick={() => share([view])}><Icon name="download" size={15} />Enregistrer</button></>}>
        {view && <img className="ph-full" src={urls[view.id]} alt="" />}
      </Sheet>
      <Confirm open={!!rm} title="Supprimer la photo ?" text="Elle sera effacée de ce téléphone." danger confirmLabel="Supprimer" onClose={() => setRm(null)}
        onConfirm={async () => { await deletePhoto(rm.id); setView(null); setPair([null, null]); load(); }} />
    </Page>
  );
}
