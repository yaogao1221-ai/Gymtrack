import { useState } from 'react';
import { useApi, Card, Icon, useToast } from './ui.jsx';
import { post } from '../lib/api.js';
import { thumb } from '../lib/exlib.js';

// Muscles ni travaillés ni prévus : on propose un exercice et le jour où il s'intègre le mieux, ajout en un geste
const SKIP_KEY = 'gt_gap_skip';
const readSkip = () => { try { return JSON.parse(localStorage.getItem(SKIP_KEY) || '{}'); } catch { return {}; } };
export default function MissingMuscles({ days: daysProp, onAdded }) {
  const prog = useApi(daysProp ? null : '/program'); const days = daysProp || prog.data?.days || [];
  const { data, reload } = useApi('/program/gaps');
  const [skip, setSkip] = useState(readSkip); const [pick, setPick] = useState({}); const [all, setAll] = useState(false); const [busy, setBusy] = useState(null);
  const toast = useToast();
  // Une suggestion ignorée revient au bout de 30 jours
  const now = Date.now(); const keep = (g) => !(skip[g.muscle] > now - 30 * 864e5);
  if (!data) return null;
  const gaps = (data.gaps || []).filter(keep); const low = (data.low || []).filter(keep);
  const shown = all ? gaps : gaps.slice(0, 2);
  const ignore = (m) => { const n = { ...skip, [m]: now }; setSkip(n); try { localStorage.setItem(SKIP_KEY, JSON.stringify(n)); } catch {} };
  const add = async (g) => {
    const p = pick[g.muscle] || {}; const ex = p.ex || g.exercise; const dayId = p.day || g.day?.id; if (!dayId) return;
    setBusy(g.muscle);
    try { await post(`/program/days/${dayId}/exercises`, { exercise_id: ex.id, sets: g.sets, reps: g.reps, rest_seconds: g.rest_seconds }); toast(`${ex.name} ajouté`); await reload(); onAdded?.(dayId); prog.reload?.(); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  };
  const row = (g) => {
          const p = pick[g.muscle] || {}; const ex = p.ex || g.exercise; const dayId = p.day || g.day?.id; const dayName = days.find((d) => d.id === dayId)?.name || g.day?.name;
          const set = (k, v) => setPick({ ...pick, [g.muscle]: { ...p, [k]: v } });
          return (
            <li key={g.muscle}>
              <div className="gap-top">
                {thumb(ex.lib_id) ? <img className="gap-img" src={thumb(ex.lib_id)} alt="" loading="lazy" /> : <span className="gap-img ph"><Icon name="dumbbell" size={18} /></span>}
                <div className="gap-main">
                  <div className="gap-m">{g.label}{g.prio === 2 && <span className="tag">secondaire</span>}</div>
                  <div className="gap-why">{g.forgotten ? (g.indirect?.length ? `Aucun exercice dédié, seulement un peu via ${g.indirect.join(', ')}` : 'Rien fait depuis 4 semaines, rien de prévu') : `${String(g.planned).replace('.', ',')} ${g.planned >= 2 ? 'séries prévues' : 'série prévue'} par semaine (conseillé : 6 à 10)`}</div>
                  <div className="gap-ex"><b>{ex.name}</b> · {g.sets}×{g.reps}{g.reps === 30 ? ' s' : ''}</div>
                </div>
              </div>
              {g.alternatives.length > 0 && <div className="chips gap-chips">
                {[g.exercise, ...g.alternatives].map((a) => <button key={a.id} className={`chip ${a.id === ex.id ? 'on' : ''}`} onClick={() => set('ex', a)}>{a.name}</button>)}
              </div>}
              <div className="chips gap-chips">
                {days.map((d) => <button key={d.id} className={`chip ${d.id === dayId ? 'on' : ''}`} onClick={() => set('day', d.id)}>{d.name}{d.id === g.day?.id ? ' ★' : ''}</button>)}
              </div>
              <div className="row gap-s mt">
                <button className="btn primary sm" disabled={busy === g.muscle} onClick={() => add(g)}><Icon name="plus" size={14} />Ajouter dans {dayName}</button>
                <button className="btn ghost sm" onClick={() => ignore(g.muscle)}>Pas pour moi</button>
              </div>
            </li>
          );
  };
  return (
    <Card className="gap-card" icon="target" title="Muscles oubliés">
      {data.empty ? <p className="muted small">Ajoute des exercices à ton programme : je te dirai quels muscles manquent.</p>
        : gaps.length ? <p className="muted small">Aucun exercice dédié prévu ni fait depuis 4 semaines (cardio compris). Une petite dose suffit pour éviter un déséquilibre.</p>
        : <p className="gap-ok"><Icon name="check" size={16} />Aucun muscle oublié : chaque muscle a au moins un exercice dédié.</p>}
      {gaps.length > 0 && <ul className="gap-list">{shown.map(row)}</ul>}
      {gaps.length > 2 && <button className="btn ghost sm" onClick={() => setAll(!all)}>{all ? 'Moins' : `Voir les ${gaps.length - 2} autres`}</button>}
      {low.length > 0 && <><h3 className="gap-h">Peu travaillés</h3><ul className="gap-list">{low.map(row)}</ul></>}
      {(gaps.length > 0 || low.length > 0) && <p className="muted small">★ = jour conseillé (il travaille déjà la même zone). Charge à choisir à la première série.</p>}
    </Card>
  );
}
