import { useEffect, useState } from 'react';
import { get, post } from '../lib/api.js';
import { Sheet, Loading, Icon, useToast, Confirm } from './ui.jsx';

// Modèles de programmes (Full body, Haut/Bas, PPL) et programmes enregistrés
export default function ProgramTemplates({ open, onClose, onDone }) {
  const [data, setData] = useState(null); const [ask, setAsk] = useState(null); const toast = useToast();
  useEffect(() => { if (open) get('/programs').then(setData).catch(() => setData({ templates: [], programs: [] })); }, [open]);
  const go = async () => {
    try {
      if (ask.key) await post('/programs/template', { key: ask.key }); else await post(`/programs/${ask.id}/activate`);
      toast(ask.key ? 'Programme créé : semaine type et calendrier mis à jour' : 'Programme réactivé'); setAsk(null); onDone();
    } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Programmes">
      {!data ? <Loading /> : (<>
        <h3 className="h-sub">Mes programmes</h3>
        <ul className="pick-list">
          {data.programs.map((p) => (
            <li key={p.id}><button disabled={!!p.active} onClick={() => setAsk({ id: p.id, label: p.name })}>
              <span className="grow"><b className="small">{p.name}</b><span className="muted small">{p.days} jour{p.days > 1 ? 's' : ''}{p.active ? ' · en cours' : ''}</span></span>
              {p.active ? <Icon name="check" size={16} /> : <span className="small">Activer</span>}
            </button></li>
          ))}
        </ul>
        <h3 className="h-sub mt">Partir d’un modèle</h3>
        <p className="muted small">Les charges sont à renseigner à ta première séance. Ton programme actuel est gardé : tu peux le réactiver ici quand tu veux.</p>
        <div className="tpl-list">
          {data.templates.map((t) => (
            <button key={t.key} className="tpl card" onClick={() => setAsk({ key: t.key, label: t.label })}>
              <div className="row-between"><b>{t.label}</b><span className="tag">{t.level}</span></div>
              <p className="small">{t.why}</p>
              <p className="muted small">{t.days.map((d) => d.name).join(' · ')}</p>
            </button>
          ))}
        </div>
      </>)}
      <Confirm open={!!ask} title={ask?.key ? `Passer au programme « ${ask?.label} » ?` : `Réactiver « ${ask?.label} » ?`}
        text="Ta semaine type et les séances à venir du calendrier seront replanifiées. Ton historique ne change pas." confirmLabel="Oui, changer" onConfirm={go} onClose={() => setAsk(null)} />
    </Sheet>
  );
}
