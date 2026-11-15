import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Icon, Fold, Loading, Segmented, useApi, useToast } from '../../components/ui.jsx';
import BodyMap from '../../components/BodyMap.jsx';
import BalanceCard from '../../components/Balance.jsx';
import MissingMuscles from '../../components/MissingMuscles.jsx';
import { JointPanel, JOINT_COLORS, JOINT_LABEL } from '../../components/MuscleBrain.jsx';
import { ExerciseInfo } from '../../components/ExerciseDemo.jsx';
import { MODES, volVerdict } from '../../components/AnatomyMap.jsx';
import { MUSCLE_LIST, REGIONS } from '../../../../server/body/muscles.js';
import { put, patch } from '../../lib/api.js';
import { fmtDate } from '../../lib/format.js';

const fr = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const dot = (mode, k) => MODES[mode].legend.find(([x]) => x === k)?.[1];

// ---------- Muscles : les 46 muscles par région, puis la vue par groupe (équilibre, priorités, muscles oubliés) ----------
export function MusclesTab({ st, onOpen, onChange }) {
  const [sort, setSort] = useState('region');
  const map = useApi('/bodymap'); const bal = useApi('/bodymap/balance'); const brain = useApi('/muscles/state');
  const rows = MUSCLE_LIST.map((m) => st.muscles[m.id]);
  const byRegion = Object.keys(REGIONS).map((r) => [r, rows.filter((m) => m.region === r)]);
  const list = sort === 'region' ? byRegion : [['', [...rows].sort((a, b) => (sort === 'volume' ? b.volume[4].total - a.volume[4].total : b.recovery.fatigue - a.recovery.fatigue))]];
  return (<>
    <section className="card">
      <div className="card-head"><h2><Icon name="body" size={16} />{MUSCLE_LIST.length} muscles</h2></div>
      <Segmented value={sort} onChange={setSort} options={[['region', 'Par région'], ['volume', 'Par volume'], ['fatigue', 'Par fatigue']]} />
      {list.map(([r, ms]) => (
        <div key={r || 'all'}>
          {r && <h4 className="h-sub">{REGIONS[r]}</h4>}
          <ul className="mus-list">{ms.map((m) => (
            <li key={m.id}><button onClick={() => onOpen(m.id)}>
              <i className="ms-dot" style={{ background: dot('rec', m.recovery.level) }} title={m.recovery.label} />
              <span className="grow"><b className="small">{m.name}</b>{m.deep && <span className="muted xs"> · profond</span>}
                <span className="muted xs block">{fr(m.volume[4].total)} séries / sem. (4 sem.) · {m.recovery.label.replace('Fatigue estimée ', 'fatigue ')}</span></span>
              {m.pain.length > 0 && <Icon name="heal" size={14} className="warn" />}
              <i className="ms-dot" style={{ background: dot('vol', volVerdict(m, 4, 'total')) }} title="Volume" />
              <Icon name="right" size={14} />
            </button></li>))}</ul>
        </div>))}
      <p className="muted xs mt-s">Point de gauche : fatigue estimée. Point de droite : volume sur 4 semaines par rapport à la zone efficace.</p>
    </section>
    <Fold title="Vue par groupe musculaire" icon="target" hint="équilibre, priorités, articulations">
      {map.data ? <BodyMap data={map.data} balance={bal.data} state={brain.data} onChange={() => { brain.reload(); map.reload(); onChange?.(); }} /> : <Loading />}
    </Fold>
    <Fold title="Équilibre musculaire en détail" icon="scale" hint={bal.data?.issues ? `${bal.data.issues} écart${bal.data.issues > 1 ? 's' : ''}` : 'équilibré'}>
      <p className="muted xs">Comparaison de tes séries et de tes charges entre muscles opposés : un repère d’entraînement, pas un diagnostic.</p><BalanceCard data={bal.data} />
    </Fold>
    <div id="oublies"><Fold title="Muscles oubliés" icon="target" hint="à ajouter au programme" open={typeof location !== 'undefined' && location.hash.includes('oublies')}><MissingMuscles onAdded={() => map.reload()} /></Fold></div>
  </>);
}

// ---------- Récupération : fatigue estimée par muscle, méthode expliquée et réglable ----------
export function RecoveryTab({ st, onOpen, onChange }) {
  const cfg = useApi('/body/settings'); const d = useApi('/dashboard'); const toast = useToast();
  const set = async (patchS) => { try { await put('/body/settings', { ...cfg.data.settings, ...patchS }); cfg.reload(); onChange(); toast('Réglage enregistré'); } catch (e) { toast(e.message, 'err'); } };
  const rows = Object.values(st.muscles).filter((m) => !m.deep && m.recovery.level !== 'aucune').sort((a, b) => b.recovery.fatigue - a.recovery.fatigue);
  const r = d.data?.recovery;
  return (<>
    <Card title="Fatigue estimée par muscle" icon="bolt">
      {!rows.length ? <p className="muted">Aucune série ces 10 derniers jours : rien à récupérer.</p> : (
        <ul className="mus-list">{rows.map((m) => (
          <li key={m.id}><button onClick={() => onOpen(m.id)}>
            <i className="ms-dot" style={{ background: dot('rec', m.recovery.level) }} />
            <span className="grow"><b className="small">{m.name}</b><span className="muted xs block">{m.recovery.label}{m.recovery.ready_in_h > 0 ? ` · environ ${m.recovery.ready_in_h} h avant le seuil modéré` : ''}</span></span>
            <span className="rec-bar"><i style={{ width: `${Math.min(100, (m.recovery.fatigue / (st.thresholds.high * 1.5)) * 100)}%`, background: dot('rec', m.recovery.level) }} /></span>
          </button></li>))}</ul>)}
      <p className="muted xs mt-s">{st.method}</p>
    </Card>
    {r && <Card title="Forme générale" icon="heart" action={<Link className="link small" to="/progres?v=analyse">Analyse</Link>}>
      <p><b>{r.score}/100 · {r.label}</b></p>
      {r.factors?.length > 0 && <ul className="small tips-list">{r.factors.map((f, i) => <li key={i}>{f.text}</li>)}</ul>}
    </Card>}
    <Card title="Comment c’est calculé" icon="info">
      <ul className="small tips-list">
        <li>Chaque série validée compte selon la part estimée du muscle dans l’exercice (1 pour la cible principale, moins pour les muscles qui aident).</li>
        <li>L’intensité compte : une série à ton meilleur niveau sur l’exercice (1RM estimé) pèse plus lourd, une série légère pèse moins. Le RIR (répétitions en réserve) n’est pas noté dans tes séances ; l’effort ressenti de la séance est pris en compte si tu l’as noté.</li>
        <li>Les mouvements polyarticulaires (squat, développé, tirage…) pèsent 10 % de plus.</li>
        <li>La fatigue baisse avec le temps : environ deux tiers en 36 h pour les gros muscles, en 24 h pour les petits.</li>
        <li>Tes courbatures signalées et ton sommeil indiqué dans le profil sont pris en compte. Les douleurs sont suivies à part : une douleur n’est pas de la fatigue.</li>
        <li>Seuils : modérée à partir de {fr(st.thresholds.mid)} séries équivalentes restantes, élevée à partir de {st.thresholds.high}.</li>
      </ul>
      <p className="muted xs">L’appli ne connaît pas ton sommeil réel de la nuit, ton stress ou ton alimentation du jour : c’est une estimation, pas une mesure.</p>
    </Card>
    {cfg.data && <Card title="Régler le calcul" icon="edit">
      <p className="small">Vitesse de récupération</p>
      <Segmented value={cfg.data.settings.speed} onChange={(v) => set({ speed: v })} options={Object.entries(cfg.data.speeds).map(([k, [l]]) => [k, l])} />
      <p className="muted xs">« Lente » si tu récupères mal (âge, travail physique, peu de sommeil), « rapide » si tu enchaînes sans courbatures.</p>
      <label className="row gap-s mt-s small"><input type="checkbox" checked={cfg.data.settings.indirect} onChange={(e) => set({ indirect: e.target.checked })} />Compter le travail indirect (muscles qui aident)</label>
      <label className="row gap-s mt-s small"><input type="checkbox" checked={cfg.data.settings.cardio} onChange={(e) => set({ cardio: e.target.checked })} />Compter le cardio (marche inclinée, vélo…)</label>
    </Card>}
  </>);
}

// ---------- Articulations et douleurs : charge par articulation, douleurs suivies avec leur évolution ----------
const trendOf = (p) => { let log = []; try { log = JSON.parse(p.log || '[]'); } catch { /* ignoré */ } const first = log[0]?.intensity ?? p.intensity; return p.resolved ? 'resolue' : p.intensity < first ? 'amelioration' : 'active'; };
const STATUS = { active: ['Active', '#E5484D'], amelioration: ['En amélioration', '#F5A524'], resolue: ['Résolue', '#2BB56B'] };
export function JointsTab({ onPain }) {
  const brain = useApi('/muscles/state'); const pains = useApi('/pains'); const toast = useToast();
  const [sel, setSel] = useState(null); const [info, setInfo] = useState(null);
  const joints = Object.values(brain.data?.joints || {});
  const reports = pains.data?.reports || [];
  const resolve = async (p) => { try { await patch(`/pains/${p.id}`, { resolved: true }); toast('Douleur marquée comme résolue'); pains.reload(); brain.reload(); } catch (e) { toast(e.message, 'err'); } };
  return (<>
    <section className="card">
      <div className="card-head"><h2><Icon name="heal" size={16} />Mes douleurs</h2><button className="btn xs" onClick={() => onPain()}><Icon name="plus" size={14} />Signaler</button></div>
      {!reports.length ? <p className="muted small">Aucune douleur signalée. Si une zone te gêne, signale-la : les hausses de charge s’arrêtent sur les exercices concernés.</p> : (
        <ul className="pain-hist">{reports.slice(0, 12).map((p) => { const t = trendOf(p); let mv = []; try { mv = JSON.parse(p.movements || '[]'); } catch { /* ignoré */ } return (
          <li key={p.id}>
            <div className="row-between"><b className="small">{pains.data.areas[p.area] || p.area}{p.side && p.side !== 'deux' ? ` (${p.side})` : ''}</b><span className="ms-pill" style={{ '--c': STATUS[t][1] }}>{STATUS[t][0]}</span></div>
            <span className="muted xs">{p.intensity}/10 · depuis le {fmtDate(p.date, { day: 'numeric', month: 'short' })}{p.kind && pains.data.kinds?.[p.kind] ? ` · ${pains.data.kinds[p.kind].toLowerCase()}` : ''}{mv.length ? ` · ${mv.join(', ').toLowerCase()}` : ''}</span>
            {p.notes && <span className="xs block">{p.notes}</span>}
            {!p.resolved && <div className="row gap-s mt-s"><Link className="btn xs" to={`/soins?zone=${p.area}`}>Suivi et soins</Link><button className="btn xs ghost" onClick={() => resolve(p)}>Résolue</button></div>}
          </li>); })}</ul>)}
      <p className="muted xs mt-s">Conseils de prudence seulement, pas de diagnostic. Si la douleur dure plus de deux semaines ou s’aggrave, consulte un professionnel de santé.</p>
    </section>
    <section className="card">
      <div className="card-head"><h2><Icon name="target" size={16} />Charge par articulation</h2></div>
      {!brain.data ? <Loading /> : <ul className="mus-list">{joints.map((j) => (
        <li key={j.key}><button onClick={() => setSel(sel === j.key ? null : j.key)}>
          <i className="ms-dot" style={{ background: JOINT_COLORS[j.status] }} />
          <span className="grow"><b className="small">{j.label}</b><span className="muted xs block">{JOINT_LABEL[j.status]} · {j.load.week} séries cette semaine</span></span><Icon name={sel === j.key ? 'up' : 'down'} size={14} />
        </button>{sel === j.key && <JointPanel j={j} onOpen={setInfo} onChange={brain.reload} />}</li>))}</ul>}
    </section>
    <ExerciseInfo open={!!info} x={info} onClose={() => setInfo(null)} />
  </>);
}

// ---------- Progression par muscle : 8 semaines, 12 semaines, 6 mois (1RM estimé sur tes charges) ----------
export function ProgressTab({ st, onOpen }) {
  const [w, setW] = useState(8);
  const rows = Object.values(st.muscles).filter((m) => m.progression[w].verdict !== 'insuffisant').sort((a, b) => b.progression[w].change_pct - a.progression[w].change_pct);
  const none = Object.values(st.muscles).filter((m) => m.progression[w].verdict === 'insuffisant' && m.volume[12].direct > 0).length;
  return (<>
    <section className="card">
      <div className="card-head"><h2><Icon name="chart" size={16} />Force par muscle</h2><Link className="link small" to="/progres">Toutes les stats</Link></div>
      <Segmented value={w} onChange={setW} options={[[8, '8 semaines'], [12, '12 semaines'], [26, '6 mois']]} />
      {!rows.length ? <p className="muted mt-s">Pas encore assez de séances avec charge : il en faut au moins 3 sur un même exercice dans la période.</p> : (
        <ul className="mus-list">{rows.map((m) => { const p = m.progression[w]; return (
          <li key={m.id}><button onClick={() => onOpen(m.id)}>
            <i className="ms-dot" style={{ background: dot('prog', p.verdict) }} />
            <span className="grow"><b className="small">{m.name}</b><span className="muted xs block">{p.exercises.slice(0, 2).map((x) => x.name).join(', ')}</span></span>
            <b className={`small ${p.change_pct > 0 ? 'good' : p.change_pct < 0 ? 'warn' : ''}`}>{p.change_pct > 0 ? '+' : ''}{fr(p.change_pct)} %</b>
          </button></li>); })}</ul>)}
      {none > 0 && <p className="muted xs mt-s">{none} autres muscles travaillés n’ont pas encore assez de séances avec charge pour juger.</p>}
      <p className="muted xs">Variation du 1RM estimé entre tes 2 premières et tes 2 dernières séances de la période, sur les exercices qui ciblent le muscle en principal.</p>
    </section>
  </>);
}
