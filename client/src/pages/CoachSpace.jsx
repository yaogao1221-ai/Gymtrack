import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, Icon, Loading, ErrorBox, useToast } from '../components/ui.jsx';
import { get, post, patch } from '../lib/api.js';

const n = (x) => (x == null ? '—' : Number(x).toLocaleString('fr-FR', { maximumFractionDigits: 1 }));
const TONE = { confirmee: 'good', suggeree: 'mid', a_valider: 'warn', insuffisant: 'muted' };

// Espace Coach : un seul endroit pour la décision du jour, les questions, tout ce qui attend ta validation et le bilan.
// Le coach est un moteur expert intégré : il calcule sur tes données, cite ses chiffres et ne change rien sans ton accord.
export default function CoachSpace() {
  const hub = useApi('/coach/hub'); const today = useApi('/coach/today');
  const [q, setQ] = useState(null);
  useEffect(() => { if (location.hash === '#valider' && hub.data) document.getElementById('valider')?.scrollIntoView({ behavior: 'smooth' }); }, [hub.data]);
  if (hub.error && !hub.data) return <ErrorBox error={hub.error} retry={hub.reload} />;
  if (!hub.data) return <Loading />;
  const h = hub.data; const t = today.data;
  return (
    <div className="page fade-in coach-space">
      <header className="page-head">
        <div><p className="eyebrow">Ton coach</p><h1>Coach</h1></div>
        <Link to="/plus" className="icon-btn" aria-label="Réglages"><Icon name="menu" /></Link>
      </header>
      <p className="cs-lede">Je calcule sur tes séances, ta récupération et ton programme. Je cite toujours mes chiffres, et rien ne change sans ton accord.</p>

      {t && <section className="cs-today">
        <p className="eyebrow">Décision du jour</p>
        <h2 className="cs-head">{t.headline}</h2>
        {t.sub && <p className="muted">{t.sub}</p>}
        {t.lines?.length > 0 && <ul className="cs-lines">{t.lines.slice(0, 4).map((l, i) => <li key={i}>{l.text || l}</li>)}</ul>}
        <div className="row gap-s mt">
          {t.day && t.kind === 'workout' && <Link className="btn primary lg" to={`/seance/${t.day.id}`}><Icon name="play" size={18} />Briefing et go</Link>}
          <button className="btn" onClick={() => setQ('today')}>Pourquoi ?</button>
        </div>
      </section>}

      <Questions list={h.questions} open={q} setOpen={setQ} />
      <Inbox box={h.inbox} reload={() => { hub.reload(); today.reload(); }} />
      <Recovery r={h.recovery} />
      {h.stagnation.length > 0 && <Stagnation list={h.stagnation} onAsk={() => setQ('stagnate')} />}
      <Week w={h.week} />
    </div>
  );
}

function Questions({ list, open, setOpen }) {
  const [ans, setAns] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => {
    if (!open) return; setAns(null); setErr(null);
    get(`/coach/ask/${open}`).then(setAns).catch(setErr);
    setTimeout(() => document.getElementById('cs-answer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, [open]);
  return (
    <section className="cs-sec">
      <div className="cs-sec-h"><h2>Pose ta question</h2><span className="muted small">10 questions, réponses chiffrées</span></div>
      <ol className="cs-q">
        {list.map((x, i) => (
          <li key={x.id}><button className={open === x.id ? 'on' : ''} onClick={() => setOpen(open === x.id ? null : x.id)}><span className="cs-qn">{String(i + 1).padStart(2, '0')}</span><span className="grow">{x.q}</span><Icon name={open === x.id ? 'down' : 'right'} size={16} /></button>
            {open === x.id && <div id="cs-answer" className="cs-answer">
              {err ? <p className="warn-text small">{err.message}</p> : !ans ? <p className="muted small">Calcul…</p> : <Answer a={ans} />}
            </div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Answer({ a }) {
  const nav = useNavigate();
  return (<>
    <p className="cs-ans-head">{a.headline}</p>
    {a.points.length > 0 && <ul className="cs-points">{a.points.map((p, i) => <li key={i} className={p.tone}>{p.text}</li>)}</ul>}
    {a.evidence.length > 0 && <dl className="cs-evidence">{a.evidence.map((e) => <div key={e.label}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}</dl>}
    {a.actions.length > 0 && <div className="row gap-s mt-s">{a.actions.map((x) => <button key={x.label} className="btn sm" onClick={() => { if (x.to.startsWith('/coach#')) document.getElementById(x.to.split('#')[1])?.scrollIntoView({ behavior: 'smooth' }); else nav(x.to); }}>{x.label}<Icon name="right" size={14} /></button>)}</div>}
  </>);
}

function Inbox({ box, reload }) {
  const toast = useToast(); const nav = useNavigate(); const [busy, setBusy] = useState(null); const [why, setWhy] = useState(null); const [all, setAll] = useState(false);
  const conf = box.items.filter((it) => it.state === 'confirmee' && it.accept.type === 'analysis');
  const shown = all ? box.items : box.items.slice(0, 5);
  const acceptAll = async () => {
    setBusy('all');
    try { for (const it of conf) await post('/analysis/apply', { key: it.accept.key }); toast(`${conf.length} hausse${conf.length > 1 ? 's' : ''} confirmée${conf.length > 1 ? 's' : ''} validée${conf.length > 1 ? 's' : ''}`); reload(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  };
  const accept = async (it) => {
    if (it.accept.type === 'link') { nav(it.accept.to); return; }
    setBusy(it.key);
    try {
      if (it.accept.type === 'analysis') await post('/analysis/apply', { key: it.accept.key });
      else if (it.accept.type === 'bump') { await patch(`/program/exercises/${it.accept.pe_id}`, { sets: it.accept.sets }); await post('/analysis/dismiss', { key: it.key }).catch(() => {}); }
      toast('Validé : ton programme est à jour'); reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  };
  const refuse = async (it) => { setBusy(it.key); try { await post('/analysis/dismiss', { key: it.key }); toast('Refusé : je ne le reproposerai pas avant 3 semaines'); reload(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); } };
  return (
    <section className="cs-sec" id="valider">
      <div className="cs-sec-h"><h2>À valider</h2><span className="cs-count">{box.items.length}</span></div>
      {!box.items.length ? <p className="muted small">Rien en attente. Je te proposerai quelque chose dès que tes séances le justifient.</p>
        : <>{conf.length > 1 && <div className="cs-bulk"><span className="small">{conf.length} hausses confirmées par deux séances réussies d’affilée.</span><button className="btn sm" disabled={busy === 'all'} onClick={acceptAll}><Icon name="check" size={14} />Tout valider</button></div>}
        <ul className="cs-inbox">{shown.map((it) => (
          <li key={it.key} className={`t-${TONE[it.state] || 'mid'}`}>
            <p className="cs-state">{it.state_label}{it.day ? ` · ${it.day}` : ''}</p>
            <p className="cs-title">{it.title}</p>
            {it.current && <p className="cs-delta"><span>{it.current}</span><Icon name="right" size={14} /><b>{it.proposed}</b></p>}
            <p className="small">{it.reason}</p>
            {it.evidence?.length > 0 && <button className="cs-why" onClick={() => setWhy(why === it.key ? null : it.key)}>Sur quoi je me base <Icon name={why === it.key ? 'down' : 'right'} size={12} /></button>}
            {why === it.key && <ul className="cs-ev">{it.evidence.map((e) => <li key={e}>{e}</li>)}</ul>}
            <div className="row gap-s mt-s">
              <button className="btn primary sm" disabled={busy === it.key} onClick={() => accept(it)}><Icon name="check" size={14} />{it.accept.type === 'link' ? 'Planifier' : 'Valider'}</button>
              <button className="btn sm" disabled={busy === it.key} onClick={() => refuse(it)}>Refuser</button>
            </div>
          </li>))}</ul>
        {box.items.length > 5 && <button className="btn block mt-s" onClick={() => setAll(!all)}>{all ? 'Réduire' : `Voir les ${box.items.length - 5} autres propositions`}</button>}</>}
      {(box.holds.length > 0 || box.setup.length > 0) && <details className="cs-more">
        <summary>{box.holds.length} en pause · {box.setup.length} sans données suffisantes</summary>
        <ul>{[...box.holds, ...box.setup].map((x) => <li key={x.title}><b>{x.title}</b><span className="small muted"> {x.reason}</span></li>)}</ul>
      </details>}
    </section>
  );
}

function Recovery({ r }) {
  const o = r.observed;
  return (
    <section className="cs-sec">
      <div className="cs-sec-h"><h2>Récupération</h2><Link className="link small" to="/corps">Carte du corps</Link></div>
      <div className="cs-duo">
        <div><span className="eyebrow">Estimée</span><b className="num-l">{r.estimated.score}<span className="unit-s">/100</span></b><span className="small">{r.estimated.label}</span></div>
        <div><span className="eyebrow">Observée</span><b className="num-l">{o.enough ? o.score : '—'}{o.enough && <span className="unit-s">/100</span>}</b><span className="small">{o.label}</span></div>
      </div>
      <p className="small mt-s">{r.verdict}</p>
      {o.enough && <p className="small muted">{o.text}</p>}
      <p className="xs muted mt-s">{r.note}</p>
    </section>
  );
}

function Stagnation({ list, onAsk }) {
  return (
    <section className="cs-sec">
      <div className="cs-sec-h"><h2>Stagnations</h2><button className="link small" onClick={onAsk}>Diagnostic complet</button></div>
      <ul className="cs-stag">{list.map((x) => (
        <li key={x.exercise_id}><span className="grow"><b>{x.exercise}</b><span className="small muted">{x.causes[0]?.text || x.text}</span></span>
          <span className={`cs-pct ${x.change_pct < 0 ? 'neg' : ''}`}>{x.change_pct > 0 ? '+' : ''}{n(x.change_pct)} %</span></li>
      ))}</ul>
    </section>
  );
}

function Week({ w }) {
  const rows = [
    ['Séances', `${w.cur.workouts}`, `/ ${w.target}`, w.prev.workouts],
    ['Séries', n(w.cur.sets), '', n(w.prev.sets)],
    ['Volume', n(Math.round(w.cur.volume_lbs / 100) / 10), 'k lbs', n(Math.round(w.prev.volume_lbs / 100) / 10)],
    ['Records', w.cur.records, '', w.prev.records],
    ['Cardio', w.cur.cardio_minutes, 'min', w.prev.cardio_minutes],
  ];
  return (
    <section className="cs-sec">
      <div className="cs-sec-h"><h2>Bilan de la semaine</h2><Link className="link small" to="/progres?v=bilan">Détail</Link></div>
      <table className="cs-week"><thead><tr><th /><th>Cette semaine</th><th>Précédente</th></tr></thead>
        <tbody>{rows.map(([l, v, u, p]) => <tr key={l}><td>{l}</td><td><b>{v}</b><span className="unit-s">{u}</span></td><td className="muted">{p}</td></tr>)}</tbody></table>
      {w.wins.length > 0 && <ul className="cs-points">{w.wins.map((x) => <li key={x} className="good">{x}</li>)}</ul>}
      {w.watch.length > 0 && <ul className="cs-points">{w.watch.map((x) => <li key={x} className="warn">{x}</li>)}</ul>}
      <p className="cs-focus">{w.focus}</p>
    </section>
  );
}
