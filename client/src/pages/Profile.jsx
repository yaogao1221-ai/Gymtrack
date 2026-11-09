import { useEffect, useState } from 'react';
import { useApi, Page, Card, Field, Loading, NumInput, Icon, useToast } from '../components/ui.jsx';
import { LineChart, COLORS } from '../components/charts.jsx';
import { get, put, post, del, today } from '../lib/api.js';
import { GoalsSection, AvailabilitySection, PreferencesSection, TrackingSection, CardioSection, pickProfile } from '../components/profileForm.jsx';
import { fmtDate } from '../lib/format.js';

export default function Profile({ onSaved }) {
  const [p, setP] = useState(null); const [days, setDays] = useState([]); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false);
  const metrics = useApi('/body-metrics'); const [m, setM] = useState({ date: today() });
  const toast = useToast();
  useEffect(() => { Promise.all([get('/profile'), get('/program')]).then(([pr, prog]) => { setP(pr); setDays(prog.days); }); }, []);
  if (!p) return <Loading />;
  const set = (x) => { setP({ ...p, ...x }); setDirty(true); };
  const save = async () => { setBusy(true); try { const r = await put('/profile', pickProfile(p)); setP(r); onSaved?.(r); setDirty(false); toast('Profil enregistré'); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const addMetric = async () => { try { await post('/body-metrics', m); setM({ date: today() }); metrics.reload(); toast('Mesure ajoutée'); } catch (e) { toast(e.message, 'err'); } };
  const pts = [...(metrics.data || [])].filter((x) => x.weight_kg).reverse();
  return (
    <Page title="Profil" subtitle="Tes informations personnalisent l’analyse, le cardio et le calendrier"
      actions={<button className="btn primary sm" disabled={!dirty || busy} onClick={save}><Icon name="check" size={16} />{busy ? '…' : 'Enregistrer'}</button>}>
      <Card title="Identité"><Field label="Prénom"><input value={p.name || ''} onChange={(e) => set({ name: e.target.value })} /></Field></Card>
      <Card title="Objectifs & niveau" icon="target"><GoalsSection p={p} set={set} /></Card>
      <Card title="Disponibilités" icon="calendar"><AvailabilitySection p={p} set={set} days={days} /></Card>
      <Card title="Préférences & historique sportif" icon="dumbbell"><PreferencesSection p={p} set={set} /></Card>
      <Card title="Informations de suivi (facultatives)" icon="user"><TrackingSection p={p} set={set} /></Card>
      <Card title="Objectifs cardio" icon="heart"><CardioSection p={p} set={set} /></Card>
      {dirty && <button className="btn primary block sticky-save" disabled={busy} onClick={save}>Enregistrer les modifications</button>}

      <Card title="Suivi corporel" icon="chart">
        {pts.length > 1 && <LineChart height={160} labels={pts.map((x) => fmtDate(x.date, { day: 'numeric', month: 'short' }))} series={[{ label: 'Poids (kg)', data: pts.map((x) => x.weight_kg), color: COLORS.blue, fill: true }]} />}
        <div className="grid2 mt-s">
          <Field label="Date"><input type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></Field>
          <Field label="Poids (kg)"><NumInput value={m.weight_kg} onChange={(v) => setM({ ...m, weight_kg: v })} /></Field>
          <Field label="Masse grasse (%)"><NumInput value={m.body_fat_pct} onChange={(v) => setM({ ...m, body_fat_pct: v })} /></Field>
          <Field label="Tour de taille (cm)"><NumInput value={m.waist_cm} onChange={(v) => setM({ ...m, waist_cm: v })} /></Field>
        </div>
        <button className="btn sm" onClick={addMetric}><Icon name="plus" size={14} />Ajouter la mesure</button>
        {metrics.data?.length > 0 && <table className="sets-table mt-s"><thead><tr><th>Date</th><th>Poids</th><th>MG</th><th>Taille</th><th /></tr></thead>
          <tbody>{metrics.data.slice(0, 12).map((x) => <tr key={x.id}><td>{fmtDate(x.date)}</td><td>{x.weight_kg ?? '—'}</td><td>{x.body_fat_pct ?? '—'}</td><td>{x.waist_cm ?? '—'}</td>
            <td><button className="icon-btn sm danger" aria-label="Supprimer" onClick={async () => { await del(`/body-metrics/${x.id}`); metrics.reload(); }}><Icon name="trash" size={14} /></button></td></tr>)}</tbody></table>}
      </Card>
    </Page>
  );
}
