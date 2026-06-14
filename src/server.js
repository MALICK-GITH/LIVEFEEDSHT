require("dotenv").config();
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;
const targetBaseUrl = process.env.TARGET_API_BASE_URL;
const defaultUserAgent =
  process.env.MIRROR_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const upstreamTimeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS || 15000);

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

const providerKeys = Object.keys(upstreamPresets);
const primaryProviderKey = "888starz";
const providerCache = new Map();

app.use(express.json());

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

function setProviderHeaders(response, selectedProvider, cached) {
  if (selectedProvider) {
    response.setHeader("x-selected-provider", selectedProvider);
  }

  response.setHeader("x-cache-status", cached ? "stale" : "live");
}

function isJsonLike(text) {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function isSuccessfulPayload(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    payload.Success === true &&
    Array.isArray(payload.Value)
  );
}

function cacheProviderPayload(providerKey, status, headers, payloadText) {
  providerCache.set(providerKey, {
    status,
    headers: Array.from(headers.entries()),
    payloadText,
    cachedAt: new Date().toISOString()
  });
}

function sendCachedPayload(response, providerKey) {
  const cached = providerCache.get(providerKey);

  if (!cached) {
    return false;
  }

  for (const [key, value] of cached.headers) {
    if (key.toLowerCase() !== "content-length") {
      response.setHeader(key, value);
    }
  }

  setProviderHeaders(response, providerKey, true);
  response.setHeader("x-cache-at", cached.cachedAt);
  response.status(cached.status).type("application/json").send(cached.payloadText);
  return true;
}

async function fetchUpstream(targetUrl, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  try {
    return await fetch(targetUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function relayProviderRequest(providerKey, request, response) {
  const provider = upstreamPresets[providerKey];

  if (!provider) {
    response.status(404).json({
      error: "Provider introuvable",
      availableProviders: providerKeys
    });
    return;
  }

  const query = mergeQuery(provider.defaultQuery, request.query);
  const targetUrl = buildTargetUrl(provider.baseUrl, provider.path, query);
  const headers = new Headers(provider.headers);

  try {
    const upstreamResponse = await fetchUpstream(targetUrl, headers);
    const payloadText = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const shouldTreatAsJson = contentType.includes("application/json") || isJsonLike(payloadText);

    if (!shouldTreatAsJson) {
      throw new Error("La source a renvoyé un contenu non JSON.");
    }

    let parsedPayload;

    try {
      parsedPayload = JSON.parse(payloadText);
    } catch (error) {
      throw new Error("La source a renvoyé un JSON invalide.");
    }

    if (!isSuccessfulPayload(parsedPayload)) {
      throw new Error("La source a renvoyé une réponse JSON sans données exploitables.");
    }

    copyResponseHeaders(upstreamResponse.headers, response);
    setProviderHeaders(response, providerKey, false);
    response
      .status(upstreamResponse.status)
      .type("application/json")
      .send(payloadText);

    cacheProviderPayload(
      providerKey,
      upstreamResponse.status,
      upstreamResponse.headers,
      payloadText
    );
  } catch (error) {
    const cachedSent = sendCachedPayload(response, providerKey);

    if (cachedSent) {
      return;
    }

    response.status(502).json({
      error: "Bad Gateway",
      message: "Impossible de récupérer une réponse valide depuis l'API cible.",
      details: error.message,
      provider: providerKey
    });
  }
}

app.get("/", (_request, response) => {
  response.json({
    name: "mirror-api",
    message: "API miroir active",
    target: targetBaseUrl || null,
    providers: providerKeys,
    primaryProvider: primaryProviderKey,
    endpoints: {
      health: "/health",
      proxyAnyPath: "/mirror/*",
      providerMirror: "/providers/:provider/live-feed",
      primaryMirror: "/live-feed"
    }
  });
});

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    primaryProvider: primaryProviderKey,
    cacheAvailable: providerCache.has(primaryProviderKey)
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
    const upstreamResponse = await fetchUpstream(targetUrl, new Headers(request.headers));
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const payload = await upstreamResponse.text();

    copyResponseHeaders(upstreamResponse.headers, response);
    response.status(upstreamResponse.status);

    if (contentType.includes("application/json") || isJsonLike(payload)) {
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

app.get("/live-feed", async (request, response) => {
  await relayProviderRequest(primaryProviderKey, request, response);
});

app.listen(port, () => {
  console.log(
    `Mirror API démarrée sur http://localhost:${port} avec ${primaryProviderKey} comme source principale`
  );
});
