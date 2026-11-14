import { MuscleFigures } from './BodyMap.jsx';
import MoveFigure from './MoveFigure.jsx';
import { useEffect, useState } from 'react';
import { Sheet, Icon, Loading } from './ui.jsx';
import { findLib, imgs, CATS, LEVELS, MUSCLE_FR, MUSCLES_APP } from '../lib/exlib.js';

// Les 2 photos (position de départ / d'arrivée) en alternance : on voit le mouvement
export function DemoImages({ x, size = 'lg' }) {
  const list = imgs(x); const [i, setI] = useState(0); const [err, setErr] = useState(false);
  useEffect(() => { if (list.length < 2) return undefined; const t = setInterval(() => setI((v) => (v + 1) % list.length), 1100); return () => clearInterval(t); }, [list.length]);
  // Pas de photo (ou hors connexion) : illustration animée dessinée à partir du mouvement
  if (!list.length || err) return <MoveFigure x={x} size={size} />;
  return (
    <div className={`demo-img ${size}`}>
      {list.map((src, k) => <img key={src} src={src} alt="" loading="lazy" className={k === i ? 'on' : ''} onError={() => setErr(true)} />)}
      {list.length > 1 && <span className="demo-step">{i === 0 ? 'Départ' : 'Arrivée'}</span>}
    </div>
  );
}

// Fiche d'un exercice de la bibliothèque : démo, muscles, consignes
export function ExerciseInfo({ libId, x: given, open, onClose, footer }) {
  const [x, setX] = useState(given || null);
  useEffect(() => { if (open && !given && libId) findLib(libId).then(setX); if (given) setX(given); }, [open, libId, given]);
  const steps = x?.i || [];
  const tr = `https://translate.google.com/?sl=en&tl=fr&op=translate&text=${encodeURIComponent(steps.join('\n'))}`;
  return (
    <Sheet open={open} onClose={onClose} title={x?.n || 'Exercice'} footer={footer}>
      {!x ? <Loading /> : (<>
        <DemoImages x={x} />
        <div className="chips mt-s">
          <span className="chip on">{CATS[x.c] || x.c}</span><span className="chip">{x.q}</span><span className="chip">{LEVELS[x.l] || ''}</span>
        </div>
        {x.m && Object.keys(x.m).length > 0 ? (<div className="ex-muscles">
          <MuscleFigures muscles={x.m} />
          <div className="grow">
            <h3 className="h-sub">Muscles travaillés</h3>
            {Object.entries(x.m).filter(([, v]) => v >= 1).length > 0 && <p className="small"><span className="mdot mdot-main" /><b>Principal :</b> {Object.entries(x.m).filter(([, v]) => v >= 1).map(([k]) => MUSCLES_APP[k] || k).join(', ')}</p>}
            {Object.entries(x.m).filter(([, v]) => v > 0 && v < 1).length > 0 && <p className="small"><span className="mdot mdot-sec" /><b>Secondaire :</b> {Object.entries(x.m).filter(([, v]) => v > 0 && v < 1).map(([k]) => MUSCLES_APP[k] || k).join(', ')}</p>}
          </div>
        </div>) : (x.p?.length > 0 || x.t?.length > 0) && <p className="small mt-s"><b>Muscles :</b> {(x.p?.length ? x.p.map((m) => MUSCLE_FR[m] || m) : x.t.map((m) => MUSCLES_APP[m] || m)).join(', ')}</p>}
        {steps.length > 0 && (<>
          <h3 className="h-sub">Exécution {!x.fr && <span className="muted small">(en anglais)</span>}</h3>
          <ol className="demo-steps">{steps.map((s, k) => <li key={k}>{s}</li>)}</ol>
          {!x.fr && <a className="btn sm ghost" href={tr} target="_blank" rel="noreferrer"><Icon name="right" size={14} />Traduire en français</a>}
        </>)}
        <p className="muted small mt-s">{x.en}</p>
      </>)}
    </Sheet>
  );
}
