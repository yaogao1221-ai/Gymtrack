import { Link } from 'react-router-dom';
import { useApi, Icon } from './ui.jsx';

// Consigne du coach en haut de chaque espace : Corps, Progrès, Nutrition, Soins, Programme.
// Un seul calcul côté serveur (/coach/brief) : chaque consigne tient compte des douleurs, de la fatigue, du programme et de la nutrition.
export default function CoachCard({ section }) {
  const { data } = useApi('/coach/brief');
  const c = data?.[section]; if (!c) return null;
  return (
    <section className={`card coach-card t-${c.tone || 'mid'}`}>
      <div className="cc-head"><span className="cc-badge"><Icon name="chat" size={13} />Coach</span>{c.action && <Link className="link small" to={c.action.to}>{c.action.label} <Icon name="right" size={12} /></Link>}</div>
      <h2 className="cc-title">{c.headline}</h2>
      {c.lines.length > 0 && <ul className="cc-lines">{c.lines.map((l, i) => <li key={i} className={l.tone || ''}><Icon name={l.icon} size={15} /><span>{l.text}</span></li>)}</ul>}
    </section>
  );
}
