import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import iconUrl from './icon.svg';
import { Routes, Route, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { get, onAuthRequired, flushOutbox, outboxCount, store, STANDALONE, LEAGUE_ON, PAGES, onDataChange } from './lib/api.js';
import { Icon, Loading, useToast } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
const Program = lazy(() => import('./pages/Program.jsx'));
import Workout from './pages/Workout.jsx';
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail.jsx'));
const Cardio = lazy(() => import('./pages/Cardio.jsx'));
const Calendar = lazy(() => import('./pages/Calendar.jsx'));
const Progress = lazy(() => import('./pages/Progress.jsx'));
const Coach = lazy(() => import('./pages/Coach.jsx'));
const Goals = lazy(() => import('./pages/Goals.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Data = lazy(() => import('./pages/Data.jsx'));
const More = lazy(() => import('./pages/More.jsx'));
const League = lazy(() => import('./pages/League.jsx'));
const Reminders = lazy(() => import('./pages/Reminders.jsx'));
const Recap = lazy(() => import('./pages/Recap.jsx'));
const Nutrition = lazy(() => import('./pages/Nutrition.jsx'));
const Tools = lazy(() => import('./pages/Tools.jsx'));
const Plan = lazy(() => import('./pages/Plan.jsx'));

// Barre du bas : 5 espaces. Chaque espace regroupe des écrans liés, reliés par des sous-onglets.
const NAV = [
  ['/', 'home', "Aujourd'hui", null],
  ['/programme', 'dumbbell', 'Entraînement', /^\/(programme|calendrier|cardio|historique)/],
  ['/corps', 'scale', 'Corps', /^\/(corps|plan)/],
  ['/progres', 'chart', 'Progrès', /^\/(progres|objectifs|bilan|coach)/],
  LEAGUE_ON ? ['/ligue', 'trophy', 'Ligue', /^\/ligue/] : ['/plus', 'menu', 'Plus', /^\/(plus|profil|donnees|rappels|outils)/],
];
// Barre latérale (ordinateur) : tout est visible, rangé par espace
const SIDE = [
  ['/', 'home', "Aujourd'hui"],
  ['Entraînement'], ['/programme', 'dumbbell', 'Programme'], ['/calendrier', 'calendar', 'Calendrier'], ['/cardio', 'heart', 'Cardio'],
  ['Corps'], ['/corps', 'scale', 'Poids, calories, cure'], ['/plan', 'target', 'Mon plan'],
  ['Progrès'], ['/progres', 'chart', 'Progrès'], ['/objectifs', 'target', 'Objectifs'], ['/bilan', 'upload', 'Bilan'], ['/coach', 'brain', 'Analyse'],
  ...(LEAGUE_ON ? [['Entre amis'], ['/ligue', 'trophy', 'Ligue']] : []),
  ['Réglages'], ['/profil', 'user', 'Profil'], ['/donnees', 'database', 'Données'], ['/plus', 'menu', 'Tout le reste'],
];

export default function App() {
  const [auth, setAuth] = useState(null); // null = vérification, false = connexion requise
  const [profile, setProfile] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(outboxCount());
  const loc = useLocation(); const nav = useNavigate(); const toast = useToast();

  const check = useCallback(async () => {
    try {
      const s = await get('/auth/status');
      if (!s.authenticated) return setAuth(false);
      setAuth(true);
      setProfile(await get('/profile'));
    } catch {
      // Hors ligne : on laisse entrer si un profil est en cache (le service worker sert les lectures)
      setAuth(true);
      try { setProfile(await get('/profile')); } catch { setProfile({ onboarded: true }); }
    }
  }, []);
  useEffect(() => { check(); return onAuthRequired(() => setAuth(false)); }, [check]);

  const sync = useCallback(async () => {
    const n = await flushOutbox(); setPending(outboxCount());
    if (n) toast(`${n} séance(s) synchronisée(s)`);
  }, [toast]);
  useEffect(() => {
    const on = () => { setOnline(true); sync(); }; const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const t = setInterval(() => { setPending(outboxCount()); if (outboxCount() && navigator.onLine) sync(); }, 30000);
    sync();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(t); };
  }, [sync]);
  useEffect(() => { window.scrollTo(0, 0); setPending(outboxCount()); }, [loc.pathname]);

  // Ligue : après une séance, un cardio ou une modification du programme, les totaux partent tout seuls (les amis voient le classement à jour)
  useEffect(() => {
    if (!LEAGUE_ON) return undefined;
    let t = null;
    const off = onDataChange((path) => {
      if (!/^\/(workouts|cardio|program|body-metrics)/.test(path)) return;
      clearTimeout(t);
      t = setTimeout(async () => {
        try { const L = await import('./lib/league.js'); if (L.getMembership() && navigator.onLine) { await L.syncBoard(); await L.pushShare(); } } catch { /* réessayé à la prochaine modification ou à l'ouverture de la ligue */ }
      }, 4000);
    });
    return () => { off(); clearTimeout(t); };
  }, []);

  // Objectifs : dès qu'une donnée (séance, cardio, pesée…) fait atteindre un objectif, on le signale, d'où qu'elle vienne
  useEffect(() => {
    let t = null;
    const check = async (announce) => {
      try {
        const goals = await get('/goals'); const seen = new Set(store.get('gt_goals_reached', []));
        const now = goals.filter((g) => g.status === 'actif' && g.reached);
        if (announce) now.filter((g) => !seen.has(g.id)).forEach((g) => toast(`Objectif atteint : ${g.title}`));
        store.set('gt_goals_reached', now.map((g) => g.id));
      } catch { /* hors ligne */ }
    };
    check(false);
    const off = onDataChange((path) => { clearTimeout(t); t = setTimeout(() => check(!path.startsWith('/goals')), 600); });
    return () => { off(); clearTimeout(t); };
  }, [toast]);

  // Mises à jour de l'appli : vérifiées à chaque retour sur l'appli, appliquées dès qu'aucune séance n'est en cours
  useEffect(() => {
    if (!PAGES || !('serviceWorker' in navigator)) return undefined;
    let reloading = !navigator.serviceWorker.controller; // première installation : pas de rechargement
    const onCtrl = () => { if (reloading || store.get('gt_active_workout')) return; reloading = true; window.location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', onCtrl);
    const check = () => { if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {}); };
    document.addEventListener('visibilitychange', check);
    return () => { navigator.serviceWorker.removeEventListener('controllerchange', onCtrl); document.removeEventListener('visibilitychange', check); };
  }, []);

  // Une fois l'accueil affiché, les écrans les plus utilisés se chargent en arrière-plan : changer d'onglet reste instantané
  useEffect(() => {
    const t = setTimeout(() => { Promise.all([import('./pages/Program.jsx'), import('./pages/Cardio.jsx'), import('./pages/Calendar.jsx'), import('./pages/Nutrition.jsx'), import('./pages/Progress.jsx')]).catch(() => {}); }, 2000);
    return () => clearTimeout(t);
  }, []);

  if (auth === null) return <Loading />;
  if (auth === false) return <Login onDone={check} />;
  if (!profile) return <Loading />;
  if (!profile.onboarded && loc.pathname !== '/bienvenue') return <Navigate to="/bienvenue" replace />;

  const active = store.get('gt_active_workout');
  const inWorkout = loc.pathname.startsWith('/seance');
  return (
    <div className={`shell ${inWorkout ? 'focus' : ''}`}>
      {!inWorkout && (
        <aside className="sidebar">
          <div className="brand"><img src={iconUrl} alt="" /><span>GymTrack</span></div>
          <nav>{SIDE.map(([to, icon, label]) => (icon ? <NavLink key={to} to={to} end={to === '/'}><Icon name={icon} />{label}</NavLink> : <p key={to} className="side-group">{to}</p>))}</nav>
        </aside>
      )}
      <main className="main">
        {!STANDALONE && (!online || pending > 0) && (
          <div className="banner warn"><Icon name="wifiOff" size={16} />{!online ? 'Hors ligne : tes séances seront synchronisées au retour du réseau.' : `${pending} séance(s) en attente de synchronisation.`}
            {online && pending > 0 && <button className="link" onClick={sync}>Synchroniser</button>}</div>
        )}
        {active && !inWorkout && (
          <button className="resume" onClick={() => nav(`/seance/${active.dayId}`)}><span className="pulse" />Séance en cours : {active.name} <b>Reprendre</b></button>
        )}
        <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bienvenue" element={<Onboarding onDone={(p) => { setProfile(p); nav('/'); }} />} />
          <Route path="/programme" element={<Program />} />
          <Route path="/seance/:dayId" element={<Workout />} />
          <Route path="/historique/:id" element={<WorkoutDetail />} />
          <Route path="/cardio" element={<Cardio />} />
          <Route path="/calendrier" element={<Calendar />} />
          <Route path="/progres" element={<Progress />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/objectifs" element={<Goals />} />
          <Route path="/profil" element={<Profile onSaved={setProfile} />} />
          <Route path="/donnees" element={<Data />} />
          <Route path="/plus" element={<More />} />
          <Route path="/rappels" element={<Reminders />} />
          <Route path="/bilan" element={<Recap />} />
          <Route path="/corps" element={<Nutrition />} />
          <Route path="/outils" element={<Tools />} />
          <Route path="/plan" element={<Plan />} />
          {LEAGUE_ON && <Route path="/ligue" element={<League />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
      {!inWorkout && (
        <nav className="tabbar">{NAV.map(([to, icon, label, re]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive || re?.test(loc.pathname) ? 'active' : '')}><Icon name={icon} size={22} /><span>{label}</span></NavLink>)}</nav>
      )}
    </div>
  );
}
