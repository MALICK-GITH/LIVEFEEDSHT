require("dotenv").config();
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;
const targetBaseUrl = process.env.TARGET_API_BASE_URL;
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

const providerKeys = Object.keys(upstreamPresets);
const primaryProviderKey = "888starz";

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

async function relayRequest({
  request,
  response,
  targetUrl,
  extraHeaders = {},
  selectedProvider = null
}) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (["host", "connection", "content-length"].includes(key.toLowerCase())) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
    } else if (value) {
      headers.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }

  const requestInit = {
    method: request.method,
    headers
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    requestInit.body = JSON.stringify(request.body);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  try {
    const upstreamResponse = await fetch(targetUrl, requestInit);
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson
      ? await upstreamResponse.text()
      : Buffer.from(await upstreamResponse.arrayBuffer());

    copyResponseHeaders(upstreamResponse.headers, response);

    if (selectedProvider) {
      response.setHeader("x-selected-provider", selectedProvider);
    }

    response.status(upstreamResponse.status);

    if (isJson) {
      response.type("application/json").send(payload);
      return;
    }

    response.send(payload);
  } catch (error) {
    response.status(502).json({
      error: "Bad Gateway",
      message: "Impossible de joindre l'API cible.",
      details: error.message,
      provider: selectedProvider
    });
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

  await relayRequest({
    request,
    response,
    targetUrl,
    extraHeaders: provider.headers,
    selectedProvider: providerKey
  });
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
  response.json({ status: "ok", primaryProvider: primaryProviderKey });
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

  await relayRequest({ request, response, targetUrl });
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
