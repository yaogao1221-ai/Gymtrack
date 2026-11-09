import iconUrl from '../icon.svg';
import { useState } from 'react';
import { post, setToken } from '../lib/api.js';

export default function Login({ onDone }) {
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const { token } = await post('/auth/login', { password: pw }); setToken(token); onDone(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="card login-card fade-in" onSubmit={submit}>
        <img src={iconUrl} alt="" width="64" height="64" />
        <h1>GymTrack</h1>
        <p className="muted">Ton espace d’entraînement est protégé.</p>
        <input type="password" autoComplete="current-password" placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <p className="error">{err}</p>}
        <button className="btn primary block" disabled={busy || !pw}>{busy ? 'Connexion…' : 'Entrer'}</button>
      </form>
    </div>
  );
}
