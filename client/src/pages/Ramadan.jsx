import { useEffect, useState } from 'react';
import { useApi, Page, Card, Icon, Field, Segmented, Loading, useToast } from '../components/ui.jsx';
import { put } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';

// Mode Ramadan : horaires du jour, séance placée autour du ftour, repas répartis, séance allégée pendant le jeûne
export default function Ramadan() {
  const { data, setData } = useApi('/ramadan'); const [f, setF] = useState(null); const [locating, setLocating] = useState(false); const toast = useToast();
  useEffect(() => { if (data && !f) setF({ ...data.settings }); }, [data, f]);
  if (!data || !f) return <Loading />;
  const save = async (patchF = {}) => {
    const body = { ...f, ...patchF }; setF(body);
    try { setData(await put('/ramadan', body)); toast('Réglages Ramadan enregistrés'); } catch (e) { toast(e.message, 'err'); }
  };
  const locate = () => {
    if (!navigator.geolocation) { toast('Position indisponible : saisis tes horaires', 'err'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); save({ lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100 }); },
      () => { setLocating(false); toast('Position refusée : saisis tes horaires à la main', 'err'); }, { timeout: 10000 });
  };
  const usesPos = f.lat != null && f.lon != null;

  return (
    <Page title="Ramadan">
      <Card title="Mode Ramadan" icon="moon" action={<input type="checkbox" role="switch" className="switch" aria-label="Mode Ramadan" checked={f.on} onChange={(e) => save({ on: e.target.checked })} />}>
        {!f.on ? <p className="muted">Active-le pour adapter tes séances, tes repas et ton eau pendant le jeûne.</p> : (
          data.active
            ? <p><b>Jour {data.day} sur {data.days}.</b> Tes séances gardent les charges actuelles{data.lighten?.minus_set ? ', avec une série de moins par exercice et 30 s de repos en plus' : ''}.</p>
            : <p className="muted">Du {fmtDate(f.start, { day: 'numeric', month: 'long' })} au {fmtDate(f.end, { day: 'numeric', month: 'long', year: 'numeric' })}. Rien ne change avant le premier jour.</p>
        )}
      </Card>

      {f.on && (<>
        <Card title="Aujourd’hui" icon="clock">
          {data.ftour ? (
            <div className="ram-times">
              <div><span className="muted xs">Shour, avant</span><b>{data.shour || '—'}</b></div>
              <div><span className="muted xs">Ftour</span><b>{data.ftour}</b></div>
              {data.train_at && <div><span className="muted xs">Séance conseillée</span><b>{data.train_at}</b></div>}
            </div>
          ) : <p className="muted">Ajoute ta position ou tes horaires ci-dessous pour voir l’heure de séance conseillée.</p>}
          {data.source === 'position' && <p className="muted xs mt-s">Calculé depuis ta position (coucher du soleil, aube à 18°). Suis toujours l’horaire de ta mosquée s’il diffère.</p>}
          <p className="small mt-s">{f.when === 'avant_ftour'
            ? 'Séance courte juste avant le ftour : tu manges dès la fin, ce qui sert de repas de récupération. Bois bien au shour.'
            : 'Séance 1 h 30 après le ftour : tu as mangé et bu, c’est le moment où tu es le plus fort pendant le Ramadan.'}</p>
        </Card>

        <Card title="Repas" icon="food">
          <div className="ram-meals">{data.meals.map((m) => (
            <div key={m.key}><span className="muted xs">{m.label}</span><b>{m.kcal ? `${m.kcal.toLocaleString('fr-FR')} kcal` : '—'}</b>{m.protein_g != null && <span className="small">{m.protein_g} g de protéines</span>}</div>
          ))}</div>
          {!data.meals[0].kcal && <p className="muted small mt-s">Renseigne ton profil (poids, taille, âge) pour voir les calories.</p>}
          <ul className="small tips-list">
            <li><b>Ftour :</b> dattes et eau, une soupe, puis un vrai plat (protéines, féculents, légumes).</li>
            <li><b>Après la séance :</b> 30 à 40 g de protéines (shaker, lben, œufs, poulet).</li>
            <li><b>Shour :</b> sucres lents et protéines qui tiennent longtemps (avoine, pain complet, œufs, fromage blanc), et 2 verres d’eau.</li>
            <li><b>Eau :</b> environ {String(data.water_l).replace('.', ',')} L entre le ftour et le shour, en petites quantités : 2 verres au ftour, 2 après la séance, 2 avant de dormir, 2 au shour.</li>
            <li>La créatine se prend à n’importe quel repas, par exemple au ftour.</li>
          </ul>
        </Card>

        <Card title="Réglages" icon="edit">
          <div className="row gap-s">
            <Field label="Début" className="grow"><input type="date" value={f.start} onChange={(e) => e.target.value && save({ start: e.target.value })} /></Field>
            <Field label="Fin" className="grow"><input type="date" value={f.end} onChange={(e) => e.target.value && save({ end: e.target.value })} /></Field>
          </div>
          {data.settings.estimated && <p className="muted xs">Dates estimées : ajuste-les selon l’annonce officielle.</p>}
          <Field label="Quand je m’entraîne"><Segmented value={f.when} onChange={(v) => save({ when: v })} options={[['apres_ftour', 'Après le ftour'], ['avant_ftour', 'Avant le ftour']]} /></Field>
          <Field label="Horaires">
            <div className="row gap-s wrap">
              <button className="btn sm" onClick={locate} disabled={locating}><Icon name="target" size={14} />{locating ? 'Localisation…' : usesPos ? 'Mettre à jour ma position' : 'Utiliser ma position'}</button>
              {usesPos && <button className="btn sm ghost" onClick={() => save({ lat: null, lon: null })}>Saisir à la main</button>}
            </div>
          </Field>
          {!usesPos && (
            <div className="row gap-s">
              <Field label="Ftour" className="grow"><input type="time" value={f.ftour || ''} onChange={(e) => save({ ftour: e.target.value })} /></Field>
              <Field label="Fin du shour" className="grow"><input type="time" value={f.shour || ''} onChange={(e) => save({ shour: e.target.value })} /></Field>
            </div>
          )}
          {usesPos && <p className="muted xs">Ta position reste sur ce téléphone (arrondie à environ 1 km) et sert seulement à calculer les horaires.</p>}
        </Card>
      </>)}
    </Page>
  );
}
