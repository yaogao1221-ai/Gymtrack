import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, Icon, Segmented, NumInput, Loading, useToast } from './ui.jsx';
import { post, today } from '../lib/api.js';
import { parseMeal, regram, nutr, searchCiqual } from '../lib/foodParse.js';
import { n0 } from '../lib/format.js';

const MEALS = [['petit_dej', 'Petit-déj'], ['dejeuner', 'Déjeuner'], ['collation', 'Collation'], ['diner', 'Dîner']];
const defaultMeal = () => { const h = new Date().getHours(); return h < 10 ? 'petit_dej' : h < 15 ? 'dejeuner' : h < 18 ? 'collation' : 'diner'; };
let foodsCache = null;
const loadFoods = () => (foodsCache ||= import('../data/foods.json').then((m) => m.default));
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const EXAMPLES = ['un verre de lait et 2 œufs', 'une assiette de pâtes avec 150 g de poulet', 'un kebab et un coca', '2 msemen et un thé à la menthe', 'un shaker de whey avec 300 ml de lait'];

// Saisie express : on dit (ou on écrit) ce qu'on a mangé, l'appli reconnaît les aliments et calcule tout de suite
export default function QuickMeal({ open, onClose, day, meal: meal0, onDone }) {
  const [foods, setFoods] = useState(null); const [text, setText] = useState(''); const [meal, setMeal] = useState(null);
  const [edits, setEdits] = useState({}); const [open1, setOpen1] = useState(null); const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false); const [voiceMsg, setVoiceMsg] = useState(null); const [alt, setAlt] = useState('');
  const rec = useRef(null); const area = useRef(null); const base = useRef(''); const toast = useToast();

  useEffect(() => {
    if (!open) { rec.current?.abort?.(); return; }
    loadFoods().then(setFoods).catch(() => setFoods([]));
    setText(''); setEdits({}); setMeal(meal0 || null); setOpen1(null); setVoiceMsg(null); setAlt('');
  }, [open, meal0]);
  useEffect(() => () => rec.current?.abort?.(), []);

  const parsed = useMemo(() => (foods && text.trim() ? parseMeal(text, foods) : { items: [], unknown: [], meal: null }), [foods, text]);
  // Les corrections (autre aliment, autre poids, retiré) restent attachées au morceau de phrase
  const items = parsed.items.map((x, i) => {
    const key = `${i}:${x.raw}`; const e = edits[key] || {};
    let it = e.food ? regram(x, e.food) : x;
    if (e.grams != null) it = { ...it, grams: e.grams };
    return { ...it, key, off: !!e.off };
  });
  const kept = items.filter((x) => !x.off && Number(x.grams) > 0);
  const tot = kept.reduce((a, x) => { const v = nutr(x.food.per100, Number(x.grams)); return { kcal: a.kcal + v.kcal, p: a.p + v.p, g: a.g + v.g, l: a.l + v.l }; }, { kcal: 0, p: 0, g: 0, l: 0 });
  const mealNow = meal || parsed.meal || defaultMeal();
  const edit = (key, patch) => setEdits((m) => ({ ...m, [key]: { ...m[key], ...patch } }));

  const listen = () => {
    if (listening) { rec.current?.stop(); return; }
    if (!SR) { setVoiceMsg('keyboard'); area.current?.focus(); return; }
    try {
      const r = new SR(); rec.current = r; r.lang = 'fr-FR'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      base.current = text.trim() ? `${text.trim()}, ` : '';
      r.onresult = (ev) => { let s = ''; for (let i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript; setText(base.current + s); };
      r.onerror = (ev) => { setListening(false); setVoiceMsg(ev.error === 'no-speech' ? 'silence' : ev.error === 'aborted' ? null : 'keyboard'); if (ev.error !== 'no-speech' && ev.error !== 'aborted') area.current?.focus(); };
      r.onend = () => setListening(false);
      r.start(); setListening(true); setVoiceMsg(null);
    } catch { setListening(false); setVoiceMsg('keyboard'); area.current?.focus(); }
  };

  const save = async () => {
    setBusy(true);
    try {
      for (const x of kept) await post('/food', { name: x.food.name.slice(0, 120), food_code: x.food.code, per100: x.food.per100, grams: Math.min(5000, Math.max(1, Math.round(Number(x.grams)))), meal: mealNow, date: day || today() });
      toast(`${kept.length} aliment${kept.length > 1 ? 's' : ''} ajouté${kept.length > 1 ? 's' : ''} · ${n0(tot.kcal)} kcal`);
      onDone?.(); onClose();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const altList = open1 != null && foods ? (alt.trim() ? searchCiqual(alt, foods, 8) : items.find((x) => x.key === open1)?.alts || []) : [];

  return (
    <Sheet open={open} onClose={onClose} title="Dis ce que tu as mangé"
      footer={<button className="btn primary" disabled={!kept.length || busy} onClick={save}>{busy ? 'Ajout…' : kept.length ? `Ajouter · ${n0(tot.kcal)} kcal` : 'Ajouter'}</button>}>
      <div className="qm-input">
        <textarea ref={area} rows={3} value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="done"
          placeholder="Ex. : un verre de lait, 2 œufs et une tranche de pain" />
        <button type="button" className={`qm-mic ${listening ? 'on' : ''}`} onClick={listen} aria-label={listening ? 'Arrêter la dictée' : 'Parler'}>
          <Icon name="mic" size={22} />
        </button>
      </div>
      {listening && <p className="small qm-live"><span className="qm-dot" />Je t’écoute… parle normalement, puis attends une seconde.</p>}
      {voiceMsg === 'keyboard' && <p className="small muted">Ici, l’iPhone ne laisse pas l’appli écouter directement. Touche le <b>micro du clavier</b> (en bas, à côté de la barre d’espace) et dicte : ça marche pareil.</p>}
      {voiceMsg === 'silence' && <p className="small muted">Je n’ai rien entendu. Touche le micro et parle tout de suite.</p>}
      {!text && <div className="chips mt-s">{EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => setText(x)}>{x}</button>)}</div>}

      {text.trim() && !foods && <Loading />}
      {items.length > 0 && (<>
        <ul className="qm-list">{items.map((x) => {
          const v = nutr(x.food.per100, Number(x.grams) || 0);
          return (
            <li key={x.key} className={x.off ? 'off' : ''}>
              <div className="qm-row">
                <button className="grow qm-name" onClick={() => { setOpen1(open1 === x.key ? null : x.key); setAlt(''); }}>
                  <span className="muted xs">{x.sure ? x.label : `« ${x.raw} » · ${x.label}`}</span>
                  <b className="small">{x.food.name}{!x.sure && !edits[x.key]?.food ? <span className="tag xs">à vérifier</span> : null}</b>
                  <span className="muted xs">P {v.p} · G {v.g} · L {v.l}</span>
                </button>
                <div className="qm-g"><NumInput value={x.grams} onChange={(g) => edit(x.key, { grams: g ?? '' })} aria-label="Grammes" /><span className="xs muted">g</span></div>
                <b className="small qm-k">{n0(v.kcal)}<span className="xs muted"> kcal</span></b>
                <button className="icon-btn" aria-label={x.off ? 'Remettre' : 'Retirer'} onClick={() => edit(x.key, { off: !x.off })}><Icon name={x.off ? 'plus' : 'x'} size={16} /></button>
              </div>
              {open1 === x.key && (
                <div className="qm-alts">
                  <div className="search-row"><Icon name="search" size={14} /><input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Chercher un autre aliment" /></div>
                  <ul className="pick-list">{altList.map((f) => (
                    <li key={f.code || f.name}><button onClick={() => { edit(x.key, { food: f, grams: null }); setOpen1(null); }}>
                      <span className="grow"><b className="small">{f.name}</b><span className="muted xs">{n0(f.per100.k)} kcal · P {f.per100.p} (100 g)</span></span><Icon name="check" size={14} /></button></li>
                  ))}{!altList.length && <li className="muted small">Écris un mot pour chercher.</li>}</ul>
                </div>
              )}
            </li>
          );
        })}</ul>
        <div className="macro-row qm-tot">
          <div className="macro"><span className="muted xs">Calories</span><b>{n0(tot.kcal)}</b></div>
          <div className="macro mc-p"><span className="muted xs">Protéines</span><b>{n0(tot.p)} g</b></div>
          <div className="macro mc-g"><span className="muted xs">Glucides</span><b>{n0(tot.g)} g</b></div>
          <div className="macro mc-l"><span className="muted xs">Lipides</span><b>{n0(tot.l)} g</b></div>
        </div>
        <div className="field"><span className="field-label">Repas</span><Segmented value={mealNow} onChange={setMeal} options={MEALS} /></div>
        <p className="muted xs">Touche un aliment pour en choisir un autre, ou change les grammes. Poids estimés à partir des portions courantes, valeurs de la table Ciqual.</p>
      </>)}
      {parsed.unknown.length > 0 && <p className="small warn-text">Pas compris : {parsed.unknown.map((u) => `« ${u} »`).join(', ')}. Essaie un autre mot ou précise (ex. « 100 g de … »).</p>}
    </Sheet>
  );
}
