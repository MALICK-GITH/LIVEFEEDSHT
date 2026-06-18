# Mirror API

Petit service Node.js qui agit comme une **API miroir** en architecture `collector + Redis + API publique`.

## Configuration

Copiez `.env.example` vers `.env` :

```env
PORT=3000
TARGET_API_BASE_URL=https://jsonplaceholder.typicode.com
MIRROR_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36
REDIS_URL=redis://localhost:6379
COLLECTOR_INTERVAL_MS=10000
```

## Architecture

- **Collector** : interroge `888starz` toutes les `COLLECTOR_INTERVAL_MS`
- **Redis** : stocke la dernière réponse brute
- **API publique** : `/live-feed` lit Redis et renvoie les données très vite
- **Endpoint brut direct** : `/live-feed/raw` interroge directement la source

## Endpoints

- `GET /` : infos générales
- `GET /health` : état du service et de Redis
- `GET /live-feed` : lit la dernière réponse stockée dans Redis
- `GET /live-feed/raw` : interroge directement `888starz`
- `GET /providers/888starz/live-feed` : flux direct `888starz`
- `GET /providers/1xbet/live-feed` : flux direct `1xbet`
- `GET /docs/keys` : documentation JSON des clés

## Headers utiles

- `x-response-mode: raw-pass-through`
- `x-selected-provider: 888starz`
- `x-data-source: redis` sur `/live-feed`
- `x-last-update` : date ISO de la dernière mise à jour Redis

## Notes

- `/live-feed` est maintenant pensé pour la montée en charge
- la source n'est plus interrogée à chaque appel client
- si Redis n'est pas prêt ou vide, `/live-feed` renvoie une erreur explicite
