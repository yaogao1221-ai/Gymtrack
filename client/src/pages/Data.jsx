import { useRef, useState } from 'react';
import { useApi, Page, Card, Icon, Confirm, useToast } from '../components/ui.jsx';
import { post, downloadUrl } from '../lib/api.js';

export default function Data() {
  const backups = useApi('/data/backups'); const toast = useToast();
  const file = useRef(); const [pending, setPending] = useState(null);
  const onFile = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const json = JSON.parse(await f.text()); if (json.app !== 'gymtrack-ai') throw new Error(); setPending({ name: f.name, json }); }
    catch { toast('Fichier non reconnu : choisis un export GymTrack AI (.json)', 'err'); }
  };
  const restore = async () => {
    try { const r = await post('/data/import', pending.json); toast(`Données restaurées (sauvegarde préalable : ${r.backup_before_import})`); setTimeout(() => window.location.assign('/'), 800); }
    catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Page title="Données & sauvegarde" subtitle="Tes données t’appartiennent : exporte-les quand tu veux">
      <Card title="Exporter" icon="download">
        <p className="muted small">Export complet (programme, séances, séries, cardio, objectifs, profil…) réimportable, ou tableurs CSV (Excel, Numbers).</p>
        <div className="row gap-s wrap">
          <a className="btn primary sm" href={downloadUrl('/data/export')} download><Icon name="download" size={14} />Export complet (.json)</a>
          <a className="btn sm" href={downloadUrl('/data/export.csv?type=sets')} download>Séries (.csv)</a>
          <a className="btn sm" href={downloadUrl('/data/export.csv?type=workouts')} download>Séances (.csv)</a>
          <a className="btn sm" href={downloadUrl('/data/export.csv?type=cardio')} download>Cardio (.csv)</a>
        </div>
      </Card>
      <Card title="Restaurer" icon="upload">
        <p className="muted small">Remplace toutes les données actuelles par celles d’un export .json. Une sauvegarde automatique est faite juste avant.</p>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
        <button className="btn sm" onClick={() => file.current.click()}><Icon name="upload" size={14} />Choisir un fichier d’export</button>
      </Card>
      <Card title="Sauvegardes automatiques du serveur" icon="database" action={<button className="btn xs" onClick={async () => { try { await post('/data/backups'); backups.reload(); toast('Sauvegarde créée'); } catch (e) { toast(e.message, 'err'); } }}>Sauvegarder maintenant</button>}>
        <p className="muted small">Une copie de la base est faite à chaque démarrage puis toutes les 24 h (les 14 dernières sont gardées).</p>
        <ul className="backup-list">{(backups.data || []).map((b) => (
          <li key={b.file}><span className="small">{b.file.replace('gymtrack-', '').replace('.sqlite', '').replace(/T(\d\d)-(\d\d)-(\d\d)-\d+Z/, ' $1:$2:$3 UTC')}</span><span className="muted small">{Math.round(b.size / 1024)} Ko</span>
            <a className="btn xs ghost" href={downloadUrl(`/data/backups/${b.file}`)} download><Icon name="download" size={12} /></a></li>
        ))}</ul>
      </Card>
      <Confirm open={!!pending} onClose={() => setPending(null)} danger title="Restaurer cet export ?" confirmLabel="Restaurer"
        text={`Les données actuelles seront remplacées par « ${pending?.name} ». Une sauvegarde est faite avant.`} onConfirm={restore} />
    </Page>
  );
}
