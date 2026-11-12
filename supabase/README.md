# Ligue GymTrack (Supabase)

Projet Supabase gratuit `gymtrack-ligue` (réf. `osrhhlqtstbxzecmfobm`, région ca-central-1).

- Les tables sont dans le schéma privé `ligue` (non exposé par l'API, RLS activée sans politique) : `leagues`, `members`, `stats`, `steps`.
- L'appli n'y accède que par des fonctions RPC `public.ligue_*` (SECURITY DEFINER, `search_path` vide) qui vérifient le jeton du membre (stocké haché en SHA-256) :
  - `ligue_create(p_name, p_pseudo)` / `ligue_join(p_code, p_pseudo)` → `{member_id, token, code, league, pseudo}`
  - `ligue_push(p_member, p_token, p_periods)` : totaux par période (`W2026-46`, `M2026-11`), bornés, champs inconnus ignorés
  - `ligue_board(p_member, p_token, p_periods)` : membres actifs + totaux + pas sur chaque période
  - `ligue_steps(...)`, `ligue_pas(p_key, p_steps)` (raccourci iPhone, clé `membre.jeton`, jour selon le fuseau du membre), `ligue_tz`, `ligue_stake`, `ligue_leave`
  - Lobby : `ligue_photo(p_member, p_token, p_photo)` (data URL JPEG/PNG/WebP ≤ 150 000 caractères, recadrée à 192 px côté appli)
  - Fil : `ligue_post(p_member, p_token, p_target, p_tone, p_body)` (ton `bravo` / `motive` / `chambre`, 200 caractères, 30 messages par heure), `ligue_feed(p_member, p_token, p_limit)`, `ligue_post_hide(p_member, p_token, p_post)` (l'auteur ou la personne visée masque le message)
  - Programme partagé (volontaire) : `ligue_share(p_member, p_token, p_data)` (null = arrêter), `ligue_shared(p_member, p_token, p_of)`
  - Messages privés : `ligue_dm_send(p_member, p_token, p_to, p_body, p_about)`, `ligue_dm_thread(p_member, p_token, p_with)` (marque lus), `ligue_dm_inbox(p_member, p_token)`, `ligue_dm_hide(p_member, p_token, p_with)`
- La clé `sb_publishable_…` dans `client/src/lib/league.js` est publique par nature : tous les droits sont dans les fonctions.

Seuls des totaux sont envoyés (km, minutes et nombre de séances cardio, séances muscu, séries, records, pas). Le détail des séances reste sur le téléphone.

Le projet gratuit est mis en pause après 7 jours sans aucune requête ; il se réactive depuis le tableau de bord Supabase.

## Défis et notifications
- Défis : `ligue_challenge_create`, `ligue_challenges(p_member, p_token, p_periods)`, `ligue_challenge_hide` (créateur seulement), table `ligue.challenges`.
- Notifications Web Push : `ligue_push_sub` / `ligue_push_off`, table `ligue.push_subs`. Des déclencheurs sur `ligue.dms`, `ligue.posts` (message visant quelqu'un) et `ligue.challenges` appellent `ligue.notify`, qui envoie via `pg_net` à la fonction `notify` (`supabase/functions/notify`).
- Les clés VAPID privées et le secret partagé ne sont pas dans ce dépôt : ils sont dans la fonction déployée et dans `ligue.config` (non exposée). Pour les changer : variables `VAPID_PUBLIC`, `VAPID_PRIVATE`, `NOTIFY_SECRET` de la fonction, la ligne `notify_secret` de `ligue.config` et la clé publique dans `client/src/lib/league.js`.
