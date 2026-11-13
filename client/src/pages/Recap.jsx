import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Page, Card, Icon, Segmented, Loading, ErrorBox, useApi, useToast } from '../components/ui.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';
import { addDays, n0, n1, mins } from '../lib/format.js';
import { drawRecap, verdict, recapRange } from '../lib/recapImage.js';
import { LEAGUE_ON } from '../lib/api.js';
import { getMembership, postMessage, myPhoto } from '../lib/league.js';

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const delta = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
const range = recapRange;

export function recapText(r, pseudo) {
  const parts = [`${r.cur.workouts} séance${r.cur.workouts > 1 ? 's' : ''}`, `${r.cur.sets} séries`];
  if (r.cur.volume_lbs) parts.push(`${n0(r.cur.volume_lbs)} lbs soulevées`);
  if (r.cur.cardio_km) parts.push(`${n1(r.cur.cardio_km)} km de cardio`);
  if (r.records.length) parts.push(`${r.records.length} record${r.records.length > 1 ? 's' : ''}`);
  return `Bilan de ${pseudo || 'ma'} semaine : ${parts.join(' · ')}.`.slice(0, 200);
}

// Visuel prêt à l'avance : sur iPhone, le partage doit partir directement du toucher
function useRecapImage(r, name, format, photo) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!r) return undefined; let url = null; let alive = true;
    drawRecap(r, name, format, photo).then((blob) => { if (!alive || !blob) return; url = URL.createObjectURL(blob); setImg({ blob, url, format }); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [r, name, format, photo]);
  return img;
}

export default function Recap() {
  const toast = useToast(); const [off, setOff] = useState(0); const [busy, setBusy] = useState(false);
  const { data: r, error, reload } = useApi(`/recap?offset=${off}`, [off]);
  const m = LEAGUE_ON ? getMembership() : null;
  const [format, setFormat] = useState('story'); const [photo, setPhoto] = useState(null);
  useEffect(() => { if (m) myPhoto().then(setPhoto); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const img = useRecapImage(r, m?.pseudo || r?.name || '', format, photo);
  if (error && !r) return <Page tabs={<SectionTabs group="progress" />} title="Bilan"><ErrorBox error={error} retry={reload} /></Page>;
  if (!r) return <Page tabs={<SectionTabs group="progress" />} title="Bilan"><Loading /></Page>;
  const name = m?.pseudo || r.name || '';
  const dW = delta(r.cur.workouts, r.prev.workouts); const dV = delta(r.cur.volume_lbs, r.prev.volume_lbs);
  const file = img ? new File([img.blob], `gymtrack-bilan-${r.from}-${img.format}.jpg`, { type: 'image/jpeg' }) : null;
  const canShare = !!file && !!navigator.canShare?.({ files: [file] });
  const save = () => { const a = document.createElement('a'); a.href = img.url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); toast('Image enregistrée'); };
  // Image seule, sans texte : iPhone la traite alors comme une photo (Insta, Snap, Enregistrer l'image)
  const share = () => {
    if (!file) return;
    if (!canShare) { save(); return; }
    navigator.share({ files: [file] }).catch((e) => { if (e?.name !== 'AbortError') save(); });
  };
  const publish = async () => {
    setBusy(true);
    try { await postMessage(null, 'bravo', recapText(r, name)); toast('Bilan publié dans le fil de la ligue'); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const Delta = ({ v }) => (v == null || v === 0 ? null : <span className={`delta small ${v > 0 ? 'up' : 'down'}`}>{v > 0 ? '+' : ''}{v} %</span>);
  return (
    <Page tabs={<SectionTabs group="progress" />} title="Bilan de la semaine" subtitle={range(r)}>
      <Segmented value={off} onChange={setOff} options={[[0, 'Cette semaine'], [1, 'Semaine dernière']]} />
      <div className="recap-card">
        <p className="recap-verdict">{verdict(r)}</p>
        <div className="recap-tiles">
          <div className="t-fire"><b>{r.cur.workouts}{r.target ? <span>/{r.target}</span> : null}</b><span>séances <Delta v={dW} /></span></div>
          <div className="t-violet"><b>{n0(r.cur.sets)}</b><span>séries validées</span></div>
          <div className="t-orange"><b>{n0(r.cur.volume_lbs)}</b><span>lbs soulevées <Delta v={dV} /></span></div>
          <div className="t-aqua"><b>{r.cur.cardio_km ? n1(r.cur.cardio_km) : n0(r.cur.cardio_minutes)}</b><span>{r.cur.cardio_km ? 'km de cardio' : 'min de cardio'}</span></div>
        </div>
        <div className="recap-days">
          {DAYS.map((d, i) => <span key={i} className={r.active_days.includes(addDays(r.from, i)) ? 'on' : ''}>{d}</span>)}
        </div>
        <p className="muted small">{r.cur.training_minutes ? `${mins(r.cur.training_minutes)} de muscu` : ''}{r.cur.avg_rpe ? ` · effort moyen ${n1(r.cur.avg_rpe)}/10` : ''}{r.streak > 1 ? ` · ${r.streak} semaines d’affilée` : ''}</p>
      </div>
      {r.records.length > 0 && (
        <Card title="Records de la semaine" icon="trophy">
          <ul className="plain-list">{r.records.map((x, i) => <li key={i}><span className="grow">{x.name}</span><span className="mono small">{n1(x.previous)} → <b>{n1(x.weight)}</b> {x.unit}{x.assisted ? ' d’assistance' : ''}</span></li>)}</ul>
        </Card>
      )}
      {(r.body?.weight != null || r.body?.waist != null || r.body?.plan || r.goals?.length > 0) && (
        <Card title="Corps et objectifs" icon="scale" action={<Link className="link" to="/corps">Corps</Link>}>
          <ul className="plain-list">
            {r.body.weight != null && <li><span className="grow">Poids moyen ({r.body.weigh_ins} pesée{r.body.weigh_ins > 1 ? 's' : ''})</span><span className="mono small"><b>{n1(r.body.weight)} kg</b>{r.body.weight_change != null ? ` · ${r.body.weight_change > 0 ? '+' : ''}${n1(r.body.weight_change)} kg vs semaine d’avant` : ''}</span></li>}
            {r.body.waist != null && <li><span className="grow">Tour de taille</span><span className="mono small"><b>{n1(r.body.waist)} cm</b>{r.body.waist_change != null ? ` · ${r.body.waist_change > 0 ? '+' : ''}${n1(r.body.waist_change)} cm` : ''}</span></li>}
            {r.goals?.map((g) => <li key={g.title}><span className="grow">{g.title}</span><span className={`small ${g.reached ? 'ok-text' : 'mono'}`}>{g.reached ? 'Atteint' : g.progress != null ? `${Math.round(g.progress * 100)} %` : '—'}</span></li>)}
          </ul>
          {r.body.plan && <p className="muted small mt-s"><b>{r.body.plan.label}, semaine {r.body.plan.week}/{r.body.plan.weeks}.</b> {r.body.plan.check}</p>}
          <p className="muted small">Ces chiffres restent privés : ils ne figurent pas sur l’image partagée.</p>
        </Card>
      )}
      {r.muscles.length > 0 && (
        <Card title="Muscles les plus travaillés" icon="target">
          {r.muscles.map((x) => { const max = r.muscles[0].sets || 1; return <div key={x.muscle} className="bar-row"><span className="small">{x.label}</span><div className="bar"><span style={{ width: `${(x.sets / max) * 100}%` }} /></div><span className="mono small">{n1(x.sets)}</span></div>; })}
          <p className="muted small mt">Séries pondérées par muscle sollicité.</p>
        </Card>
      )}
      <Card title="Partager sur Insta, Snap…" icon="upload">
        <Segmented value={format} onChange={setFormat} options={[['story', 'Story 9:16'], ['post', 'Post 4:5']]} />
        <div className={`recap-preview ${format}`}>{img && img.format === format ? <img src={img.url} alt="Aperçu du visuel du bilan" /> : <Loading />}</div>
        <p className="muted small">{canShare ? 'Touche Partager puis choisis Instagram, Snapchat ou « Enregistrer l’image ».' : 'L’image sera enregistrée : publie-la ensuite depuis ta galerie.'}</p>
      </Card>
      <div className="row gap-s wrap">
        <button className="btn primary" disabled={!img} onClick={share}><Icon name="upload" size={16} />{canShare ? 'Partager l’image' : 'Enregistrer l’image'}</button>
        {m && <button className="btn" disabled={busy} onClick={publish}><Icon name="trophy" size={16} />Publier dans la ligue</button>}
      </div>
    </Page>
  );
}
