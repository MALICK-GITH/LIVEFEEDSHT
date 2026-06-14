# Mirror API

Petit service Node.js qui agit comme une **API miroir** : il reçoit une requête, interroge une API distante, puis renvoie la réponse comme si elle venait de lui.

## Configuration

Copiez `.env.example` vers `.env` :

```env
PORT=3000
TARGET_API_BASE_URL=https://jsonplaceholder.typicode.com
MIRROR_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36
```

## Endpoints

- `GET /` : infos générales
- `GET /health` : état du service
- `GET /live-feed` : flux principal `888starz`
- `GET /providers/888starz/live-feed` : flux direct `888starz`
- `GET /providers/1xbet/live-feed` : flux direct `1xbet`

## Transmission des données

- Le corps JSON de la source est retransmis tel quel
- Aucune clé du payload n'est supprimée ou renommée
