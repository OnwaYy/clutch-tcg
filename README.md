# Clutch TCG

Jeu de cartes à collectionner sur le thème de l'e-sport, sur navigateur : joueurs, équipes et moments marquants, tous jeux confondus.

## Contenu

- `index.html` + `js/app.js` : le site (accueil, boosters, collection, échanges, classement, profil), avec comptes (Google, Discord, e-mail) et ouverture de boosters.
- `config.js` : adresse et clé publique du serveur Supabase. Vide = mode démo dans le navigateur.
- `supabase/` : base de données et règles de sécurité (voir `supabase/README.md`).
- `tools/versionner.py` : à lancer avant chaque mise en ligne pour que les navigateurs rechargent les fichiers modifiés.
- `prototypes/carte-faker.html` : premier prototype de carte légendaire animée (stamp Origines, Édition 1, 150/150).

## Séries

- **Origines** (symbole ORI, tampon Édition 1) : les 175 joueurs, clubs, jeux et moments qui ont fait l'e-sport, de 1972 à aujourd'hui, tous jeux et tous pays. 150 cartes + 25 secrètes, numérotées jusqu'à 175/150.
  - Numérotées (001 à 150) : 50 communes, 41 peu communes, 47 épiques, 12 légendaires.
  - Secrètes (151 à 175) : 25 cartes secrètes, hors numérotation.
  - GOAT : les plus grands de l'histoire (Faker, ZywOo), sans numéro (marqués « GOAT »), en dehors des 175.
- **Séries d'événement** : sortent uniquement pendant les events.

Les visuels sont dans `assets/cartes/` (nommés d'après la carte). Ceux des cartes retirées d'Origines sont gardés dans `assets/cartes/retirees/`.

## Économie

- 3 boosters et 300 pièces offerts à l'inscription.
- Booster : 5 cartes, toutes tirées avec les mêmes chances (aucune garantie). Le score du booster (commune 1, peu commune 2, épique 10, légendaire 50, secrète 100, GOAT 500) rapporte autant de pièces.
- Booster gratuit toutes les heures, roue toutes les 24 h (0 à 4 boosters), 5 quêtes du jour.
- Récompenses une fois par compte pour chaque rareté complétée et pour la série complète.
- Prix : 200 pièces le booster, 900 le lot de 5.

## Lancer

Servir le dossier avec un petit serveur web (ex. `python3 -m http.server`), puis ouvrir `index.html`.
