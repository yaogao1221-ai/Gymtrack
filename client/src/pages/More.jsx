import { Link } from 'react-router-dom';
import { Page, Icon } from '../components/ui.jsx';
import { getToken, setToken } from '../lib/api.js';

const ITEMS = [
  ['/calendrier', 'calendar', 'Calendrier', 'Planifier, déplacer, consulter'],
  ['/coach', 'brain', 'Analyse', 'Analyse, progression, récupération'],
  ['/objectifs', 'target', 'Objectifs', 'Charges, régularité, cardio, poids'],
  ['/profil', 'user', 'Profil', 'Objectifs, disponibilités, préférences'],
  ['/donnees', 'database', 'Données & sauvegarde', 'Export, import, sauvegardes'],
];

export default function More() {
  return (
    <Page title="Plus">
      <ul className="menu-list">
        {ITEMS.map(([to, icon, label, hint]) => (
          <li key={to}><Link to={to}><span className="menu-ic"><Icon name={icon} /></span><span><b>{label}</b><span className="muted small">{hint}</span></span><Icon name="right" size={18} /></Link></li>
        ))}
      </ul>
      {getToken() && <button className="btn ghost block mt" onClick={() => { setToken(null); window.location.reload(); }}>Se déconnecter</button>}
      <p className="muted small center mt">GymTrack · v1.1</p>
    </Page>
  );
}
