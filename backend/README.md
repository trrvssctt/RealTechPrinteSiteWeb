# Backend Express API (Site Web RealTech)

Fichiers ajoutés:
- `package.json` — dépendances et scripts (`npm run dev`).
- `.env` — variables d'environnement (fournies par l'utilisateur). **Ne pas commit** dans un repo public.
- `src/app.js` — serveur Express principal.
- `src/config/db.js` — connexion PG via `pg` Pool.
- `src/models/*` — modèles simples pour `users`, `products`, `categories`.
- `src/controllers/*` — contrôleurs pour endpoints.
- `src/routes/*` — routes d'API.

Installation & démarrage

```bash
cd backend
npm install
npm run dev
```

API principaliess
- `GET /api/products` — liste produits actifs
- `GET /api/products/:id` — détail produit
- `GET /api/categories` — liste catégories
- `POST /api/users/register` — enregistrement utilisateur

Connexion avec le frontend
- Configurez `FRONTEND_ORIGIN` dans `backend/.env` (par défaut `http://localhost:5173`) pour autoriser les requêtes CORS du frontend Vite.
- Dans le frontend, consommez l'API en pointant vers `http://localhost:4000/api/...` (ou vers l'URL de production du backend).

Sécurité et notes
- Vous avez demandé que je place les identifiants fournis dans `.env`. Pour la production, utilisez un secret manager et ne partagez pas ces valeurs.
- L'authentification complète (JWT, sessions) n'est pas implémentée dans cet exemple; le contrôleur `me` est un placeholder.
# Backend PostgreSQL + Prisma setup

Ce dossier contient un point de départ pour le backend PostgreSQL compatible avec le schéma fourni (schema `app`).

Contenu important:
- `prisma/schema.prisma` : modèle Prisma (mappé sur les tables `app.*`).
- `sql/init_schema.sql` : script d'initialisation (crée schéma, tables, fonctions, triggers et tables d'historique).
- `docker-compose.yml` : service PostgreSQL pour développement local (monte `sql/` pour initialisation).
- `.env.example` : variables d'environnement exemple (NE PAS COMMIT les vrais secrets).
- `backup/backup.sh` : script de sauvegarde (pg_dump) et upload S3 optionnel.

Usage local rapide
1. Copier l'exemple d'env et l'adapter :

```bash
cp .env.example .env
# modifier .env selon votre environnement
```

2. Démarrer Postgres (dev)

```bash
docker-compose up -d
```

3. Vérifier que l'instance est prête et que le script `sql/init_schema.sql` a été exécuté (les fichiers dans `sql/` sont exécutés automatiquement lors de l'initialisation du container).

4. Installer Prisma (dans votre projet backend) et générer le client :

```bash
npm install prisma @prisma/client --save-dev
npx prisma generate --schema=backend/prisma/schema.prisma
```

Sécurité & production (rappels importants)
- Utiliser SCRAM-SHA-256 pour l'authentification côté Postgres et désactiver `trust` en production.
- Ne stockez jamais de secrets en clair dans le repo. Utiliser un Secrets Manager (Vault, AWS Secrets Manager, Doppler...).
- Activer TLS entre l'app et la base (SSL mode=require) et chiffrement au repos chez l'hébergeur.
- Pour données sensibles (cartes, CNIB), utiliser tokenisation ou chiffrement géré (KMS).
- Mettre en place sauvegardes régulières et WAL archiving pour PITR si nécessaire.

Sauvegarde
- Exécuter le script :

```bash
DATABASE_URL="postgresql://..." ./backup/backup.sh ./backups
```

Rotation / cron exemple (crontab):

```cron
# 03:00 daily dump
0 3 * * * /usr/bin/env DATABASE_URL="${DATABASE_URL}" /path/to/backend/backup/backup.sh /var/backups/db
```

Notes
- Le `init_schema.sql` crée des tables d'historique simples pour certaines tables importantes. Si vous préférez un outil comme `temporal` ou `pg_partman`/logical replication, adaptez.
- Le fichier `prisma/schema.prisma` mappe les tables existantes. Pour utiliser les migrations Prisma sur ce schéma, configurez `DATABASE_URL` avec `?schema=app` et testez les migrations sur une DB de staging.
