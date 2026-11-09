import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Card, Icon, Field, Loading, useApi, useToast } from '../components/ui.jsx';
import { store, today } from '../lib/api.js';

// Rappels de séance : un fichier calendrier (.ics) avec des événements hebdomadaires et une alerte.
// C'est l'iPhone (app Calendrier) qui notifie : marche appli fermée, sans réseau et sans serveur.
const DAYS = [['mon', 'Lundi', 'MO', 1], ['tue', 'Mardi', 'TU', 2], ['wed', 'Mercredi', 'WE', 3], ['thu', 'Jeudi', 'TH', 4], ['fri', 'Vendredi', 'FR', 5], ['sat', 'Samedi', 'SA', 6], ['sun', 'Dimanche', 'SU', 0]];
const KEY = 'gt_reminders';
const ALERTS = [[0, 'À l’heure'], [15, '15 min avant'], [30, '30 min avant'], [60, '1 h avant'], [120, '2 h avant']];

const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
function nextDate(weekday) {
  const d = new Date(today() + 'T12:00:00');
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function buildIcs(items, { alert, duration }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GymTrack//Rappels//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:GymTrack'];
  for (const it of items) {
    const [h, m] = it.time.split(':').map(Number);
    const end = h * 60 + m + duration;
    const date = nextDate(it.weekday);
    lines.push('BEGIN:VEVENT', `UID:gymtrack-${it.key}@gymtrack`, `DTSTAMP:${stamp}`,
      `DTSTART:${date}T${pad(h)}${pad(m)}00`, `DTEND:${date}T${pad(Math.floor(end / 60) % 24)}${pad(end % 60)}00`,
      `RRULE:FREQ=WEEKLY;BYDAY=${it.byday}`, `SUMMARY:${esc(it.title)}`, `DESCRIPTION:${esc(it.desc)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(it.title)}`, `TRIGGER:-PT${alert}M`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export default function Reminders() {
  const toast = useToast(); const nav = useNavigate(); const back = () => nav('/plus');
  const profile = useApi('/profile'); const program = useApi('/program');
  const [cfg, setCfg] = useState(() => store.get(KEY, { time: '18:00', alert: 30, duration: 75, times: {}, off: {} }));
  if (!profile.data || !program.data) return <Page title="Rappels" back={back}><Loading /></Page>;
  const save = (c) => { setCfg(c); store.set(KEY, c); };
  const byCode = Object.fromEntries(program.data.days.map((d) => [d.code, d]));
  const rows = DAYS.map(([k, label, byday, weekday]) => {
    const code = profile.data.schedule?.[k]; const day = byCode[code];
    return { key: k, label, byday, weekday, day, time: cfg.times[k] || cfg.time, on: !!day && !cfg.off[k] };
  });
  const active = rows.filter((r) => r.on);
  const download = () => {
    const items = active.map((r) => ({ key: r.key, byday: r.byday, weekday: r.weekday, time: r.time,
      title: `Muscu · ${r.day.name}${r.day.focus ? ` (${r.day.focus})` : ''}`, desc: `${r.day.exercises.length} exercices. Ouvre GymTrack pour lancer la séance.` }));
    const ics = buildIcs(items, cfg);
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'gymtrack-rappels.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('Calendrier prêt : touche « Tout ajouter » sur l’iPhone');
  };
  return (
    <Page title="Rappels de séance" subtitle="Une notification avant chaque séance, via le Calendrier de l’iPhone" back={back}>
      <Card title="Mes séances" icon="calendar">
        <ul className="remind-list">
          {rows.map((r) => (
            <li key={r.key} className={r.day ? '' : 'rest'}>
              <label className="row gap-s grow">
                <input type="checkbox" checked={r.on} disabled={!r.day} onChange={(e) => save({ ...cfg, off: { ...cfg.off, [r.key]: !e.target.checked } })} />
                <span><b>{r.label}</b><span className="muted small">{r.day ? `${r.day.name}${r.day.focus ? ` · ${r.day.focus}` : ''}` : 'Repos'}</span></span>
              </label>
              {r.day && <input type="time" className="time-in" value={r.time} disabled={!r.on} onChange={(e) => save({ ...cfg, times: { ...cfg.times, [r.key]: e.target.value || cfg.time } })} />}
            </li>
          ))}
        </ul>
        <p className="muted small">Les jours viennent de ton planning type (Profil). Change l’heure jour par jour si besoin.</p>
      </Card>
      <Card title="Alerte" icon="timer">
        <div className="row gap-s">
          <Field label="Notification" className="grow">
            <select value={cfg.alert} onChange={(e) => save({ ...cfg, alert: Number(e.target.value) })}>{ALERTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <Field label="Durée de la séance" className="grow">
            <select value={cfg.duration} onChange={(e) => save({ ...cfg, duration: Number(e.target.value) })}>{[45, 60, 75, 90, 120].map((v) => <option key={v} value={v}>{v} min</option>)}</select>
          </Field>
        </div>
        <button className="btn primary block mt" disabled={!active.length} onClick={download}><Icon name="calendar" size={16} />Ajouter à mon calendrier</button>
        <p className="muted small center">{active.length} séance{active.length > 1 ? 's' : ''} par semaine, répétées chaque semaine</p>
      </Card>
      <Card title="Comment ça marche" icon="info">
        <ol className="howto">
          <li>Touche le bouton : l’iPhone affiche les séances, touche <b>Tout ajouter</b> puis choisis ton calendrier.</li>
          <li>Les séances se répètent chaque semaine, avec la notification que tu as choisie. Vérifie que les notifications de l’app <b>Calendrier</b> sont activées (Réglages → Notifications → Calendrier).</li>
          <li>Pour changer d’heure plus tard : supprime l’ancienne série dans Calendrier (touche une séance → Supprimer → toutes les futures), puis ajoute la nouvelle.</li>
        </ol>
        <p className="muted small">Si rien ne s’ouvre depuis l’icône de l’appli, ouvre GymTrack dans Safari et refais l’opération.</p>
      </Card>
    </Page>
  );
}
