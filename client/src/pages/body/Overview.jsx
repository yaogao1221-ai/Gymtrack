import { Link } from 'react-router-dom';
import { Card, Icon, useApi } from '../../components/ui.jsx';
import { AtlasDefs, AtlasFigure, colorFor, MODES } from '../../components/AnatomyMap.jsx';
import { TodayCard } from '../../components/MuscleBrain.jsx';
import CoachCard from '../../components/CoachCard.jsx';
import { BodyCard } from '../Dashboard.jsx';
import { MUSCLE_BY_ID } from '../../../../server/body/muscles.js';
import { n0 } from '../../lib/format.js';

const fr = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
// Muscle « vitrine » de chaque groupe majeur : sert aux conseils (un conseil par groupe, pas un par faisceau)
const SHOW = ['pec_inf', 'grand_dorsal', 'trap_moy', 'delt_lat', 'delt_post', 'biceps', 'triceps_lat', 'vaste_ext', 'biceps_femoral', 'grand_fessier', 'jumeau_int', 'grand_droit'];

// Recommandations tirées de tes vraies données : douleurs, fatigue estimée, volume, progression
export function recommendations(st) {
  if (!st?.summary?.has_data) return [{ icon: 'dumbbell', tone: '', text: 'Enregistre tes premières séances : la carte, la fatigue estimée et les conseils se remplissent à partir de tes séries réelles.' }];
  const out = []; const ms = st.muscles;
  const pains = Object.values(ms).flatMap((m) => m.pain).filter((p, i, a) => a.findIndex((q) => q.id === p.id) === i);
  for (const p of pains) out.push({ icon: 'heal', tone: 'warn', text: `${p.label}${p.side && p.side !== 'deux' ? ` (${p.side})` : ''} : douleur ${p.intensity}/10. Pas de hausse de charge sur les mouvements concernés, amplitude confortable.`, to: `/soins?zone=${p.area}` });
  const high = Object.values(ms).filter((m) => m.recovery.level === 'elevee' && !m.deep);
  if (high.length) out.push({ icon: 'bolt', tone: 'warn', text: `Fatigue estimée élevée : ${high.slice(0, 4).map((m) => m.name.split(' (')[0].toLowerCase()).join(', ')}${high.length > 4 ? '…' : ''}. Mieux vaut ne pas les recharger lourdement aujourd’hui.`, to: '/corps?v=recuperation' });
  const under = SHOW.map((id) => ms[id]).filter((m) => m && m.volume[4].total > 0 && m.volume[4].total < m.volume.zone.low);
  for (const m of under.slice(0, 2)) out.push({ icon: 'target', tone: '', text: `${m.name.split(' (')[0]} : ${fr(m.volume[4].total)} séries par semaine sur 4 semaines, la zone efficace commence à ${m.volume.zone.low}.`, id: m.id });
  const none = SHOW.map((id) => ms[id]).filter((m) => m && m.volume[4].total === 0 && st.summary.sessions_28 >= 3);
  if (none.length) out.push({ icon: 'alert', tone: '', text: `Pas travaillé en 4 semaines : ${none.map((m) => MUSCLE_BY_ID[m.id].name.split(' (')[0].toLowerCase()).join(', ')}.`, to: '/corps?v=muscles' });
  const down = SHOW.map((id) => ms[id]).filter((m) => m && m.progression[8].verdict === 'baisse');
  for (const m of down.slice(0, 2)) out.push({ icon: 'chart', tone: '', text: m.progression[8].text.replace(/^En baisse/, `${m.name.split(' (')[0]} en baisse`), id: m.id });
  if (!out.length) out.push({ icon: 'check', tone: 'good', text: 'Rien à signaler : pas de douleur, pas de fatigue élevée et les muscles principaux sont dans leur zone de volume.' });
  return out;
}

export default function Overview({ st, onOpen, onPain }) {
  const brain = useApi('/muscles/state'); const d = useApi('/dashboard');
  const s = st.summary; const colorOf = colorFor(st, 'rec', {});
  const recs = recommendations(st); const day = d.data?.day;
  return (<>
    <CoachCard section="body" />
    <section className="card ov-sum">
      <div className="ov-stats">
        <Link to="/progres"><b>{s.sessions_7}</b><span className="muted xs">séance{s.sessions_7 > 1 ? 's' : ''} sur 7 j</span></Link>
        <Link to="/corps?v=muscles"><b>{n0(s.sets_7)}</b><span className="muted xs">séries validées</span></Link>
        <Link to="/corps?v=recuperation"><b>{Object.values(st.muscles).filter((m) => m.recovery.level === 'elevee').length}</b><span className="muted xs">muscles très fatigués</span></Link>
        <Link to="/corps?v=articulations"><b className={s.pains ? 'warn' : ''}>{s.pains}</b><span className="muted xs">douleur{s.pains > 1 ? 's' : ''} active{s.pains > 1 ? 's' : ''}</span></Link>
      </div>
      <AtlasDefs />
      <Link to="/corps?v=anatomie" className="ov-map" aria-label="Ouvrir la carte anatomique">
        <AtlasFigure view="front" colorOf={colorOf} sel={null} onPick={() => {}} />
        <AtlasFigure view="back" colorOf={colorOf} sel={null} onPick={() => {}} />
      </Link>
      <div className="bm-legend small">{MODES.rec.legend.map(([k, c, l]) => <span key={k}><i style={{ background: c }} />{l}</span>)}</div>
    </section>
    <Card title="À retenir" icon="sparkles">
      <ul className="ov-recs">{recs.map((r, i) => (
        <li key={i} className={r.tone}><Icon name={r.icon} size={16} />
          <span className="grow small">{r.text}</span>
          {r.to ? <Link className="link small" to={r.to}>Voir</Link> : r.id ? <button className="link small" onClick={() => onOpen(r.id)}>Fiche</button> : null}
        </li>))}</ul>
      <button className="btn sm mt-s" onClick={() => onPain()}><Icon name="heal" size={14} />Signaler une douleur</button>
    </Card>
    <TodayCard state={brain.data} onChange={brain.reload} />
    <MorphoLink />
    {d.data && <BodyCard body={d.data.body} nutrition={d.data.nutrition} />}
    {day && <Link to="/corps?v=nutrition" className="card row gap nut-today">
      <Icon name="food" size={20} />
      <span className="grow"><b>{n0(day.eaten_kcal || 0)}{day.kcal ? ` / ${n0(day.kcal)}` : ''} kcal aujourd’hui</b><span className="muted small">Noter un repas</span></span>
      <Icon name="right" size={16} />
    </Link>}
  </>);
}

// Raccourci vers la morpho-anatomie : nombre de conflits trouvés dans le programme
function MorphoLink() {
  const { data } = useApi('/morpho');
  if (!data) return null;
  const n = data.conflicts.length; const done = Object.keys(data.morpho || {}).length;
  return (
    <Link to="/morphologie" className="card morpho-link">
      <Icon name="body" size={18} />
      <span className="grow"><b>Ma morphologie</b><span className="muted small block">{!done ? 'Réponds à 7 questions : l’appli choisit les exercices adaptés à tes leviers' : n ? `${n} conflit${n > 1 ? 's' : ''} à regarder dans ton programme` : 'Ton programme respecte ta structure'}</span></span>
      {n > 0 && <span className="badge-n">{n}</span>}<Icon name="right" size={16} />
    </Link>
  );
}
