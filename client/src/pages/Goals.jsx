import { useState } from 'react';
import { useApi, Page, Card, Icon, Sheet, Field, NumInput, Loading, Empty, Confirm, useToast } from '../components/ui.jsx';
import { post, patch, del } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';

const TYPES = { charge: 'Charge sur un exercice', seances_semaine: 'Séances par semaine', cardio_minutes_semaine: 'Minutes de cardio / semaine', cardio_km_semaine: 'Kilomètres de cardio / semaine', poids_corporel: 'Poids corporel (kg)', tour_de_taille: 'Tour de taille (cm)', libre: 'Objectif libre' };
const UNITS = { seances_semaine: 'séances', cardio_minutes_semaine: 'min', cardio_km_semaine: 'km', poids_corporel: 'kg', tour_de_taille: 'cm' };

export default function Goals() {
  const { data, reload } = useApi('/goals'); const ex = useApi('/exercises');
  const [form, setForm] = useState(null); const [confirm, setConfirm] = useState(null); const toast = useToast();
  const run = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(e.message, 'err'); } };
  const save = () => run(async () => {
    const body = { ...form, unit: form.unit || UNITS[form.type] || (form.type === 'charge' ? ex.data.exercises.find((e) => e.id === Number(form.exercise_id))?.default_unit : null) };
    body.title = (form.title || '').trim() || suggestTitle(form); delete body.id;
    if (form.id) await patch(`/goals/${form.id}`, { title: body.title, target_value: body.target_value, start_value: body.start_value, deadline: body.deadline, current_value: body.current_value, unit: body.unit });
    else await post('/goals', body);
    setForm(null);
  }, 'Objectif enregistré');
  const suggestTitle = (f) => f.type === 'charge' ? `${ex.data?.exercises.find((e) => e.id === Number(f.exercise_id))?.name || 'Exercice'} à ${f.target_value ?? '?'}` : f.type === 'seances_semaine' ? `${f.target_value ?? '?'} séances par semaine` : f.type === 'cardio_minutes_semaine' ? `${f.target_value ?? '?'} min de cardio / semaine` : f.type === 'cardio_km_semaine' ? `${f.target_value ?? '?'} km de cardio / semaine` : f.type === 'poids_corporel' ? `Atteindre ${f.target_value ?? '?'} kg` : f.type === 'tour_de_taille' ? `Tour de taille à ${f.target_value ?? '?'} cm` : '';
  if (!data) return <Loading />;
  const active = data.filter((g) => g.status === 'actif'); const others = data.filter((g) => g.status !== 'actif');
  return (
    <Page title="Objectifs" subtitle="Calculés automatiquement à partir de tes séances, de ton cardio et de tes pesées" back="/plus" actions={<button className="btn primary sm" onClick={() => setForm({ type: 'charge', title: '', target_value: null })}><Icon name="plus" size={16} />Nouveau</button>}>
      {active.length ? active.map((g) => (
        <Card key={g.id} className="goal-card">
          <div className="row-between"><div><b>{g.title}</b><p className="muted small">{TYPES[g.type]}{g.deadline ? ` · échéance ${fmtDate(g.deadline)}` : ''}</p></div>
            <div className="row gap-s"><button className="icon-btn sm" aria-label="Modifier" onClick={() => setForm({ ...g })}><Icon name="edit" size={16} /></button><button className="icon-btn sm danger" aria-label="Supprimer" onClick={() => setConfirm(g)}><Icon name="trash" size={16} /></button></div></div>
          <div className={`bar lg ${g.reached ? 'done' : ''}`}><span style={{ width: `${Math.round((g.progress || 0) * 100)}%` }} /></div>
          <div className="row-between small"><span>Actuel : <b>{g.current_value ?? '—'}</b> {g.unit || ''}</span><span>Cible : <b>{g.target_value}</b> {g.unit || ''}{g.progress != null ? ` · ${Math.round(g.progress * 100)} %` : ''}</span></div>
          <p className="muted small">{g.start_used != null ? `Départ ${g.start_used} ${g.unit || ''} · ` : ''}{g.basis || 'Valeur saisie à la main'}{g.lower_is_better ? ' · objectif à la baisse' : ''}</p>
          {g.reached && <p className="tip ok"><Icon name="trophy" size={14} />Cible atteinte d’après tes données. Valide-le pour l’archiver dans tes réussites.</p>}
          <div className="row gap-s mt-s"><button className="btn xs" onClick={() => run(() => patch(`/goals/${g.id}`, { status: 'atteint' }), 'Objectif atteint')}><Icon name="trophy" size={14} />Atteint</button>
            <button className="btn xs ghost" onClick={() => run(() => patch(`/goals/${g.id}`, { status: 'abandonne' }), 'Objectif archivé')}>Archiver</button></div>
        </Card>
      )) : <Empty icon="target" title="Aucun objectif actif">Crée un objectif de charge, de régularité, de cardio ou de poids.</Empty>}
      {others.length > 0 && <Card title="Terminés / archivés">{others.map((g) => <div key={g.id} className="row-between small hist-goal"><span>{g.status === 'atteint' ? 'Atteint · ' : 'Archivé · '}{g.title}</span><button className="btn xs ghost" onClick={() => run(() => patch(`/goals/${g.id}`, { status: 'actif' }), 'Objectif réactivé')}>Réactiver</button></div>)}</Card>}

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Modifier l’objectif' : 'Nouvel objectif'} footer={<button className="btn primary" disabled={!form?.target_value && form?.type !== 'libre'} onClick={save}>Enregistrer</button>}>
        {form && (<>
          {!form.id && <Field label="Type"><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
          {form.type === 'charge' && !form.id && <Field label="Exercice"><select value={form.exercise_id || ''} onChange={(e) => setForm({ ...form, exercise_id: Number(e.target.value) })}><option value="">Choisir…</option>{ex.data?.exercises.filter((e) => e.kind !== 'bodyweight').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>}
          <div className="grid2">
            <Field label="Valeur cible"><NumInput value={form.target_value} onChange={(v) => setForm({ ...form, target_value: v })} /></Field>
            <Field label="Valeur de départ" hint="Facultatif"><NumInput value={form.start_value} onChange={(v) => setForm({ ...form, start_value: v })} /></Field>
            {form.type === 'libre' && <Field label="Valeur actuelle"><NumInput value={form.current_value} onChange={(v) => setForm({ ...form, current_value: v })} /></Field>}
            {form.type === 'libre' && <Field label="Unité"><input value={form.unit || ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>}
            <Field label="Échéance"><input type="date" value={form.deadline || ''} onChange={(e) => setForm({ ...form, deadline: e.target.value || null })} /></Field>
          </div>
          <Field label="Intitulé"><input value={form.title} placeholder={suggestTitle(form)} onChange={(e) => setForm({ ...form, title: e.target.value })} onFocus={() => !form.title && setForm({ ...form, title: suggestTitle(form) })} /></Field>
        </>)}
      </Sheet>
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger title="Supprimer l’objectif ?" confirmLabel="Supprimer" text={confirm?.title} onConfirm={() => run(() => del(`/goals/${confirm.id}`), 'Objectif supprimé')} />
    </Page>
  );
}
