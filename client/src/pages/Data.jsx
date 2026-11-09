import { useRef, useState } from 'react';
import { useApi, Page, Card, Icon, Confirm, useToast } from '../components/ui.jsx';
import { post, downloadFile, today, STANDALONE } from '../lib/api.js';
import { useEffect } from 'react';

export default function Data() {
  const backups = useApi(STANDALONE ? null : '/data/backups'); const toast = useToast();
  const [sync, setSync] = useState(null);
  useEffect(() => {
    if (!STANDALONE) return undefined;
    import('../local/server.js').then((m) => setSync({ ...m.sync }));
    const f = (e) => setSync(e.detail); window.addEventListener('gt-sync', f); return () => window.removeEventListener('gt-sync', f);
  }, []);
  const dl = async (path, name) => { try { await downloadFile(path, name); } catch (e) { toast(e.message, 'err'); } };
  const file = useRef(); const [pending, setPending] = useState(null);
  const onFile = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const json = JSON.parse(await f.text()); if (json.app !== 'gymtrack-ai') throw new Error(); setPending({ name: f.name, json }); }
    catch { toast('Fichier non reconnu : choisis un export GymTrack (.json)', 'err'); }
  };
  const restore = async () => {
    try { const r = await post('/data/import', pending.json); toast(`Données restaurées (sauvegarde préalable : ${r.backup_before_import})`); setTimeout(() => (STANDALONE ? window.dispatchEvent(new Event('gt-data-replaced')) : window.location.assign('/')), 800); }
    catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Page title="Données & sauvegarde" subtitle="Tes données t’appartiennent : exporte-les quand tu veux">
      <Card title="Exporter" icon="download">
        <p className="muted small">Export complet (programme, séances, séries, cardio, objectifs, profil…) réimportable, ou tableurs CSV (Excel, Numbers).</p>
        <div className="row gap-s wrap">
          <button className="btn primary sm" onClick={() => dl('/data/export', `gymtrack-export-${today()}.json`)}><Icon name="download" size={14} />Export complet (.json)</button>
          <button className="btn sm" onClick={() => dl('/data/export.csv?type=sets', `gymtrack-sets-${today()}.csv`)}>Séries (.csv)</button>
          <button className="btn sm" onClick={() => dl('/data/export.csv?type=workouts', `gymtrack-workouts-${today()}.csv`)}>Séances (.csv)</button>
          <button className="btn sm" onClick={() => dl('/data/export.csv?type=cardio', `gymtrack-cardio-${today()}.csv`)}>Cardio (.csv)</button>
        </div>
      </Card>
      <Card title="Restaurer" icon="upload">
        <p className="muted small">Remplace toutes les données actuelles par celles d’un export .json. Une sauvegarde automatique est faite juste avant.</p>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
        <button className="btn sm" onClick={() => file.current.click()}><Icon name="upload" size={14} />Choisir un fichier d’export</button>
      </Card>
      {STANDALONE && <Card title="Sauvegarde automatique" icon="database">
        {!sync ? <p className="muted small">Vérification…</p> : sync.mode === 'cloud'
          ? <p className="small">Tes données sont enregistrées sur cet appareil et sauvegardées automatiquement dans ton compte Claude (privé), quelques secondes après chaque modification. {sync.lastSync ? `Dernière sauvegarde : ${new Date(sync.lastSync).toLocaleString('fr-FR')}.` : ''}</p>
          : <p className="small warn-text">Sauvegarde en ligne indisponible dans cette vue : tes données sont seulement sur cet appareil. Fais un export régulier.</p>}
        {sync?.error && <p className="small warn-text">{sync.error}</p>}
      </Card>}
      {!STANDALONE && <Card title="Sauvegardes automatiques du serveur" icon="database" action={<button className="btn xs" onClick={async () => { try { await post('/data/backups'); backups.reload(); toast('Sauvegarde créée'); } catch (e) { toast(e.message, 'err'); } }}>Sauvegarder maintenant</button>}>
        <p className="muted small">Une copie de la base est faite à chaque démarrage puis toutes les 24 h (les 14 dernières sont gardées).</p>
        <ul className="backup-list">{(backups.data || []).map((b) => (
          <li key={b.file}><span className="small">{b.file.replace('gymtrack-', '').replace('.sqlite', '').replace(/T(\d\d)-(\d\d)-(\d\d)-\d+Z/, ' $1:$2:$3 UTC')}</span><span className="muted small">{Math.round(b.size / 1024)} Ko</span>
            <button className="btn xs ghost" aria-label="Télécharger" onClick={() => dl(`/data/backups/${b.file}`, b.file)}><Icon name="download" size={12} /></button></li>
        ))}</ul>
      </Card>}
      <Confirm open={!!pending} onClose={() => setPending(null)} danger title="Restaurer cet export ?" confirmLabel="Restaurer"
        text={`Les données actuelles seront remplacées par « ${pending?.name} ». Une sauvegarde est faite avant.`} onConfirm={restore} />
    </Page>
  );
}
