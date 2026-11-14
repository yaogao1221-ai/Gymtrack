// Équilibre musculaire : force (1RM estimé) et volume entre muscles opposés. Tout est calculé côté serveur (coach/balance.js).
import { Icon } from './ui.jsx';

const nf = (v, d = 0) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d });
export const VERDICT = { ok: ['Équilibré', 'good'], low: ['Écart', 'warn'], high: ['Écart', 'warn'], unknown: ['Pas de données', ''] };

// Jauge : zone de repère ombrée, repère du rapport actuel
export function RatioBar({ ratio, target }) {
  const max = Math.max(target[1] * 1.6, (ratio || 0) * 1.1, 2);
  const pos = (v) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  return (
    <div className="bal-bar" aria-hidden="true">
      <span className="bal-zone" style={{ left: pos(target[0]), width: `calc(${pos(target[1])} - ${pos(target[0])})` }} />
      <span className="bal-one" style={{ left: pos(1) }} />
      {ratio != null && <span className="bal-dot" style={{ left: pos(ratio) }} />}
    </div>
  );
}

export function BalanceRow({ x, compact }) {
  const [txt, tone] = VERDICT[x.verdict] || VERDICT.unknown;
  return (
    <li className={`bal-row v-${x.verdict}`}>
      <div className="row-between"><b>{x.label}</b><span className={`tag ${tone}`}>{txt}{x.ratio != null && x.verdict !== 'unknown' ? ` · ${nf(x.ratio * 100)} %` : ''}</span></div>
      {x.verdict !== 'unknown' && <RatioBar ratio={x.ratio} target={x.target} />}
      <p className="small">{x.text}</p>
      {!compact && x.sides && <div className="bal-sides xs muted">
        <span><Icon name="dumbbell" size={12} />{x.sides.a.exercise} : {x.sides.a.best} → 1RM ≈ {nf(x.sides.a.e1rm_lbs)} lbs</span>
        <span><Icon name="dumbbell" size={12} />{x.sides.b.exercise} : {x.sides.b.best} → 1RM ≈ {nf(x.sides.b.e1rm_lbs)} lbs</span>
        {!x.same_equipment && <span className="warn-text">Matériel différent des deux côtés : comparaison approximative.</span>}
      </div>}
    </li>
  );
}

export default function BalanceCard({ data }) {
  if (!data) return null;
  return (
    <section className="card bal-card">
      <div className="card-head"><h2><Icon name="scale" size={18} />Équilibre musculaire</h2>{data.issues > 0 ? <span className="tag warn">{data.issues} écart{data.issues > 1 ? 's' : ''}</span> : <span className="tag good">Équilibré</span>}</div>
      <h3 className="h-sub">Force entre muscles opposés</h3>
      <p className="muted xs">Ton meilleur 1RM estimé des {data.weeks} dernières semaines, dans la même famille de mouvement de chaque côté.</p>
      <ul className="bal-list">{data.strength.map((x) => <BalanceRow key={x.id} x={x} />)}</ul>
      <h3 className="h-sub">Volume (séries par semaine, 4 semaines)</h3>
      <ul className="bal-list">{data.volume.map((x) => <BalanceRow key={x.label} x={x} compact />)}</ul>
      <p className="muted xs mt-s">{data.note}</p>
    </section>
  );
}
