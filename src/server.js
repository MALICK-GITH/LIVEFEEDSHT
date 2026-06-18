require("dotenv").config();
const express = require("express");
const { createClient } = require("redis");

const app = express();
const port = process.env.PORT || 3000;
const targetBaseUrl = process.env.TARGET_API_BASE_URL;
const redisUrl = process.env.REDIS_URL;
const collectorIntervalMs = Number(process.env.COLLECTOR_INTERVAL_MS || 10000);
const defaultUserAgent =
  process.env.MIRROR_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const upstreamPresets = {
  "1xbet": {
    baseUrl: "https://1xbet.com",
    path: "/service-api/LiveFeed/Get1x2_VZip",
    defaultQuery: {
      sports: "85",
      count: "40",
      lng: "fr",
      gr: "285",
      mode: "4",
      country: "96",
      getEmpty: "true",
      virtualSports: "true",
      noFilterBlockEvent: "true"
    },
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      "cache-control": "max-age=0",
      "upgrade-insecure-requests": "1",
      "user-agent": defaultUserAgent
    }
  },
  "888starz": {
    baseUrl: "https://888starz.bet",
    path: "/service-api/LiveFeed/Get1x2_VZip",
    defaultQuery: {
      sports: "85",
      count: "40",
      lng: "fr",
      gr: "789",
      mode: "4",
      country: "96",
      partner: "233",
      getEmpty: "true",
      virtualSports: "true",
      noFilterBlockEvent: "true"
    },
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      "cache-control": "max-age=0",
      "upgrade-insecure-requests": "1",
      "user-agent": defaultUserAgent
    }
  }
};

const keyDocumentation = {
  root: {
    Id: "Identifiant global de la réponse",
    Success: "Indique si la requête a réussi",
    Error: "Message d'erreur texte",
    ErrorCode: "Code d'erreur numérique",
    Guid: "Identifiant technique éventuel",
    Value: "Tableau des événements renvoyés"
  },
  event: {
    R: "Type ou rang technique du flux",
    SC: "Informations de score et d'état du match",
    VI: "Identifiant virtuel/interne de l'événement",
    VA: "Valeur ou indicateur interne du flux",
    HMH: "Indicateur technique du fournisseur",
    GNS: "Indicateur booléen technique",
    ICY: "Indicateur booléen technique",
    U: "Timestamp technique de mise à jour",
    I: "Identifiant unique du match",
    N: "Identifiant numérique annexe",
    T: "Type d'événement ou sport côté fournisseur",
    CO: "Code catégorie/compétition",
    E: "Marchés et cotes principaux",
    AE: "Marchés et cotes additionnels",
    EC: "Nombre total d'éléments ou marchés liés",
    TG: "Groupe texte",
    V: "Valeur technique",
    VE: "Valeur technique annexe",
    PN: "Nom annexe éventuel",
    TN: "Statut texte du match",
    DI: "Information descriptive additionnelle",
    S: "Timestamp planifié du début",
    HS: "Indicateur d'état",
    SGC: "Compteur ou état technique",
    CHIMG: "Image du championnat",
    O1: "Nom de l'équipe ou participant 1",
    O2: "Nom de l'équipe ou participant 2",
    O1I: "ID équipe ou participant 1",
    O2I: "ID équipe ou participant 2",
    O1IS: "Liste d'IDs associée à O1",
    O2IS: "Liste d'IDs associée à O2",
    O1C: "Code pays/club/zone de O1",
    O2C: "Code pays/club/zone de O2",
    O1CT: "Ville ou abréviation de O1",
    O2CT: "Ville ou abréviation de O2",
    O1IMG: "Images de O1",
    O2IMG: "Images de O2",
    O1R: "Nom de O1 dans une autre langue",
    O2R: "Nom de O2 dans une autre langue",
    O1E: "Nom anglais de O1",
    O2E: "Nom anglais de O2",
    SI: "Identifiant du sport",
    SN: "Nom du sport",
    SR: "Nom du sport dans une autre langue",
    SE: "Nom anglais du sport",
    L: "Nom de la ligue ou compétition",
    LR: "Nom de la ligue dans une autre langue",
    LE: "Nom anglais de la ligue",
    LI: "Identifiant de la ligue",
    CN: "Pays, continent ou zone",
    CE: "Pays, continent ou zone en anglais",
    COI: "Identifiant géographique ou compétition",
    MS: "États additionnels",
    KI: "Indicateur technique",
    CID: "Identifiant de catégorie",
    SIMG: "Image du sport ou de la section",
    TNS: "État texte secondaire"
  },
  score: {
    FS: "Score complet ou structure de score",
    PS: "Périodes ou scores par période",
    CPS: "Période courante",
    GS: "Statut global numérique",
    TS: "Temps restant ou temps de jeu technique",
    TD: "Décalage ou variation de temps",
    TR: "Temps restant additionnel éventuel",
    I: "Message texte interne",
    SLS: "Statut texte court"
  },
  market: {
    T: "Type de pari ou marché",
    P: "Ligne, handicap ou total",
    C: "Cote numérique",
    CV: "Cote texte",
    G: "Groupe de marché",
    CE: "Indicateur spécial ou cote active",
    B: "Indicateur booléen additionnel du fournisseur"
  },
  additionalMarketGroup: {
    G: "Identifiant du groupe",
    ME: "Liste des marchés du groupe"
  },
  notes: [
    "Certaines clés sont des abréviations internes du fournisseur.",
    "Leur sens exact peut varier selon le sport ou le type de marché.",
    "Si la source ajoute de nouvelles clés, elles sont retransmises telles quelles par le miroir."
  ]
};

const providerKeys = Object.keys(upstreamPresets);
const primaryProviderKey = "888starz";
const responseMode = "raw-pass-through";
const redisKeys = {
  payload: "livefeed:raw",
  updatedAt: "livefeed:last_update",
  provider: "livefeed:provider",
  status: "livefeed:status",
  error: "livefeed:last_error"
};

app.use(express.json());

let redisClient = null;
let redisReady = false;
let collectorTimer = null;

function buildTargetUrl(baseUrl, path, query) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  const targetUrl = new URL(`${normalizedBaseUrl}/${normalizedPath}`);

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => targetUrl.searchParams.append(key, entry));
      continue;
    }

    if (value !== undefined) {
      targetUrl.searchParams.set(key, value);
    }
  }

  return targetUrl;
}

function mergeQuery(defaultQuery, requestQuery) {
  return {
    ...defaultQuery,
    ...requestQuery
  };
}

function copyResponseHeaders(sourceHeaders, response) {
  const blockedHeaders = new Set([
    "connection",
    "content-encoding",
    "content-length",
    "host",
    "transfer-encoding"
  ]);

  for (const [key, value] of sourceHeaders.entries()) {
    if (!blockedHeaders.has(key.toLowerCase())) {
      response.setHeader(key, value);
    }
  }
}

function markRawResponse(response, providerKey = null) {
  response.setHeader("x-response-mode", responseMode);

  if (providerKey) {
    response.setHeader("x-selected-provider", providerKey);
  }
}

function getProviderConfig(providerKey, requestQuery = {}) {
  const provider = upstreamPresets[providerKey];

  if (!provider) {
    return null;
  }

  const query = mergeQuery(provider.defaultQuery, requestQuery);
  const targetUrl = buildTargetUrl(provider.baseUrl, provider.path, query);
  const headers = new Headers(provider.headers);

  return {
    provider,
    targetUrl,
    headers
  };
}

async function fetchProviderPayload(providerKey, requestQuery = {}) {
  const config = getProviderConfig(providerKey, requestQuery);

  if (!config) {
    throw new Error("Provider introuvable.");
  }

  const upstreamResponse = await fetch(config.targetUrl, {
    method: "GET",
    headers: config.headers
  });
  const contentType = upstreamResponse.headers.get("content-type") || "";
  const payload = await upstreamResponse.text();

  return {
    upstreamResponse,
    contentType,
    payload
  };
}

async function connectRedis() {
  if (!redisUrl) {
    return;
  }

  redisClient = createClient({
    url: redisUrl
  });

  redisClient.on("error", (error) => {
    redisReady = false;
    console.error("Redis error:", error.message);
  });

  redisClient.on("ready", () => {
    redisReady = true;
  });

  await redisClient.connect();
  redisReady = true;
}

async function writeCollectorSuccess(payload) {
  if (!redisReady || !redisClient) {
    return;
  }

  const now = new Date().toISOString();

  await redisClient.mSet({
    [redisKeys.payload]: payload,
    [redisKeys.updatedAt]: now,
    [redisKeys.provider]: primaryProviderKey,
    [redisKeys.status]: "ok",
    [redisKeys.error]: ""
  });
}

async function writeCollectorError(message) {
  if (!redisReady || !redisClient) {
    return;
  }

  await redisClient.mSet({
    [redisKeys.status]: "error",
    [redisKeys.error]: message
  });
}

async function runCollector() {
  try {
    const { payload } = await fetchProviderPayload(primaryProviderKey);
    await writeCollectorSuccess(payload);
  } catch (error) {
    await writeCollectorError(error.message);
    console.error("Collector error:", error.message);
  }
}

async function startCollector() {
  if (!redisReady || !redisClient) {
    return;
  }

  await runCollector();
  collectorTimer = setInterval(runCollector, collectorIntervalMs);
}

async function relayProviderRequest(providerKey, request, response) {
  try {
    const { upstreamResponse, contentType, payload } = await fetchProviderPayload(
      providerKey,
      request.query
    );

    copyResponseHeaders(upstreamResponse.headers, response);
    markRawResponse(response, providerKey);
    response.status(upstreamResponse.status);

    if (contentType.includes("application/json")) {
      response.type("application/json").send(payload);
      return;
    }

    response.send(payload);
  } catch (error) {
    response.status(502).json({
      error: "Bad Gateway",
      message: "Impossible de joindre l'API cible.",
      details: error.message,
      provider: providerKey
    });
  }
}

app.get("/", (_request, response) => {
  response.json({
    name: "mirror-api",
    message: "API miroir active",
    mode: responseMode,
    target: targetBaseUrl || null,
    providers: providerKeys,
    primaryProvider: primaryProviderKey,
    redis: {
      enabled: Boolean(redisUrl),
      ready: redisReady,
      collectorIntervalMs
    },
    endpoints: {
      health: "/health",
      proxyAnyPath: "/mirror/*",
      providerMirror: "/providers/:provider/live-feed",
      primaryMirror: "/live-feed",
      rawMirror: "/live-feed/raw",
      keyDocs: "/docs/keys"
    }
  });
});

app.get("/health", async (_request, response) => {
  let redisSnapshot = null;

  if (redisReady && redisClient) {
    const values = await redisClient.mGet([
      redisKeys.updatedAt,
      redisKeys.provider,
      redisKeys.status,
      redisKeys.error
    ]);

    redisSnapshot = {
      lastUpdate: values[0],
      provider: values[1],
      status: values[2],
      error: values[3]
    };
  }

  response.json({
    status: "ok",
    primaryProvider: primaryProviderKey,
    mode: responseMode,
    redis: {
      enabled: Boolean(redisUrl),
      ready: redisReady,
      collectorIntervalMs,
      snapshot: redisSnapshot
    }
  });
});

app.get("/docs/keys", (_request, response) => {
  response.json({
    name: "mirror-api key documentation",
    provider: primaryProviderKey,
    mode: responseMode,
    sections: keyDocumentation
  });
});

app.all("/mirror/*", async (request, response) => {
  if (!targetBaseUrl) {
    response.status(400).json({
      error: "Configuration manquante",
      message: "TARGET_API_BASE_URL est requis pour /mirror/*."
    });
    return;
  }

  const proxiedPath = request.params[0] || "";
  const targetUrl = buildTargetUrl(targetBaseUrl, proxiedPath, request.query);

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method
    });
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const payload = await upstreamResponse.text();

    copyResponseHeaders(upstreamResponse.headers, response);
    markRawResponse(response);
    response.status(upstreamResponse.status);

    if (contentType.includes("application/json")) {
      response.type("application/json").send(payload);
      return;
    }

    response.send(payload);
  } catch (error) {
    response.status(502).json({
      error: "Bad Gateway",
      message: "Impossible de joindre l'API cible.",
      details: error.message
    });
  }
});

app.get("/providers/:provider/live-feed", async (request, response) => {
  await relayProviderRequest(request.params.provider, request, response);
});

app.get("/live-feed", async (_request, response) => {
  if (!redisReady || !redisClient) {
    response.status(503).json({
      error: "Redis indisponible",
      message: "Le collector Redis n'est pas prêt."
    });
    return;
  }

  const values = await redisClient.mGet([
    redisKeys.payload,
    redisKeys.updatedAt,
    redisKeys.provider,
    redisKeys.status,
    redisKeys.error
  ]);

  const payload = values[0];
  const updatedAt = values[1];
  const provider = values[2];
  const status = values[3];
  const lastError = values[4];

  if (!payload) {
    response.status(503).json({
      error: "Aucune donnée disponible",
      message: "Le collector n'a pas encore alimenté Redis.",
      redisStatus: status,
      lastError
    });
    return;
  }

  markRawResponse(response, provider || primaryProviderKey);
  response.setHeader("x-data-source", "redis");
  if (updatedAt) {
    response.setHeader("x-last-update", updatedAt);
  }
  response.type("application/json").send(payload);
});

app.get("/live-feed/raw", async (request, response) => {
  await relayProviderRequest(primaryProviderKey, request, response);
});

async function startServer() {
  try {
    await connectRedis();
    await startCollector();
  } catch (error) {
    console.error("Startup warning:", error.message);
  }

  app.listen(port, () => {
    console.log(
      `Mirror API démarrée sur http://localhost:${port} avec ${primaryProviderKey} comme source principale`
    );
  });
}

startServer();
