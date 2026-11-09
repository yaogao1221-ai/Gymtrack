import { useEffect, useState, useCallback } from 'react';
import iconUrl from './icon.svg';
import { Routes, Route, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { get, onAuthRequired, flushOutbox, outboxCount, store } from './lib/api.js';
import { Icon, Loading, useToast } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Program from './pages/Program.jsx';
import Workout from './pages/Workout.jsx';
import WorkoutDetail from './pages/WorkoutDetail.jsx';
import Cardio from './pages/Cardio.jsx';
import Calendar from './pages/Calendar.jsx';
import Progress from './pages/Progress.jsx';
import Coach from './pages/Coach.jsx';
import Goals from './pages/Goals.jsx';
import Profile from './pages/Profile.jsx';
import Data from './pages/Data.jsx';
import More from './pages/More.jsx';

const NAV = [
  ['/', 'home', 'Accueil'], ['/programme', 'dumbbell', 'Programme'], ['/cardio', 'heart', 'Cardio'], ['/progres', 'chart', 'Progrès'], ['/plus', 'menu', 'Plus'],
];
const SIDE = [...NAV.slice(0, 4), ['/calendrier', 'calendar', 'Calendrier'], ['/coach', 'brain', 'Analyse'], ['/objectifs', 'target', 'Objectifs'], ['/profil', 'user', 'Profil'], ['/donnees', 'database', 'Données']];

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
          <nav>{SIDE.map(([to, icon, label]) => <NavLink key={to} to={to} end={to === '/'}><Icon name={icon} />{label}</NavLink>)}</nav>
        </aside>
      )}
      <main className="main">
        {(!online || pending > 0) && (
          <div className="banner warn"><Icon name="wifiOff" size={16} />{!online ? 'Hors ligne : tes séances seront synchronisées au retour du réseau.' : `${pending} séance(s) en attente de synchronisation.`}
            {online && pending > 0 && <button className="link" onClick={sync}>Synchroniser</button>}</div>
        )}
        {active && !inWorkout && (
          <button className="resume" onClick={() => nav(`/seance/${active.dayId}`)}><span className="pulse" />Séance en cours : {active.name} <b>Reprendre</b></button>
        )}
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!inWorkout && (
        <nav className="tabbar">{NAV.map(([to, icon, label]) => <NavLink key={to} to={to} end={to === '/'}><Icon name={icon} size={22} /><span>{label}</span></NavLink>)}</nav>
      )}
    </div>
  );
}
