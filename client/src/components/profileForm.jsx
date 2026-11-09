import { Field, Chips, Segmented, NumInput } from './ui.jsx';
import { DAYS, GOALS, LEVELS, CARDIO_GOALS, CARDIO } from '../lib/format.js';

const entries = (o) => Object.entries(o);

export function GoalsSection({ p, set }) {
  return (<>
    <Field label="Objectif principal"><Chips single value={p.goal} onChange={(v) => set({ goal: v })} options={entries(GOALS)} /></Field>
    <Field label="Tes objectifs en quelques mots" hint="Ex. : prendre du muscle sur le haut du corps, développé couché à 60 lbs d’ici l’été…">
      <textarea rows={3} value={p.goals_text || ''} onChange={(e) => set({ goals_text: e.target.value })} />
    </Field>
    <Field label="Niveau d’expérience en musculation"><Segmented value={p.level} onChange={(v) => set({ level: v })} options={entries(LEVELS)} /></Field>
  </>);
}

export function AvailabilitySection({ p, set, days }) {
  const schedule = p.schedule || {};
  return (<>
    <div className="grid2">
      <Field label="Séances muscu / semaine"><NumInput value={p.sessions_per_week} onChange={(v) => set({ sessions_per_week: v })} /></Field>
      <Field label="Durée max d’une séance (min)"><NumInput value={p.session_minutes} onChange={(v) => set({ session_minutes: v })} /></Field>
    </div>
    <Field label="Jours où tu peux t’entraîner"><Chips value={p.available_days || []} onChange={(v) => set({ available_days: v })} options={DAYS} /></Field>
    <Field label="Planning type de la semaine" hint="Sert à planifier le calendrier et à vérifier la récupération entre les séances.">
      <div className="schedule-grid">
        {DAYS.map(([k, l]) => (
          <div key={k} className="schedule-row">
            <span>{l}</span>
            <select value={schedule[k] || 'rest'} onChange={(e) => set({ schedule: { ...schedule, [k]: e.target.value } })}>
              <option value="rest">Repos</option>
              {days.map((d) => <option key={d.code} value={d.code}>{d.name} — {d.focus}</option>)}
            </select>
          </div>
        ))}
      </div>
    </Field>
  </>);
}

export function PreferencesSection({ p, set }) {
  return (<>
    <div className="grid2">
      <Field label="Unité par défaut"><Segmented value={p.weight_unit} onChange={(v) => set({ weight_unit: v })} options={[['lbs', 'lbs'], ['kg', 'kg']]} /></Field>
      <Field label="Repos par défaut (s)"><NumInput value={p.default_rest_seconds} onChange={(v) => set({ default_rest_seconds: v })} /></Field>
    </div>
    <Field label="Préférences d’entraînement" hint="Machines vs poids libres, exercices que tu aimes ou évites…">
      <textarea rows={2} value={p.preferences || ''} onChange={(e) => set({ preferences: e.target.value })} />
    </Field>
    <Field label="Historique sportif" hint="Depuis quand tu t’entraînes, sports pratiqués, pauses…">
      <textarea rows={2} value={p.sport_history || ''} onChange={(e) => set({ sport_history: e.target.value })} />
    </Field>
  </>);
}

export function TrackingSection({ p, set }) {
  return (<>
    <p className="muted small">Tout est facultatif. Le poids sert à estimer les calories du cardio, le sommeil à évaluer ta récupération.</p>
    <div className="grid2">
      <Field label="Sexe"><select value={p.sex || ''} onChange={(e) => set({ sex: e.target.value || null })}><option value="">—</option><option value="homme">Homme</option><option value="femme">Femme</option><option value="autre">Autre</option></select></Field>
      <Field label="Année de naissance"><NumInput value={p.birth_year} onChange={(v) => set({ birth_year: v })} /></Field>
      <Field label="Taille (cm)"><NumInput value={p.height_cm} onChange={(v) => set({ height_cm: v })} /></Field>
      <Field label="Poids (kg)"><NumInput value={p.body_weight_kg} onChange={(v) => set({ body_weight_kg: v })} /></Field>
      <Field label="Sommeil moyen (h)"><NumInput value={p.sleep_hours} onChange={(v) => set({ sleep_hours: v })} /></Field>
    </div>
    <Field label="Blessures, douleurs ou limitations connues">
      <textarea rows={2} value={p.limitations || ''} onChange={(e) => set({ limitations: e.target.value })} />
    </Field>
  </>);
}

export function CardioSection({ p, set }) {
  return (<>
    <Field label="Objectif cardio"><Chips single value={p.cardio_goal} onChange={(v) => set({ cardio_goal: v })} options={entries(CARDIO_GOALS)} /></Field>
    <Field label="Niveau cardio actuel"><Segmented value={p.cardio_level} onChange={(v) => set({ cardio_level: v })} options={entries(LEVELS)} /></Field>
    <div className="grid2">
      <Field label="Séances cardio visées / sem."><NumInput value={p.cardio_sessions_target} onChange={(v) => set({ cardio_sessions_target: v })} /></Field>
      <Field label="Durée visée par séance (min)"><NumInput value={p.cardio_minutes_target} onChange={(v) => set({ cardio_minutes_target: v })} /></Field>
    </div>
    <Field label="Activités préférées"><Chips value={p.cardio_preferred || []} onChange={(v) => set({ cardio_preferred: v })} options={entries(CARDIO).filter(([k]) => k !== 'autre')} /></Field>
  </>);
}

// Champs envoyés à l'API
export const PROFILE_KEYS = ['name', 'goal', 'goals_text', 'level', 'sessions_per_week', 'session_minutes', 'available_days', 'schedule', 'weight_unit', 'default_rest_seconds',
  'preferences', 'sport_history', 'birth_year', 'sex', 'height_cm', 'body_weight_kg', 'sleep_hours', 'cardio_goal', 'cardio_level', 'cardio_sessions_target', 'cardio_minutes_target', 'cardio_preferred', 'limitations'];
export const pickProfile = (p) => Object.fromEntries(PROFILE_KEYS.filter((k) => k in p).map((k) => [k, p[k]]));
