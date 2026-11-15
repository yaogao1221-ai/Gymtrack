import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, Icon, Sheet, Field, useToast } from './ui.jsx';
import { post, put } from '../lib/api.js';

// Compléments du jour : une case par complément, avec la série de jours d'affilée
export function Supplements() {
  const { data, setData, reload } = useApi('/supplements'); const [edit, setEdit] = useState(null); const toast = useToast();
  if (!data) return null;
  const toggle = async (it) => {
    const next = { ...data, items: data.items.map((x) => (x.key === it.key ? { ...x, done: !x.done } : x)) };
    setData?.(next);
    try { const r = await post('/supplements/toggle', { key: it.key, on: !it.done }); setData ? setData(r) : reload(); } catch (e) { toast(e.message, 'err'); reload(); }
  };
  const save = async () => {
    try { const r = await put('/supplements', { items: edit.filter((x) => x.label.trim()) }); setEdit(null); setData ? setData(r) : reload(); toast('Compléments enregistrés'); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <div className="supps">
      <div className="supps-head"><span className="small"><b>Compléments</b></span><button className="link small" onClick={() => setEdit(data.items.map((x) => ({ ...x })))}>Modifier</button></div>
      {data.items.length === 0 ? <p className="muted small">Aucun complément suivi.</p> : (
        <div className="supps-row">
          {data.items.map((it) => (
            <button key={it.key} className={`supp ${it.done ? 'on' : ''}`} onClick={() => toggle(it)} aria-pressed={it.done}>
              <span className="chk">{it.done && <Icon name="check" size={13} stroke={3} />}</span>
              <span className="supp-txt"><b>{it.label}</b>{it.dose && <span className="muted xs">{it.dose}</span>}</span>
              {it.streak > 1 && <span className="supp-streak" title={`${it.streak} jours d’affilée`}><Icon name="flame" size={12} />{it.streak} j</span>}
            </button>
          ))}
        </div>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Mes compléments" footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Annuler</button><button className="btn primary" onClick={save}>Enregistrer</button></>}>
        {edit && (<>
          {edit.map((x, i) => (
            <div key={i} className="row gap-s supp-edit">
              <Field label="Nom" className="grow"><input value={x.label} maxLength={40} onChange={(e) => setEdit(edit.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} /></Field>
              <Field label="Dose"><input value={x.dose || ''} maxLength={20} placeholder="5 g" onChange={(e) => setEdit(edit.map((y, j) => (j === i ? { ...y, dose: e.target.value } : y)))} /></Field>
              <button className="icon-btn sm danger" aria-label="Retirer" onClick={() => setEdit(edit.filter((_, j) => j !== i))}><Icon name="trash" size={14} /></button>
            </div>
          ))}
          {edit.length < 8 && <button className="btn sm ghost" onClick={() => setEdit([...edit, { key: '', label: '', dose: '' }])}><Icon name="plus" size={14} />Ajouter</button>}
          <p className="muted small mt-s">Exemples : créatine 5 g, protéines 30 g, eau 2,5 L, vitamine D, oméga-3. Les séries de jours se gardent si tu changes la dose.</p>
        </>)}
      </Sheet>
    </div>
  );
}

// Bandeau Ramadan sur l'accueil : jour, horaires et heure de séance conseillée
export function RamadanStrip() {
  const { data } = useApi('/ramadan');
  if (!data || !(data.active || data.soon)) return null;
  if (data.soon) return <Link to="/nutrition?v=ramadan" className="ramadan-strip"><Icon name="moon" size={16} /><span className="grow small">Ramadan dans {Math.max(1, Math.round((new Date(data.settings.start) - new Date(data.today || Date.now())) / 864e5))} jours : prépare tes horaires et tes repas</span><Icon name="right" size={14} /></Link>;
  return (
    <Link to="/nutrition?v=ramadan" className="ramadan-strip">
      <Icon name="moon" size={16} />
      <span className="grow small"><b>Ramadan · jour {data.day}/{data.days}</b>
        {data.ftour ? <> · ftour {data.ftour}{data.shour ? ` · shour avant ${data.shour}` : ''}{data.train_at ? ` · séance vers ${data.train_at}` : ''}</> : ' · indique tes horaires'}</span>
      <Icon name="right" size={14} />
    </Link>
  );
}
