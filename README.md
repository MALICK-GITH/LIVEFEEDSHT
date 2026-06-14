# Mirror API

Petit service Node.js qui agit comme une **API miroir** : il reçoit une requête, interroge une API distante, puis renvoie la réponse comme si elle venait de lui.

## Installation

```bash
npm install
```

## Configuration

Copiez `.env.example` vers `.env` puis définissez :

```env
PORT=3000
TARGET_API_BASE_URL=https://jsonplaceholder.typicode.com
MIRROR_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36
UPSTREAM_TIMEOUT_MS=15000
```

## Endpoints

- `GET /` : infos sur le service
- `GET /health` : état du service et présence du cache
- `GET /providers/888starz/live-feed` : flux direct `888starz`
- `GET /providers/1xbet/live-feed` : flux direct `1xbet`
- `GET /live-feed` : flux principal fixé sur `888starz`

## Transmission des données

- Le payload JSON de la source est retransmis tel quel
- Aucune clé du corps JSON n'est supprimée ni renommée
- Si la source renvoie un JSON valide avec `Success: true` et `Value`, ce JSON est renvoyé brut

## Fiabilité

- Le service vérifie que la réponse amont est bien un JSON exploitable
- En cas de blocage ou de réponse invalide, il renvoie le **dernier payload valide en cache** s'il existe
- `x-cache-status: live` signifie réponse fraîche
- `x-cache-status: stale` signifie réponse servie depuis le cache
- `x-cache-at` indique la date ISO du dernier cache servi

## Limite importante

- Je peux améliorer la robustesse du proxy
- Je ne peux pas garantir `100%` si la source amont bloque, change ou coupe complètement l'accès
- Le cache permet surtout d'éviter une panne visible immédiate sur ton endpoint
