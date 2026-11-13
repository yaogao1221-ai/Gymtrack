import { useEffect, useMemo, useState } from 'react';
import { useApi, Page, Card, Icon, Sheet, Field, NumInput, Loading, Segmented, useToast } from '../components/ui.jsx';
import { SectionTabs } from '../components/SectionTabs.jsx';
import { BarChart, COLORS } from '../components/charts.jsx';
import { post, patch, del, today } from '../lib/api.js';
import { addDays, fmtDate, n0 } from '../lib/format.js';
import { norm } from '../lib/exlib.js';

const MEALS = [['petit_dej', 'Petit-déjeuner'], ['dejeuner', 'Déjeuner'], ['collation', 'Collation'], ['diner', 'Dîner']];
let foodsCache = null;
const loadFoods = () => (foodsCache ||= import('../data/foods.json').then((m) => m.default));
const r1 = (x) => Math.round(x * 10) / 10;
const calc = (p, g) => ({ kcal: Math.round(p.k * g / 100), p: r1(p.p * g / 100), g: r1(p.g * g / 100), l: r1(p.l * g / 100) });
const defaultMeal = () => { const h = new Date().getHours(); return h < 10 ? 'petit_dej' : h < 15 ? 'dejeuner' : h < 18 ? 'collation' : 'diner'; };

// Journal alimentaire : on note ce qu'on mange en grammes, l'appli calcule calories et macros (table Ciqual de l'ANSES)
export default function Meals() {
  const [day, setDay] = useState(today());
  const { data, reload } = useApi(`/food?date=${day}`);
  const [add, setAdd] = useState(null); const [edit, setEdit] = useState(null); const toast = useToast();
  const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); await reload(); } catch (e) { toast(e.message, 'err'); } };
  if (!data) return <Loading />;
  const t = data.totals; const tg = data.target;
  const isToday = day === today();
  return (
    <Page tabs={<SectionTabs group="body" />} title="Repas">
      <div className="day-nav">
        <button className="icon-btn" aria-label="Jour précédent" onClick={() => setDay(addDays(day, -1))}><Icon name="left" size={18} /></button>
        <b>{isToday ? 'Aujourd’hui' : fmtDate(day, { weekday: 'long', day: 'numeric', month: 'short' })}</b>
        <button className="icon-btn" aria-label="Jour suivant" disabled={isToday} onClick={() => setDay(addDays(day, 1))}><Icon name="right" size={18} /></button>
      </div>

      <Card>
        <div className="kcal-head">
          <div><b className="kcal-big">{n0(t.kcal)}</b><span className="muted"> {tg?.kcal ? `/ ${n0(tg.kcal)} kcal` : 'kcal'}</span></div>
          {tg?.kcal && <span className={`tag ${t.kcal > tg.kcal * 1.05 ? 'warn' : ''}`}>{t.kcal <= tg.kcal ? `reste ${n0(tg.kcal - t.kcal)}` : `+${n0(t.kcal - tg.kcal)}`}</span>}
        </div>
        {tg?.kcal && <div className="bar"><span style={{ width: `${Math.min(100, t.kcal / tg.kcal * 100)}%` }} className={t.kcal > tg.kcal * 1.05 ? 'over' : ''} /></div>}
        <div className="macro-row">
          {[['Protéines', t.protein_g, tg?.protein_g, 'p'], ['Glucides', t.carbs_g, tg?.carbs_g, 'g'], ['Lipides', t.fat_g, tg?.fat_g, 'l']].map(([l, v, goal, k]) => (
            <div key={k} className={`macro mc-${k}`}><span className="muted xs">{l}</span><b>{n0(v)} g{goal ? <small className="muted"> / {n0(goal)}</small> : null}</b>
              {goal ? <div className="bar thin"><span style={{ width: `${Math.min(100, v / goal * 100)}%` }} /></div> : null}</div>
          ))}
        </div>
        {tg ? <p className="muted xs">Objectif : {tg.source}.</p> : <p className="muted xs">Renseigne ton poids, ta taille, ton âge et ton sexe (Corps) pour avoir un objectif de calories.</p>}
      </Card>

      {MEALS.map(([k, label]) => {
        const items = data.logs.filter((x) => x.meal === k); const kc = items.reduce((a, x) => a + x.kcal, 0);
        return (
          <Card key={k} title={label} action={<button className="btn xs" onClick={() => setAdd({ meal: k })}><Icon name="plus" size={14} />Ajouter</button>}>
            {items.length ? <ul className="food-list">{items.map((x) => (
              <li key={x.id}><button onClick={() => setEdit({ ...x })}>
                <span className="grow"><b className="small">{x.name}</b><span className="muted xs">{n0(x.grams)} g · P {r1(x.protein_g)} · G {r1(x.carbs_g)} · L {r1(x.fat_g)}</span></span>
                <b className="small">{n0(x.kcal)} kcal</b>
              </button></li>
            ))}<li className="food-sum muted small">Total {n0(kc)} kcal</li></ul> : <p className="muted small">Rien de noté.</p>}
          </Card>
        );
      })}

      <Card title="7 derniers jours" icon="chart">
        <BarChart labels={data.week.map((w) => fmtDate(w.date, { weekday: 'short' }))} series={[{ label: 'kcal', data: data.week.map((w) => w.kcal), color: COLORS.orange }]} height={160} />
        {tg?.kcal && <p className="muted xs">Objectif {n0(tg.kcal)} kcal par jour. Juge sur la moyenne de la semaine plutôt que sur un seul jour.</p>}
      </Card>
      <p className="muted xs center">Valeurs nutritionnelles : table Ciqual 2025 (ANSES), pour 100 g d’aliment tel que décrit (cru, cuit…).</p>

      <AddFood open={!!add} meal={add?.meal} recent={data.recent} onClose={() => setAdd(null)}
        onAdd={(body) => run(async () => { await post('/food', { ...body, date: day }); setAdd(null); }, 'Ajouté')} />
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name}
        footer={<><button className="btn ghost danger-text" onClick={() => run(async () => { await del(`/food/${edit.id}`); setEdit(null); }, 'Retiré')}><Icon name="trash" size={16} />Retirer</button>
          <button className="btn primary" disabled={!edit?.grams} onClick={() => run(async () => { await patch(`/food/${edit.id}`, { grams: edit.grams, meal: edit.meal }); setEdit(null); }, 'Modifié')}>Enregistrer</button></>}>
        {edit && <>
          <Field label="Quantité (g)"><NumInput value={edit.grams} onChange={(v) => setEdit({ ...edit, grams: v })} /></Field>
          <Field label="Repas"><Segmented value={edit.meal} onChange={(v) => setEdit({ ...edit, meal: v })} options={MEALS.map(([k, l]) => [k, l.split('-')[0]])} /></Field>
          {edit.per100 && <p className="muted small">{calc(edit.per100, edit.grams || 0).kcal} kcal pour {edit.grams || 0} g</p>}
        </>}
      </Sheet>
    </Page>
  );
}

function AddFood({ open, meal: meal0, recent, onClose, onAdd }) {
  const [foods, setFoods] = useState(null); const [q, setQ] = useState(''); const [sel, setSel] = useState(null);
  const [grams, setGrams] = useState(100); const [meal, setMeal] = useState(meal0 || defaultMeal()); const [custom, setCustom] = useState(null);
  useEffect(() => { if (open) { loadFoods().then(setFoods).catch(() => setFoods([])); setQ(''); setSel(null); setCustom(null); setMeal(meal0 || defaultMeal()); } }, [open, meal0]);
  const list = useMemo(() => {
    const words = norm(q).split(/[\s,]+/).filter(Boolean); if (!foods || !words.length) return [];
    return foods.map((f) => ({ f, n: norm(f.n) })).filter((x) => words.every((w) => x.n.includes(w)))
      .sort((a, b) => (b.n.startsWith(words[0]) - a.n.startsWith(words[0])) || a.n.length - b.n.length).slice(0, 40).map((x) => x.f);
  }, [foods, q]);
  const choose = (f, g) => { setSel(f); setGrams(g || f.por || 100); };
  const v = sel ? calc(sel.per100, Number(grams) || 0) : null;
  const ok = sel && Number(grams) > 0;
  return (
    <Sheet open={open} onClose={onClose} title={sel ? sel.name : custom ? 'Aliment perso' : 'Ajouter un aliment'}
      footer={sel ? <><button className="btn ghost" onClick={() => setSel(null)}>Retour</button><button className="btn primary" disabled={!ok} onClick={() => onAdd({ name: sel.name, food_code: sel.code, per100: sel.per100, grams: Number(grams), meal })}>Ajouter · {v.kcal} kcal</button></>
        : custom ? <button className="btn primary" disabled={!custom.name || !custom.k} onClick={() => choose({ name: custom.name, code: null, per100: { k: Number(custom.k) || 0, p: Number(custom.p) || 0, g: Number(custom.g) || 0, l: Number(custom.l) || 0 } }, 100)}>Continuer</button> : null}>
      {sel ? (<>
        <Field label="Quantité (g)"><NumInput value={grams} onChange={setGrams} autoFocus /></Field>
        <div className="chips">{[...new Set([sel.por, 50, 100, 150, 200, 250].filter(Boolean))].map((g) => <button key={g} className={`chip ${Number(grams) === g ? 'on' : ''}`} onClick={() => setGrams(g)}>{g} g</button>)}</div>
        <Field label="Repas"><Segmented value={meal} onChange={setMeal} options={MEALS.map(([k, l]) => [k, l.split('-')[0]])} /></Field>
        <div className="macro-row">
          <div className="macro"><span className="muted xs">Calories</span><b>{v.kcal}</b></div>
          <div className="macro mc-p"><span className="muted xs">Protéines</span><b>{v.p} g</b></div>
          <div className="macro mc-g"><span className="muted xs">Glucides</span><b>{v.g} g</b></div>
          <div className="macro mc-l"><span className="muted xs">Lipides</span><b>{v.l} g</b></div>
        </div>
        <p className="muted xs">Pour 100 g : {sel.per100.k} kcal · P {sel.per100.p} · G {sel.per100.g} · L {sel.per100.l}</p>
      </>) : custom ? (<>
        <Field label="Nom"><input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Barre protéinée X" autoFocus /></Field>
        <p className="muted small">Valeurs pour 100 g (sur l’étiquette).</p>
        <div className="grid2">
          <Field label="Calories"><NumInput value={custom.k} onChange={(x) => setCustom({ ...custom, k: x })} /></Field>
          <Field label="Protéines (g)"><NumInput value={custom.p} onChange={(x) => setCustom({ ...custom, p: x })} /></Field>
          <Field label="Glucides (g)"><NumInput value={custom.g} onChange={(x) => setCustom({ ...custom, g: x })} /></Field>
          <Field label="Lipides (g)"><NumInput value={custom.l} onChange={(x) => setCustom({ ...custom, l: x })} /></Field>
        </div>
      </>) : (<>
        <div className="search-row"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="riz, poulet, banane, yaourt…" autoFocus /></div>
        {!q && recent?.length > 0 && (<>
          <h3 className="h-sub">Récents</h3>
          <ul className="pick-list">{recent.map((r) => <li key={r.name}><button onClick={() => choose({ name: r.name, code: r.food_code, per100: r.per100 }, r.grams)}>
            <span className="grow"><b className="small">{r.name}</b><span className="muted xs">{r.per100.k} kcal / 100 g · dernière fois {n0(r.grams)} g</span></span><Icon name="plus" size={16} /></button></li>)}</ul>
        </>)}
        {q && !foods && <Loading />}
        {q && foods && <ul className="pick-list">{list.map((f) => (
          <li key={f.c}><button onClick={() => choose({ name: f.n, code: f.c, per100: { k: f.k, p: f.p ?? 0, g: f.g ?? 0, l: f.l ?? 0 }, por: f.por }, f.por)}>
            <span className="grow"><b className="small">{f.n}</b><span className="muted xs">{n0(f.k)} kcal · P {f.p ?? '—'} · G {f.g ?? '—'} · L {f.l ?? '—'} (100 g)</span></span><Icon name="plus" size={16} /></button></li>
        ))}{!list.length && <li className="muted small">Aucun aliment trouvé. Essaie un autre mot ou crée-le.</li>}</ul>}
        <button className="btn block dashed mt-s" onClick={() => setCustom({ name: q, k: null, p: null, g: null, l: null })}><Icon name="plus" size={16} />Aliment perso (valeurs de l’étiquette)</button>
      </>)}
    </Sheet>
  );
}
