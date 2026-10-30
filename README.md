# TODO Docker - TOODY

<p align="center">
  <img src="frontend-js/public/mascot.gif" alt="Mascotte du projet" width="124">
</p>

Application de gestion de tâches : une API Spring Boot, une base PostgreSQL et un frontend Vite, le tout conteneurisé avec Docker Compose.

## Sommaire

- [Stack](#stack)
- [Structure du projet](#structure-du-projet)
- [Prérequis](#prérequis)
- [Configuration](#configuration)
- [Lancer avec Docker](#lancer-avec-docker)
- [Choisir le frontend](#choisir-le-frontend)
- [Tests](#tests)
- [API](#api)
- [Déploiement](#déploiement)
- [Liens](#liens)
- [Auteur](#auteur)

## Stack

| Partie | Technologies |
|---|---|
| Backend | Java 25, Spring Boot 4.1, Spring Security (JWT), Spring Data JPA, Flyway |
| Base de données | PostgreSQL 16 |
| Frontend | Vite, JavaScript (`frontend-js`) ou TypeScript (`frontend-ts`) |
| Conteneurs | Docker, Docker Compose, nginx (frontend) |

## Structure du projet

```
.
├── backend/            API Spring Boot (Dockerfile, migrations Flyway, tests)
├── frontend-js/        Frontend JavaScript (Dockerfile, tests)
├── frontend-ts/        Frontend TypeScript (Dockerfile)
├── docker-compose.yml  Orchestration db + backend + frontend
├── .env.example        Modèle des variables d'environnement
└── run-backend.sh      Lance la base puis le backend en local (hors Docker)
```

## Prérequis

- Docker et Docker Compose
- (optionnel, hors Docker) JDK 25 et Node.js 22

## Configuration

Copie le modèle puis renseigne les valeurs :

```bash
cp .env.example .env
```

| Variable | Rôle |
|---|---|
| `POSTGRES_DB` | Nom de la base |
| `POSTGRES_USER` | Utilisateur de la base |
| `POSTGRES_PASSWORD` | Mot de passe de la base |
| `JWT_SECRET` | Secret de signature des jetons, 32 caractères minimum |

Pour générer un secret :

```bash
openssl rand -base64 64
```

Le fichier `.env` ne doit jamais être commité. Si `JWT_SECRET` est vide, `run-backend.sh` en génère un et l'ajoute à `.env`.

## Lancer avec Docker

```bash
docker compose up --build
```

| Service | Adresse |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8080 |
| PostgreSQL | localhost:5432 |

Le backend attend que la base soit prête avant de démarrer (healthcheck), puis Flyway applique les migrations automatiquement.

Pour tout arrêter :

```bash
docker compose down
```

Pour supprimer aussi les données de la base :

```bash
docker compose down -v
```

Les trois services partagent le réseau `todo-network`. Les données PostgreSQL sont conservées dans le volume `todo-data`.

## Choisir le frontend

Le service `frontend` construit `./frontend-js` par défaut. Pour passer sur la version TypeScript, modifie la ligne `build` dans [docker-compose.yml](docker-compose.yml) :

```yaml
frontend:
  build: ./frontend-ts
```

## Tests

Les tests sont exécutés dans des conteneurs dédiés, rattachés au profil `test`. Ils ne démarrent pas avec un `docker compose up` classique.

```bash
docker compose --profile test run --rm backend-tests
docker compose --profile test run --rm frontend-tests
```

Hors Docker :

```bash
cd backend && ./mvnw test '-Dtest=!BackendApplicationTests'
cd frontend-js && npm test
```

`BackendApplicationTests` charge toute l'application et nécessite une base PostgreSQL : il est donc exclu des commandes ci-dessus.

## API

Toutes les routes, sauf `/auth/*`, demandent l'en-tête `Authorization: Bearer <token>`.

| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/register` | Créer un compte |
| POST | `/auth/login` | Se connecter, renvoie le jeton |
| GET | `/users/me` | Profil de l'utilisateur connecté |
| PUT | `/users/me` | Modifier le profil |
| PUT | `/users/me/password` | Changer le mot de passe |
| DELETE | `/users/me` | Supprimer le compte |
| GET | `/tasks` | Lister ses tâches |
| GET | `/tasks/{id}` | Détail d'une tâche |
| POST | `/tasks` | Créer une tâche |
| PUT | `/tasks/{id}` | Modifier une tâche |
| PUT | `/tasks/{id}/reminder` | Activer ou désactiver le rappel |
| DELETE | `/tasks/{id}` | Supprimer une tâche |
| GET | `/search/tasks` | Rechercher (texte, dates, lieu, niveaux, état) |
| GET | `/search/tasks/todo` | Tâches à faire |
| GET | `/search/tasks/done` | Tâches réalisées |
| GET | `/search/tasks/reminders` | Rappels d'un jour donné |
| GET | `/search/places` | Lieux déjà utilisés |
| GET | `/stats/activity` | Activité jour par jour entre deux dates |

## Déploiement

Vercel n'héberge pas de conteneur Docker ni de base de données : le projet se déploie en trois parties.

| Partie | Hébergeur | Réglages |
|---|---|---|
| Frontend | Vercel | Root Directory `frontend-js` (ou `frontend-ts`), variable `VITE_API_URL` |
| Backend | Render (Docker) | Root Directory `backend`, variables ci-dessous |
| Base de données | PostgreSQL managé (Render, Neon…) | Identifiants à reporter dans le backend |

Variables d'environnement du backend :

| Variable | Valeur |
|---|---|
| `DB_HOST` | Hôte de la base (adresse interne sur Render) |
| `DB_PORT` | `5432` |
| `DB_NAME` | Nom de la base |
| `DB_USER` | Utilisateur de la base |
| `DB_PASSWORD` | Mot de passe de la base |
| `JWT_SECRET` | Secret de signature des jetons |
| `CORS_ALLOWED_ORIGINS` | URL du frontend, séparées par des virgules, sans `/` final |
| `PORT` | `8080` |

Le frontend lit `VITE_API_URL` au moment du build : après modification, il faut le redéployer. L'URL du backend doit être en HTTPS.

Sur le plan gratuit de Render, le backend s'endort après 15 minutes d'inactivité et met environ une minute à se réveiller.

## Liens

- Dépôt GitHub : https://github.com/Koruji/TODO_docker_YNOV
- Application déployée (Vercel) : https://todo-docker-ynov-rnuor9aag-korujis-projects.vercel.app

## Auteur

COTTIN Jade
