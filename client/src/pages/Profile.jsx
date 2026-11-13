import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, Card, Field, Loading, Icon, useToast } from '../components/ui.jsx';
import { get, put } from '../lib/api.js';
import { AvailabilitySection, PreferencesSection, TrackingSection, pickProfile } from '../components/profileForm.jsx';

export default function Profile({ onSaved }) {
  const [p, setP] = useState(null); const [days, setDays] = useState([]); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { Promise.all([get('/profile'), get('/program')]).then(([pr, prog]) => { setP(pr); setDays(prog.days); }); }, []);
  if (!p) return <Loading />;
  const set = (x) => { setP({ ...p, ...x }); setDirty(true); };
  const save = async () => { setBusy(true); try { const r = await put('/profile', pickProfile(p)); setP(r); onSaved?.(r); setDirty(false); toast('Profil enregistré'); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  return (
    <Page title="Profil"
      actions={<button className="btn primary sm" disabled={!dirty || busy} onClick={save}><Icon name="check" size={16} />{busy ? '…' : 'Enregistrer'}</button>}>
      <Card title="Identité"><Field label="Prénom"><input value={p.name || ''} onChange={(e) => set({ name: e.target.value })} /></Field></Card>
      <Link to="/programme/creer" className="card plan-link"><Icon name="target" /><span className="grow"><b>Objectif, niveau et cardio</b><span className="muted small">Réglés dans le créateur de programme</span></span><Icon name="right" size={18} /></Link>
      <Card title="Disponibilités" icon="calendar"><AvailabilitySection p={p} set={set} days={days} /></Card>
      <Card title="Préférences & historique sportif" icon="dumbbell"><PreferencesSection p={p} set={set} /></Card>
      <Card title="Informations de suivi (facultatives)" icon="user"><TrackingSection p={p} set={set} /></Card>
      {dirty && <button className="btn primary block sticky-save" disabled={busy} onClick={save}>Enregistrer les modifications</button>}

      <Link to="/nutrition?v=poids" className="recap-link card"><Icon name="user" size={20} /><span className="grow"><b>Pesées, mensurations et composition</b><span className="muted small">Regroupées dans Corps : une seule source pour les courbes, l’objectif de poids et les calories</span></span><Icon name="right" size={18} /></Link>
    </Page>
  );
}
