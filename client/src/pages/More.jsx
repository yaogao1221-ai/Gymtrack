import { Link } from 'react-router-dom';
import { Page, Icon } from '../components/ui.jsx';
import { getToken, setToken, LEAGUE_ON } from '../lib/api.js';

// Tout ce qui n'est pas déjà dans les onglets du bas : outils ponctuels et réglages
const GROUPS = [
  ['Outils', [
    ...(LEAGUE_ON ? [['/rappels', 'timer', 'Rappels de séance', 'Alarmes dans ton calendrier']] : []),
    ['/outils', 'target', 'Calculateurs', '1RM, zones cardio, disques'],
  ]],
  ['Réglages', [
    ['/profil', 'user', 'Profil', 'Niveau, disponibilités, préférences'],
    ['/donnees', 'database', 'Données & sauvegarde', 'Export, import, sauvegardes'],
  ]],
];

export default function More() {
  return (
    <Page title="Réglages et outils">
      {GROUPS.map(([title, items]) => (
        <section key={title} className="menu-group">
          <p className="eyebrow">{title}</p>
          <ul className="menu-list">
            {items.map(([to, icon, label, hint]) => (
              <li key={to}><Link to={to}><span className="menu-ic"><Icon name={icon} /></span><span><b>{label}</b><span className="muted small">{hint}</span></span><Icon name="right" size={18} /></Link></li>
            ))}
          </ul>
        </section>
      ))}
      {getToken() && <button className="btn ghost block mt" onClick={() => { setToken(null); window.location.reload(); }}>Se déconnecter</button>}
      <p className="muted small center mt">GymTrack · v3.0</p>
    </Page>
  );
}
