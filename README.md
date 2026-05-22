# ForaTrack

**ForaTrack** est une application web conçue pour numériser et simplifier le suivi géotechnique et géologique des forages réalisés en milieu souterrain (notamment pour le laboratoire de Bure).

Ce projet est développé dans le cadre d'un stage de fin d'études de Master 2 en Informatique (Spécialité Ingénierie des Logiciels) au sein de l'entreprise **GINGER CEBTP** pour le client **ANDRA**.

---

## Objectifs du Projet

L'objectif principal de ForaTrack est de remplacer l'ancienne méthode de travail (fiches papier et saisies multiples sur Excel/Word) par une solution numérique unique. L'application permet d'éviter la double saisie, de réduire le risque d'erreurs et d'accélérer la production des rapports finaux.

### Fonctionnalités Clés :
* **Saisie Terrain sur Tablette :** Permet aux ingénieurs terrain de renseigner directement toutes les mesures scientifiques (Oxydation, Diagraphie, EDZ).
* **Gestion des Médias :** Capture et centralisation des photos des carottes géologiques associées à chaque forage.
* **Workflow de Validation Strict :** 1. L'ingénieur terrain saisit les données.
  2. L'ingénieur bureau contrôle et applique des corrections partielles.
  3. L'administrateur valide définitivement le forage, ce qui rend le rapport disponible au téléchargement.
* **Génération de Livrables :** Création automatique de rapports professionnels et d'exports Excel/Word.

---

## Stack Technique

L'architecture de l'application est découpée de manière stricte pour assurer la performance et la sécurité des données :

* **Frontend (Interface) :** [React](https://react.dev/) / [Next.js](https://nextjs.org/) – Optimisé pour un affichage sur tablette et PC de bureau, avec une gestion d'état fluide via **Zustand**.
* **Backend (Serveur API) :** [Python](https://www.python.org/) / [FastAPI](https://fastapi.tiangolo.com/) – Une API REST rapide, robuste et documentée automatiquement.
* **Base de Données :** [PostgreSQL](https://www.postgresql.org/) – Choix de clés primaires en **UUID** (via l'extention 'pgcrypto') pour garantir l'unicité des identifiants et préparer les futures synchronisations.

---
## Structure du Projet
Le dépôt est organisé sous forme de Monorepo pour faciliter la gestion du code :

```text foratrack/
├── backend/       # Code source de l'API Python (FastAPI)
│   ├── app/       # Logique métier, modèles et routes
│   └── requirements.txt
├── frontend/      # Code source de l'interface (Next.js / React)
    │ ├── src/     # Composants et pages de l'application
│   └── package.json
└── database/      # Scripts de configuration PostgreSQL
    └── init.sql   # Schéma des tables (Forage, Utilisateur, etc.)```

## Installation et Démarrage
Prérequis

Python 3.10 ou supérieur
Node.js v18 ou supérieur
PostgreSQL 14 ou supérieur

1. Cloner le projet :

git clone [https://github.com/YassineInnovator/foratrack.git](https://github.com/YassineInnovator/foratrack.git)
cd foratrack

2. Configurer la Base de Données

Créez une base de données nommée foratrack sur votre instance PostgreSQL.
Exécutez le script database/init.sql pour créer les tables (Utilisateur, Chantier, Galeries, Forage, etc.).

3. Lancer le Backend (FastAPI)

cd backend
python -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

Le serveur backend sera accessible sur : http://localhost:8000

4. Lancer le Frontend (Next.js)

cd ../frontend
npm install
npm run dev

L'application web sera accessible sur : http://localhost:3000

## Sécurité et Bonnes Pratiques

Gestion des Identifiants : Utilisation systématique d'identifiants uniques universels (UUID) pour toutes les tables clés afin d'éviter les conflits.

Hachage des Mots de Passe : Protection des données utilisateurs grâce à des algorithmes de hachage sécurisés avant l'enregistrement en base de données.

Architecture RESTful : Utilisation des méthodes HTTP adaptées, notamment la méthode PATCH pour les modifications et validations partielles des données par l'ingénieur bureau et l'administrateur.

## Auteur

Yassine EL IDRISSI – Étudiant en Master 2 Ingénierie des Logiciels (Faculté des Sciences et Technologies de Nancy) – GitHub (YassineInnovator)
Sous la supervision professionnelle de Faustine GAUTHMANN (Tutrice de stage – GINGER CEBTP).
