import { useState } from 'react';
import { Icon, useToast } from '../components/ui.jsx';
import { pushSupport, pushPrefs, enablePush, disablePush } from '../lib/league.js';

const KINDS = [['dm', 'Messages privés'], ['post', 'Félicitations et chambrages'], ['challenge', 'Nouveaux défis']];

export function NotifToggle() {
  const toast = useToast(); const sup = pushSupport();
  const [prefs, setPrefs] = useState(pushPrefs()); const [busy, setBusy] = useState(false);
  const on = !!prefs;
  const flip = async () => {
    setBusy(true);
    try {
      if (on) { await disablePush(); setPrefs(null); toast('Notifications coupées'); }
      else { const p = { dm: true, post: true, challenge: true }; await enablePush(p); setPrefs(p); toast('Notifications activées'); }
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const setKind = async (k) => {
    const p = { ...prefs, [k]: !prefs[k] };
    try { await enablePush(p); setPrefs(p); } catch (e) { toast(e.message, 'err'); }
  };
  if (!sup.ok) {
    return (
      <div className="share-toggle notif-help">
        <span className="grow"><b className="small">Notifications</b>
          <span className="muted small">{sup.reason === 'install'
            ? 'Sur iPhone, ajoute d’abord l’appli à l’écran d’accueil : dans Safari, touche Partager puis « Sur l’écran d’accueil », et ouvre GymTrack depuis l’icône.'
            : sup.reason === 'denied' ? 'Notifications bloquées : autorise-les dans Réglages > Notifications > GymTrack.' : 'Ce navigateur ne gère pas les notifications.'}</span></span>
        <Icon name="info" size={18} />
      </div>
    );
  }
  return (
    <>
      <label className="share-toggle">
        <span className="grow"><b className="small">Notifications</b><span className="muted small">Sois prévenu quand on t’écrit, te chambre ou lance un défi.</span></span>
        <input type="checkbox" role="switch" className="switch" checked={on} disabled={busy} onChange={flip} />
      </label>
      {on && <div className="chips mt-s">{KINDS.map(([k, l]) => <button key={k} className={`chip ${prefs[k] ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>)}</div>}
    </>
  );
}
