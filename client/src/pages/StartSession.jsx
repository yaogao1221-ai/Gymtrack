import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { get, store } from '../lib/api.js';
import { Loading, ErrorBox } from '../components/ui.jsx';

// Bouton central « Séance » : reprend la séance en cours, sinon ouvre la séance du jour (ou la suivante du programme)
export default function StartSession() {
  const [to, setTo] = useState(() => { const a = store.get('gt_active_workout'); return a ? `/seance/${a.dayId}` : null; });
  const [error, setError] = useState(null);
  useEffect(() => {
    if (to) return;
    get('/dashboard').then((d) => {
      const id = (!d.day?.workout?.done && d.day?.workout?.program_day_id) || d.next?.program_day_id;
      setTo(id ? `/seance/${id}` : '/programme');
    }).catch(setError);
  }, [to]);
  if (error) return <ErrorBox error={error} />;
  return to ? <Navigate to={to} replace /> : <Loading />;
}
