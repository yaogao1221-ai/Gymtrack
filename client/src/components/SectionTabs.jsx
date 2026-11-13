import { useEffect, useRef, Suspense } from 'react';
import { NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { Icon, Page, EmbedCtx, Loading } from './ui.jsx';
import { LEAGUE_ON } from '../lib/api.js';

// Sous-onglets d'un espace : on passe d'un écran lié à l'autre sans repasser par un menu
export const SECTIONS = {
  training: [],
  body: [['/corps', 'body', 'Mon corps'], ['/progres', 'chart', 'Progrès'], ['/nutrition', 'food', 'Nutrition'], ['/soins', 'heal', 'Soins']],
};
export const SPACE_OF = (path) => {
  if (/^\/(programme|calendrier|cardio|seance|historique)/.test(path)) return 'training';
  if (/^\/(corps|nutrition|repas|coach|plan|soins|progres|objectifs|bilan)/.test(path)) return 'body';
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

// Écran regroupé : plusieurs vues sous un même onglet, choisies par ?v=
export function Hub({ title, views }) {
  const [sp, setSp] = useSearchParams(); const v = views.find(([k]) => k === sp.get('v')) || views[0];
  const [, , View] = v;
  return (
    <Page tabs={<SectionTabs group="body" />} title={title}>
      <div className="chips scroll hub-chips">{views.map(([k, l]) => <button key={k} className={`chip ${k === v[0] ? 'on' : ''}`} onClick={() => setSp(k === views[0][0] ? {} : { v: k }, { replace: true })}>{l}</button>)}</div>
      <EmbedCtx.Provider value><Suspense fallback={<Loading />}><View key={v[0]} /></Suspense></EmbedCtx.Provider>
    </Page>
  );
}
