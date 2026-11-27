# Serveur Supabase

Le site est statique (GitHub Pages). Les comptes, les collections et tous les tirages
sont gérés par Supabase.

## Fichiers

- `schema.sql` : tables, règles de sécurité (RLS) et fonctions du jeu.
- `catalogue.sql` : les 180 cartes (régénérer si `data/origines.js` change).

Ordre d'installation : `schema.sql`, puis `catalogue.sql` (SQL Editor de Supabase).

## Sécurité

- Le navigateur ne peut rien écrire dans la base : toutes les tables sont en lecture
  seule, et chaque joueur ne lit que ses propres lignes.
- Toutes les actions (ouvrir un booster, acheter, roue, booster gratuit, quêtes,
  récompenses, pseudo) passent par des fonctions serveur qui vérifient le joueur,
  les délais et le solde. Les cartes sont tirées sur le serveur avec un hasard
  cryptographique.
- `config.js` ne contient que la clé publique (anon). Ne jamais y mettre la clé
  `service_role`.

## Réglages à faire dans le tableau de bord Supabase

Authentication › Sign In / Providers :
- Email : activé, « Confirm email » activé, longueur minimale du mot de passe : 8.
- Google et Discord : activés avec leur Client ID et Client Secret.

Authentication › URL Configuration :
- Site URL : `https://onwayy.github.io/clutch-tcg/`
- Redirect URLs : `https://onwayy.github.io/clutch-tcg/**`

## Créer les applis de connexion

Adresse de retour à donner à Google et Discord (« callback ») :
`https://<id-du-projet>.supabase.co/auth/v1/callback`

- Google : console.cloud.google.com › API et services › Identifiants ›
  Créer un ID client OAuth (application Web), avec l'adresse de retour ci-dessus.
- Discord : discord.com/developers/applications › New Application › OAuth2 ›
  Redirects : l'adresse de retour ci-dessus.

Copier ensuite le Client ID et le Client Secret dans Supabase.
