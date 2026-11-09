# GymTrack AI

Application personnelle de suivi musculation et cardio, installable sur iPhone (PWA), avec API Node.js et base SQLite.

## Fonctionnalités

- **Tableau de bord** : prochaine séance, dernière séance, séances de la semaine, temps de muscu et de cardio, calendrier sur 2 semaines, progression des charges, records, objectifs, score de récupération.
- **Programme** : les 5 jours saisis tels quels. Tout reste modifiable (exercices, séries, répétitions, charges, fourchettes, repos, supersets, ordre, ajout ou suppression de jours, exercices personnalisés).
- **Mode séance** : exercices dans l'ordre, dernière charge utilisée pré-remplie, charges et répétitions modifiables, validation série par série, chrono de repos (son et vibration, ±15 s), passage automatique à l'exercice suivant, supersets gérés par tours, écran maintenu allumé, reprise après fermeture de l'app, enregistrement même hors ligne (synchronisé plus tard).
- **Cardio** : marche, marche inclinée, course, vélo, elliptique, rameur, activités personnalisées. Durée, distance, vitesse, inclinaison, calories estimées (formules ACSM / MET selon ton poids), fréquence cardiaque, intensité ressentie. Plan progressif sur 6 semaines selon ton objectif, ton niveau et ta récupération, ajoutable au calendrier.
- **Coach IA** (moteur de règles de coaching, aucune donnée envoyée à l'extérieur) : volume hebdomadaire par groupe musculaire, groupes oubliés, redondances, déséquilibres poussée/tirage et quadriceps/ischios, répartition et récupération de 48 h, durée des séances, douleurs signalées, propositions de progression (double progression) et d'exercices complémentaires. **Rien n'est modifié sans ta validation.**
- **Progrès** : charges et répétitions par exercice (avec 1RM estimé), séances par semaine, volume, minutes de cardio, progression mensuelle, comparaison de deux périodes, historique complet.
- **Calendrier** : planification automatique des 5 séances selon ton planning type, déplacement (glisser-déposer sur ordinateur, sélecteur de date sur iPhone), repos, cardio, séances sautées, passées et à venir.
- **Profil** : objectifs, niveau, disponibilités, préférences, historique sportif, suivi corporel facultatif, objectifs cardio, configuration initiale guidée.
- **Données** : export JSON complet (réimportable), export CSV (séries, séances, cardio), restauration, sauvegardes automatiques quotidiennes du fichier SQLite (14 conservées).

## Architecture

| Couche | Choix |
| --- | --- |
| Frontend | React 18 + Vite, React Router, Chart.js, CSS sur mesure (thème sombre), PWA (manifest + service worker) |
| Backend | Node.js ≥ 22.13 + Express 5, API REST sous `/api` |
| Base de données | SQLite via le module natif `node:sqlite` (un seul fichier, aucune compilation) |
| Sécurité | Mot de passe facultatif (`APP_PASSWORD`), jeton Bearer, limitation des tentatives |

```
server/
  app.js          application Express (auth, routes, erreurs, fichiers statiques)
  db.js           schéma SQL, vue statistiques, sauvegardes
  seed.js         bibliothèque d'exercices + programme initial
  services.js     programme, statistiques, calories, objectifs
  analysis.js     coach : volume, redondances, récupération, progression, plan cardio
  routes/         program, workouts, cardio, calendar, profile (+objectifs, douleurs, mesures), stats, analysis, data
client/src/
  pages/          Dashboard, Program, Workout, Cardio, Calendar, Progress, Coach, Goals, Profile, Data, Onboarding…
  components/     UI, graphiques, formulaires de profil
  lib/            client API (file d'attente hors ligne), formats
test/api.test.js  tests de l'API (node:test)
```

Tables : `users`, `profiles`, `exercises`, `programs`, `program_days`, `program_exercises`, `workouts` (séances), `workout_sets` (séries : charges + répétitions), `cardio_sessions`, `goals`, `calendar_events`, `body_metrics`, `pain_reports`, `recommendation_log` (historique des recommandations validées / ignorées), et la vue `v_set_volume` pour les statistiques.

## Lancer en local

```bash
npm install
npm run build
npm start            # http://localhost:3001
npm test             # tests de l'API
npm run dev          # développement (API + Vite avec rechargement)
```

Variables d'environnement : `PORT` (3001), `DATA_DIR` (`./data`, contient la base et les sauvegardes), `APP_PASSWORD` (recommandé dès que l'app est en ligne).

## Mettre en ligne

L'app a besoin d'un serveur Node.js **avec un disque persistant** (sinon la base est effacée à chaque redémarrage). Un `Dockerfile` est fourni.

**Railway (le plus simple, environ 5 $/mois)**
1. Mets ce dossier dans un dépôt GitHub.
2. Sur railway.app : *New Project → Deploy from GitHub repo* (il détecte le Dockerfile).
3. *Settings → Volumes* : ajoute un volume monté sur `/data`.
4. *Variables* : `APP_PASSWORD` = ton mot de passe.
5. *Settings → Networking → Generate Domain* : tu obtiens une adresse `https://…up.railway.app`.

**Render** : le fichier `render.yaml` est prêt (plan Starter avec disque de 1 Go monté sur `/data`). *New → Blueprint*, choisis le dépôt, renseigne `APP_PASSWORD`.

**Fly.io** : `fly launch` (Dockerfile détecté), puis `fly volumes create data --size 1` et monte-le sur `/data` dans `fly.toml`, et `fly secrets set APP_PASSWORD=…`.

## Installer sur iPhone

1. Ouvre l'adresse HTTPS de ton app dans **Safari**.
2. Touche le bouton **Partager** puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. Lance GymTrack depuis l'icône : plein écran, sans barre Safari. Les écrans déjà visités restent consultables hors ligne, et une séance enregistrée sans réseau est synchronisée automatiquement au retour de la connexion.
