import { NavLink } from 'react-router-dom';
import { Icon } from './ui.jsx';

// Sous-onglets d'un espace : on passe d'un écran lié à l'autre sans repasser par un menu
export const SECTIONS = {
  training: [['/programme', 'dumbbell', 'Programme'], ['/calendrier', 'calendar', 'Calendrier'], ['/cardio', 'heart', 'Cardio']],
  body: [['/corps', 'scale', 'Poids et cure'], ['/plan', 'target', 'Mon plan']],
  progress: [['/progres', 'chart', 'Progrès'], ['/objectifs', 'target', 'Objectifs'], ['/bilan', 'upload', 'Bilan'], ['/coach', 'brain', 'Analyse']],
};
export const SPACE_OF = (path) => {
  if (/^\/(programme|calendrier|cardio|seance|historique)/.test(path)) return 'training';
  if (/^\/(progres|objectifs|bilan|coach)/.test(path)) return 'progress';
  return null;
};

export function SectionTabs({ group }) {
  const items = SECTIONS[group] || [];
  return (
    <nav className="section-tabs" aria-label="Sections">
      {items.map(([to, icon, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'on' : '')}><Icon name={icon} size={15} />{label}</NavLink>
      ))}
    </nav>
  );
}
