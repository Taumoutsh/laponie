# Laponie

Budget cadeaux partagé pour les événements en famille (Noël, anniversaires…).
Application web utilisable sur téléphone et ordinateur, installable comme une application (PWA).

## Fonctionnalités

- **Carnet** commun à tous les événements : personnes, familles, couples (répartition des dépenses réglable, 50/50 par défaut, compte commun ou séparé).
- **Événements** : ajout des participants un par un ou par famille entière, plafond « reçu » et plafond « dépense » (optionnel) par personne, reprise des participants d'un événement précédent.
- **Vue par famille** (complètes ou incomplètes) : pour chaque personne, ce qu'elle reçoit, ce qu'elle dépense, et l'avancement global de ses cadeaux (barre colorée au prorata des statuts).
- **Cadeaux** : un ou plusieurs destinataires (parts égales), lien, prix, statut *Idée → Trouvé → Acheté → Reçu → Emballé* (l'étape *Reçu* est sautée pour un achat sur place), date de livraison, participations de personnes ou de couples, historique.
- **Détection des doublons** à la saisie : cadeaux proches déjà prévus pour le même destinataire (et rappel de ceux offerts lors des événements précédents).
- **Avances** : qui a payé un cadeau pour les autres ; les participants lui doivent leur part.
- **Balances** : solde de chaque compte, remboursements à faire (simplifiés pour minimiser les virements), origine des dettes cadeau par cadeau, enregistrement des remboursements (total ou partiel).
- **Finances** : totaux, qui a payé quoi, dépensé/reçu par personne, matrice « qui offre à qui » (personnes, couples, familles), liste de toutes les participations.
- **Export Excel** : personnes en colonnes, cadeaux en lignes, regroupés par personne, couple ou famille, avec sous-totaux, plus des onglets de synthèse et de balances.

## Déploiement (Docker + Nginx Proxy Manager)

1. Copier la configuration et la remplir :

   ```bash
   cp .env.example .env
   # APP_PASSWORD, SESSION_SECRET (openssl rand -hex 32), POSTGRES_PASSWORD, NPM_NETWORK
   ```

   `NPM_NETWORK` est le nom du réseau Docker de Nginx Proxy Manager (`docker network ls`).
   Le mot de passe PostgreSQL doit contenir uniquement des lettres et des chiffres.

2. Construire et lancer :

   ```bash
   docker compose up -d --build
   ```

   Les migrations de la base sont appliquées automatiquement au démarrage du conteneur.

3. Dans Nginx Proxy Manager, créer un *Proxy Host* :
   - Forward Hostname / IP : `laponie`
   - Forward Port : `3000`
   - Activer le certificat SSL (Let's Encrypt) et « Force SSL ».

   Le conteneur n'expose aucun port sur l'hôte : il n'est joignable que via le réseau de NPM.
   La base PostgreSQL reste sur un réseau interne.

4. (Optionnel) Charger des données de démonstration dans une base vide :

   ```bash
   docker compose exec app npm run db:seed
   ```

### Base d'essai (vérifier tous les affichages)

`prisma/test-data.sql` **efface toutes les données** puis charge un jeu d'essai complet :

```bash
docker compose exec -T db psql -U laponie -d laponie -v ON_ERROR_STOP=1 < prisma/test-data.sql
```

Il contient 14 personnes, 4 familles, 3 couples (50/50, 60/40, comptes séparés) et 4 événements :

| Où regarder | Cas couverts |
| --- | --- |
| **Noël 2026** – vue par famille | famille incomplète (Bernard, Noé absent), plafond reçu dépassé (Léa), proche du plafond (Hugo, Jeanne), plafond de dépense dépassé (Sophie, Camille), personne sans plafond de dépense, « Sans famille » |
| Cadeaux | les 5 statuts, sur place / à distance, livraisons à venir et passées, 2 et 3 destinataires, cadeau sans participation, prix à 0 €, sous-financé (Vélo), sur-financé (Jeu de société → « réduire au prorata »), lien et note |
| Fiche cadeau | Console Switch 2 (avance + remboursement + historique), Vélo d'appartement (deux payeurs, avance non couverte), Lego Technic (couple en comptes séparés) |
| Nouveau cadeau | taper « console switch » pour Hugo (doublons), « Mario Kart » pour Hugo ou « livre de cuisine » pour Jeanne (déjà offert en 2025) |
| Balances | remboursements total et partiels, simplification, interrupteur « compte commun » |
| Familles & couples | suggestion de couple (Luc & Emma Petit) |
| **Noël 2025** | événement archivé |
| **Les 90 ans de Jeanne** | participants sans aucun cadeau (états vides) |
| **Anniversaire de Léa** | événement sans participant |

`npm run db:seed` charge plutôt une petite démo, uniquement si la base est vide.

### Sauvegarde

```bash
docker compose exec db pg_dump -U laponie laponie > laponie-$(date +%F).sql
```

## Développement local

```bash
npm install
cp .env.example .env   # puis décommenter DATABASE_URL pour un PostgreSQL local
npx prisma migrate deploy
npm run dev
```

- `npm test` : tests de la logique métier (budgets, avancement, balances, doublons).
- `npm run typecheck` : vérification TypeScript.

Pensez à committer le `package-lock.json` généré par le premier `npm install` : le Dockerfile utilisera alors `npm ci`.

## Architecture

- Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript strict, Tailwind CSS.
- PostgreSQL via Prisma (`prisma/schema.prisma`) ; montants stockés en centimes.
- Logique métier pure et testée dans `src/lib/domain/` :
  - `status.ts` : statuts et pourcentages (à distance : 0/25/50/75/100 ; sur place : 0/33/67/100),
  - `budget.ts` : reçu (parts égales), dépensé (seul + part du couple), plafonds, groupes de familles,
  - `balances.ts` : avances, dettes, remboursements, simplification,
  - `finance.ts` : payeurs et matrice « qui offre à qui »,
  - `duplicates.ts` : similarité des noms de cadeaux.
- Accès protégé par un mot de passe unique (`APP_PASSWORD`), cookie de session signé (`SESSION_SECRET`).
