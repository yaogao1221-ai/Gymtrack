import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, Page, Card, Field, Loading, ErrorBox, NumInput, Icon, Sheet, Segmented, Confirm, useToast } from '../components/ui.jsx';
import { LineChart, COLORS } from '../components/charts.jsx';
import { put, post, del, today } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';

const f1 = (v) => (v == null ? '—' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }));
const f0 = (v) => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR'));
const ffmiText = (v) => (v < 18 ? 'peu de masse musculaire' : v < 20 ? 'dans la moyenne' : v < 22 ? 'bien entraîné' : v < 25 ? 'très musclé' : 'exceptionnel, rarement dépassé sans dopage');

function suggest(st) {
  const bf = st.body_fat?.value; const f = st.profile.sex === 'femme';
  if (bf == null) return st.profile.level === 'debutant' ? 'recompo' : null;
  if (bf >= (f ? 32 : 22)) return 'seche';
  if (bf <= (f ? 22 : 13)) return 'masse';
  return st.profile.level === 'debutant' ? 'recompo' : bf >= (f ? 27 : 17) ? 'seche' : 'masse';
}

export default function Nutrition() {
  const toast = useToast();
  const { data: st, error, reload, setData } = useApi('/nutrition');
  const [w, setW] = useState({ date: today() }); const [more, setMore] = useState(false);
  const [start, setStart] = useState(null); const [stop, setStop] = useState(false); const [prof, setProf] = useState({});
  if (error && !st) return <Page title="Corps"><ErrorBox error={error} retry={reload} /></Page>;
  if (!st) return <Page title="Corps"><Loading /></Page>;
  const set = (x) => (setData ? setData(x) : reload());
  const addMetric = async () => {
    try { await post('/body-metrics', w); setW({ date: today() }); setMore(false); toast('Mesure enregistrée'); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  const saveProfile = async () => { try { await put('/profile', prof); setProf({}); toast('Profil complété'); reload(); } catch (e) { toast(e.message, 'err'); } };
  const pal = async (v) => { try { set(await put('/nutrition/activity', { activity_pal: Number(v) })); } catch (e) { toast(e.message, 'err'); } };
  const adjust = async (delta) => { try { set(await post(`/nutrition/plan/${st.plan.id}/adjust`, { delta })); toast(`Objectif ajusté de ${delta > 0 ? '+' : ''}${delta} kcal`); } catch (e) { toast(e.message, 'err'); } };
  const pts = st.trend.weeks.filter((x) => x.avg != null);
  const sug = suggest(st);
  const p = st.plan;

  return (
    <Page title="Corps" subtitle="Pesées, composition, calories et cures">
      {st.missing.length > 0 && (
        <Card title="Pour calculer tes besoins" icon="info">
          <p className="small">Il manque : <b>{st.missing.join(', ')}</b>.</p>
          <div className="grid3">
            {!st.profile.sex && <Field label="Sexe"><select value={prof.sex || ''} onChange={(e) => setProf({ ...prof, sex: e.target.value })}><option value="">—</option><option value="homme">Homme</option><option value="femme">Femme</option></select></Field>}
            {!st.profile.height_cm && <Field label="Taille (cm)"><NumInput value={prof.height_cm} onChange={(v) => setProf({ ...prof, height_cm: v })} placeholder="178" /></Field>}
            {!st.profile.birth_year && <Field label="Année de naissance"><NumInput value={prof.birth_year} onChange={(v) => setProf({ ...prof, birth_year: v })} placeholder="1998" /></Field>}
          </div>
          {Object.keys(prof).length > 0 && <button className="btn sm primary" onClick={saveProfile}>Enregistrer</button>}
          {!st.weight_kg && <p className="muted small">Ajoute ton poids juste en dessous.</p>}
        </Card>
      )}

      <Card title="Pesée et mensurations" icon="user" className="weigh-card">
        <div className="row gap-s">
          <NumInput value={w.weight_kg} onChange={(v) => setW({ ...w, weight_kg: v })} placeholder="Poids du jour (kg)" />
          <button className="btn primary sm" disabled={!w.weight_kg && !w.waist_cm && !w.neck_cm && !w.hip_cm && !w.body_fat_pct} onClick={addMetric}>Ajouter</button>
        </div>
        <button className="link small mt-s" onClick={() => setMore(!more)}>{more ? 'Masquer les mensurations' : 'Ajouter des mensurations (taille, cou…)'}</button>
        {more && <div className="grid3 mt-s">
          <Field label="Tour de taille (cm)" hint="Au nombril"><NumInput value={w.waist_cm} onChange={(v) => setW({ ...w, waist_cm: v })} /></Field>
          <Field label="Tour de cou (cm)" hint="Sous la pomme d’Adam"><NumInput value={w.neck_cm} onChange={(v) => setW({ ...w, neck_cm: v })} /></Field>
          {st.profile.sex === 'femme' && <Field label="Hanches (cm)"><NumInput value={w.hip_cm} onChange={(v) => setW({ ...w, hip_cm: v })} /></Field>}
          <Field label="% de gras mesuré" hint="Impédancemètre, DEXA… (facultatif)"><NumInput value={w.body_fat_pct} onChange={(v) => setW({ ...w, body_fat_pct: v })} /></Field>
        </div>}
        <p className="muted small mt-s">Pèse-toi le matin à jeun, 3 à 7 fois par semaine : l’appli raisonne sur la moyenne de la semaine.</p>
      </Card>

      <Card title="Ma composition" icon="target">
        <div className="body-tiles">
          <div><span className="muted small">Poids <i className="src m">pesé</i></span><b>{f1(st.weight_kg)}<small> kg</small></b><span className="small">{st.weight ? `moyenne de ${st.weight.n} pesée${st.weight.n > 1 ? 's' : ''} sur 7 j · dernière ${f1(st.weight.last)} kg` : 'poids du profil'}</span><span className="small">{st.trend.rate_pct != null ? `tendance ${st.trend.rate_pct > 0 ? '+' : ''}${f1(st.trend.rate_pct)} % / sem.` : 'tendance après 2 semaines'}</span></div>
          <div><span className="muted small">IMC <i className="src c">calculé</i></span><b>{f1(st.bmi?.value)}</b><span className="small">{st.bmi?.category || '—'}</span></div>
          <div><span className="muted small">Masse grasse <i className={`src ${st.body_fat?.source === 'mesure' ? 'm' : 'e'}`}>{st.body_fat?.source === 'mesure' ? 'mesuré' : 'estimé'}</i></span><b>{st.body_fat?.source === 'mesure' ? '' : '≈ '}{f1(st.body_fat?.value)}<small> %</small></b><span className="small">{st.body_fat ? (st.body_fat.source === 'mesure' ? `appareil, le ${fmtDate(st.body_fat.date, { day: 'numeric', month: 'short' })}` : 'US Navy (taille + cou), ±3 à 4 points') : 'ajoute taille + cou'}</span></div>
          <div><span className="muted small">FFMI <i className="src e">estimé</i></span><b>{f1(st.ffmi?.normalized)}</b><span className="small">{st.ffmi ? ffmiText(st.ffmi.normalized) : 'besoin du % de gras'}</span></div>
        </div>
        {st.bmi?.value >= 25 && st.ffmi?.normalized >= 21 && <p className="tip"><Icon name="info" size={14} />L’IMC ne fait pas la différence entre muscle et gras : avec ta masse musculaire, regarde plutôt ton % de gras et ton tour de taille.</p>}
        {st.lbm_kg && <p className="muted small">Masse maigre estimée : ≈ {f1(st.lbm_kg)} kg (poids × (1 − % de gras)). La masse maigre inclut eau, os et organes : ce n’est pas une mesure du muscle.</p>}
        <p className="muted small">Une variation de poids sur quelques jours vient surtout de l’eau et du contenu digestif. Seule la tendance sur plusieurs semaines, croisée avec le tour de taille et les charges, renseigne sur le gras ou le muscle.</p>
        {pts.length > 1 && <LineChart height={150} labels={pts.map((x) => fmtDate(x.week, { day: 'numeric', month: 'short' }))} series={[{ label: 'Moyenne de la semaine (kg)', data: pts.map((x) => x.avg), color: COLORS.mint, fill: true }]} />}
      </Card>

      {st.bmr && <Card title="Mes calories de maintien" icon="flame">
        <div className="kcal-sum">
          <div><span className="muted small">Métabolisme de base</span><b>{f0(st.bmr.value)}</b></div><span className="op">×</span>
          <div><span className="muted small">Activité</span><b>{f1(st.profile.activity_pal)}</b></div><span className="op">+</span>
          <div><span className="muted small">Entraînement</span><b>{f0(st.exercise?.per_day)}</b></div><span className="op">=</span>
          <div className="total"><span className="muted small">Maintien</span><b>{f0(st.tdee)}</b><span className="small">kcal / jour</span></div>
        </div>
        <Field label="Ton activité en dehors du sport" className="mt">
          <select value={String(st.profile.activity_pal)} onChange={(e) => pal(e.target.value)}>{Object.entries(st.lifestyle).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <p className="muted small">Formule {st.bmr.formula}. L’entraînement est calculé sur tes 4 dernières semaines réelles{st.exercise?.estimated ? ' (estimé depuis ton profil pour l’instant)' : ''}. Toutes les formules ont ±10 % d’erreur : la cure se recale chaque semaine sur ta balance.</p>
      </Card>}

      {p ? (
        <Card title={`Cure : ${p.label}`} icon="target" className="plan-card" action={<button className="btn xs ghost" onClick={() => setStop(true)}>Arrêter</button>}>
          <div className="plan-head"><span className="small">Semaine <b>{p.week}</b> sur {p.weeks}</span><span className="muted small">fin le {fmtDate(p.end_date, { day: 'numeric', month: 'long' })} · objectif ≈ {f1(p.end_weight)} kg</span></div>
          <div className="bar"><span style={{ width: `${(p.week / p.weeks) * 100}%` }} /></div>
          {p.in_break && <p className="tip"><Icon name="moon" size={14} />Semaine de pause conseillée : mange au maintien (≈ {f0(st.tdee)} kcal) puis reprends.</p>}
          <div className="kcal-target"><b>{f0(p.in_break ? st.tdee : p.kcal)}</b><span>kcal par jour{p.kcal_adjust ? ` (ajusté ${p.kcal_adjust > 0 ? '+' : ''}${p.kcal_adjust})` : ''}</span></div>
          <Macros p={p} />
          <p className="small muted">Fibres ≈ {p.fiber_g} g · eau ≈ {f1(p.water_l)} L · vitesse visée {f1(p.rate_pct)} % du poids / semaine</p>
          <div className={`wk-check ${p.check.status}`}>
            <b className="small">Contrôle de la semaine</b><p className="small">{p.check.text}</p>
            {p.check.delta !== 0 && <button className="btn xs primary" onClick={() => adjust(p.check.delta)}>Appliquer {p.check.delta > 0 ? '+' : ''}{p.check.delta} kcal</button>}
          </div>
          <details className="rules"><summary className="small">Les règles de cette cure (études)</summary><ul>{st.types[p.type].rules.map((r) => <li key={r} className="small">{r}</li>)}</ul></details>
        </Card>
      ) : (
        <Card title="Lancer une cure" icon="target">
          {!st.tdee && <p className="muted small">Complète ton profil et ajoute une pesée pour voir les chiffres.</p>}
          <div className="plan-options">
            {Object.entries(st.types).map(([k, t]) => (
              <button key={k} className={`plan-opt ${sug === k ? 'sug' : ''}`} disabled={!t.preview} onClick={() => setStart({ type: k, weeks: t.weeks[2], rate_pct: t.preview?.rate_pct, start_date: today() })}>
                <span className="row gap-s"><b>{t.label}</b>{sug === k && <span className="tag">conseillé pour toi</span>}</span>
                <span className="muted small">Pour {t.verb}</span>
                {t.preview && <span className="small mono">{f0(t.preview.kcal)} kcal · P {t.preview.protein_g} g · L {t.preview.fat_g} g · G {t.preview.carbs_g} g</span>}
              </button>
            ))}
          </div>
        </Card>
      )}

      <MetricsHistory />

      <Card title="Bonnes pratiques" icon="sparkles">
        <ul className="tips-list">{st.tips.map((t) => <li key={t} className="small">{t}</li>)}</ul>
        <Link to="/outils" className="btn sm mt"><Icon name="target" size={14} />Calculateurs : 1RM, zones cardio, disques</Link>
      </Card>

      <StartSheet start={start} setStart={setStart} st={st} onStarted={(x) => { setStart(null); set(x); toast('Cure lancée'); }} />
      <Confirm open={stop} onClose={() => setStop(false)} title="Arrêter la cure ?" confirmLabel="Arrêter" text="Tes pesées restent enregistrées. Tu pourras en lancer une autre."
        onConfirm={async () => { try { set(await post(`/nutrition/plan/${p.id}/stop`, { status: p.week >= p.weeks ? 'done' : 'stopped' })); } catch (e) { toast(e.message, 'err'); } }} />
    </Page>
  );
}

function Macros({ p }) {
  const rows = [['Protéines', p.protein_g, 4, 'p'], ['Lipides', p.fat_g, 9, 'l'], ['Glucides', p.carbs_g, 4, 'g']];
  const tot = rows.reduce((a, [, g, k]) => a + g * k, 0) || 1;
  return (
    <div className="macros">
      <div className="macro-bar">{rows.map(([l, g, k, c]) => <span key={l} className={`m-${c}`} style={{ width: `${(g * k / tot) * 100}%` }} />)}</div>
      <div className="macro-legend">{rows.map(([l, g, k, c]) => <div key={l}><i className={`m-${c}`} /><span className="small">{l}</span><b className="mono">{g} g</b><span className="muted small">{Math.round((g * k / tot) * 100)} %</span></div>)}</div>
    </div>
  );
}

function StartSheet({ start, setStart, st, onStarted }) {
  const toast = useToast(); const [busy, setBusy] = useState(false);
  if (!start) return <Sheet open={false} onClose={() => setStart(null)} />;
  const t = st.types[start.type]; const [min, max] = t.weeks;
  const rates = [t.rate.min, t.rate.def, t.rate.max].filter((v, i, a) => a.indexOf(v) === i);
  const go = async () => { setBusy(true); try { onStarted(await post('/nutrition/plan', start)); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  return (
    <Sheet open onClose={() => setStart(null)} title={`Lancer : ${t.label}`} footer={<button className="btn primary block" disabled={busy} onClick={go}>{busy ? '…' : 'Lancer la cure'}</button>}>
      <Field label={`Durée : ${start.weeks} semaines`} hint={`Conseillé : ${min} à ${max} semaines`}>
        <input type="range" min={4} max={Math.max(max, 24)} value={start.weeks} onChange={(e) => setStart({ ...start, weeks: Number(e.target.value) })} />
      </Field>
      {start.type !== 'recompo' && <Field label="Vitesse (% du poids par semaine)">
        <Segmented value={start.rate_pct} onChange={(v) => setStart({ ...start, rate_pct: v })} options={rates.map((r) => [r, `${r.toLocaleString('fr-FR')} %${r === t.rate.def ? ' (conseillé)' : ''}`])} />
      </Field>}
      <Field label="Début"><input type="date" value={start.start_date} onChange={(e) => setStart({ ...start, start_date: e.target.value })} /></Field>
      <ul className="tips-list">{t.rules.map((r) => <li key={r} className="small">{r}</li>)}</ul>
    </Sheet>
  );
}

// Toutes les mesures saisies (pesées, mensurations, % mesuré) : modifier ou supprimer ici recalcule tout l'appli
function MetricsHistory() {
  const toast = useToast(); const { data } = useApi('/body-metrics'); const [all, setAll] = useState(false);
  if (!data?.length) return null;
  const rows = all ? data : data.slice(0, 8);
  const v = (x, u) => (x == null ? '—' : `${f1(x)}${u}`);
  const remove = async (id) => { try { await del(`/body-metrics/${id}`); toast('Mesure supprimée'); } catch (e) { toast(e.message, 'err'); } };
  return (
    <Card title="Historique des mesures" icon="calendar">
      <div className="table-wrap"><table className="sets-table">
        <thead><tr><th>Date</th><th>Poids</th><th>Taille</th><th>Cou</th><th>% gras</th><th /></tr></thead>
        <tbody>{rows.map((x) => <tr key={x.id}><td>{fmtDate(x.date, { day: 'numeric', month: 'short' })}</td><td>{v(x.weight_kg, ' kg')}</td><td>{v(x.waist_cm, '')}</td><td>{v(x.neck_cm, '')}</td><td>{v(x.body_fat_pct, ' %')}</td>
          <td><button className="icon-btn sm danger" aria-label="Supprimer la mesure" onClick={() => remove(x.id)}><Icon name="trash" size={14} /></button></td></tr>)}</tbody>
      </table></div>
      {data.length > 8 && <button className="link small mt-s" onClick={() => setAll(!all)}>{all ? 'Réduire' : `Tout afficher (${data.length})`}</button>}
      <p className="muted small mt-s">Mensurations en cm. Le % de gras de ce tableau est celui que tu as mesuré (appareil) ; l’estimation US Navy est calculée à part.</p>
    </Card>
  );
}
