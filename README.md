# Mirror API

Petit service Node.js qui agit comme une **API miroir** : il reçoit une requête, interroge une API distante, puis renvoie la réponse comme si elle venait de lui.

## Installation

```bash
npm install
```

## Configuration

Copiez `.env.example` vers `.env` puis définissez l'URL de l'API cible :

```env
PORT=3000
TARGET_API_BASE_URL=https://jsonplaceholder.typicode.com
MIRROR_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36
```

## Lancement

```bash
npm start
```

Ou en mode développement :

```bash
npm run dev
```

## Endpoints

- `GET /` : infos sur le service
- `GET /health` : vérification rapide
- `ALL /mirror/*` : relaie la requête vers l'API cible
- `GET /providers/1xbet/live-feed` : relaie le flux `1xbet`
- `GET /providers/888starz/live-feed` : relaie le flux `888starz`
- `GET /live-feed` : utilise `888starz` comme source principale fixe

## Logique de sélection

- `888starz` est la source principale fixe pour `/live-feed`
- La réponse contient l'en-tête `x-selected-provider` pour savoir quelle source a été utilisée

## Exemples

```bash
GET http://localhost:3000/live-feed
GET http://localhost:3000/providers/888starz/live-feed
GET http://localhost:3000/providers/1xbet/live-feed
```

Tu peux surcharger les paramètres par défaut :

```bash
GET http://localhost:3000/live-feed?count=10&lng=fr
```

## Remarques

- Le service ne stocke pas de `cookie` privé
- Certains fournisseurs peuvent bloquer, limiter ou interdire ce type de relais selon leurs conditions d'utilisation
