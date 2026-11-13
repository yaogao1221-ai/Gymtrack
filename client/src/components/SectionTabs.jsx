import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from './ui.jsx';
import { LEAGUE_ON } from '../lib/api.js';

// Sous-onglets d'un espace : on passe d'un écran lié à l'autre sans repasser par un menu
export const SECTIONS = {
  training: [['/programme', 'dumbbell', 'Programme'], ['/calendrier', 'calendar', 'Calendrier'], ['/cardio', 'heart', 'Cardio']],
  body: [['/corps', 'scale', 'Poids'], ['/progres', 'chart', 'Progrès'], ['/coach', 'body', 'Analyse'], ['/repas', 'food', 'Repas'], ['/objectifs', 'target', 'Objectifs'], ['/plan', 'target', 'Plan'], ['/bilan', 'upload', 'Bilan'], ['/soins', 'heal', 'Soins']],
};
export const SPACE_OF = (path) => {
  if (/^\/(programme|calendrier|cardio|seance|historique)/.test(path)) return 'training';
  if (/^\/(corps|repas|coach|plan|soins|progres|objectifs|bilan)/.test(path)) return 'body';
  return null;
};

export function SectionTabs({ group }) {
  const items = SECTIONS[group] || []; const ref = useRef(null); const loc = useLocation();
  // L'onglet actif reste visible même quand la liste défile (8 onglets dans Corps)
  useEffect(() => { const el = ref.current?.querySelector('a.on'); if (el && ref.current) ref.current.scrollLeft = el.offsetLeft - 16; }, [loc.pathname]);
  return (
    <nav className="section-tabs" aria-label="Sections" ref={ref}>
      {items.map(([to, icon, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'on' : '')}><Icon name={icon} size={15} />{label}</NavLink>
      ))}
    </nav>
  );
}
