import express from 'express';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const app = express();

app.use(express.urlencoded({
  extended: false,
  limit: '5mb'
}));
app.use(express.json());
app.use(
  express.static('public', {
    extensions: ['html']
  })
);
app.enable('trust proxy');

// Core environment settings
const PORT = process.env.PORT || 3000;
const PLAYFAB_TITLE_ID_ADCOM = process.env.PLAYFAB_TITLE_ID_ADCOM;
const PLAYFAB_TITLE_ID_AGES = process.env.PLAYFAB_TITLE_ID_AGES;
const ASSET_SERVER = process.env.ASSET_SERVER;
const ASSET_PUBLIC_BASE = process.env.ASSET_PUBLIC_BASE;

const BALANCE_CONFIG_BY_TITLE_ENV = {
  adcom: 'public/config_adcom.js',
  ages: 'public/config_ages.js'
};

const getAllowedTitleIds = () => {
  return [PLAYFAB_TITLE_ID_ADCOM, PLAYFAB_TITLE_ID_AGES].filter(Boolean);
};

const isTitleAllowed = (titleId) => {
  return getAllowedTitleIds().includes(titleId);
};

const stripTrailingSlashes = (input) => {
  return input.replace(/\/+$/, '');
};

const normalizeAssetPublicRoot = () => {
  if (!ASSET_PUBLIC_BASE) {
    return null;
  }

  return stripTrailingSlashes(ASSET_PUBLIC_BASE);
};

const assetServerBaseForTitle = (titleId) => {
  if (!ASSET_SERVER || !titleId) {
    return null;
  }

  return `${stripTrailingSlashes(ASSET_SERVER)}/assets/${titleId}`;
};

const assetPublicBaseForTitle = (titleId) => {
  if (!titleId) {
    return '';
  }

  const normalizedPublicRoot = normalizeAssetPublicRoot();
  if (normalizedPublicRoot) {
    return `${normalizedPublicRoot}/${titleId}`;
  }

  const fallback = assetServerBaseForTitle(titleId);
  return fallback || '';
};

const assetUpdateUrl = () => {
  if (!ASSET_SERVER) {
    return null;
  }

  return `${stripTrailingSlashes(ASSET_SERVER)}/update`;
};

const extractBalanceIdsFromConfig = (relativeConfigPath) => {
  try {
    const absolutePath = path.resolve(process.cwd(), relativeConfigPath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    const objectMatch = source.match(/BALANCE_UPDATE_VERSION\s*=\s*\{([\s\S]*?)\};/);
    if (!objectMatch || !objectMatch[1]) {
      return [];
    }

    const ids = [];
    const keyMatcher = /["']([^"']+)["']\s*:/g;
    let keyMatch = keyMatcher.exec(objectMatch[1]);
    while (keyMatch) {
      ids.push(keyMatch[1]);
      keyMatch = keyMatcher.exec(objectMatch[1]);
    }

    return ids.filter((id) => id && id !== 'main');
  } catch (error) {
    console.error(`Failed to parse known balance IDs from "${relativeConfigPath}". ${error}`);
    return [];
  }
};

const getKnownBalanceIdsByTitle = () => {
  const byTitle = {};
  if (PLAYFAB_TITLE_ID_ADCOM) {
    byTitle[PLAYFAB_TITLE_ID_ADCOM] = extractBalanceIdsFromConfig(BALANCE_CONFIG_BY_TITLE_ENV.adcom);
  }
  if (PLAYFAB_TITLE_ID_AGES) {
    byTitle[PLAYFAB_TITLE_ID_AGES] = extractBalanceIdsFromConfig(BALANCE_CONFIG_BY_TITLE_ENV.ages);
  }
  return byTitle;
};

const KNOWN_BALANCE_IDS_BY_TITLE = getKnownBalanceIdsByTitle();

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with HTTP ${response.status}`);
  }

  return response.json();
};

const fetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with HTTP ${response.status}`);
  }

  return response.text();
};

const getAssetServerStatusByTitle = async () => {
  const emptyStatus = {};
  for (const titleId of getAllowedTitleIds()) {
    emptyStatus[titleId] = {
      dataVersion: 'Unknown',
      jobCompleteAt: 'Unknown'
    };
  }

  if (!ASSET_SERVER) {
    return emptyStatus;
  }

  try {
    const statusUrl = stripTrailingSlashes(ASSET_SERVER);
    const response = await fetch(statusUrl);
    if (!response.ok) {
      return emptyStatus;
    }

    const statusJson = await response.json();
    if (!statusJson || !statusJson.titles) {
      return emptyStatus;
    }

    for (const titleId of Object.keys(emptyStatus)) {
      const titleStatus = statusJson.titles[titleId];
      if (titleStatus) {
        emptyStatus[titleId] = {
          dataVersion: titleStatus.dataVersion || 'Unknown',
          jobCompleteAt: titleStatus.jobCompleteAt || 'Unknown'
        };
      }
    }
  } catch (error) {
    console.error(`Failed to load asset status. ${error}`);
  }

  return emptyStatus;
};

app.get('/js/runtime-config.js', async (req, res) => {
  res.setHeader('content-type', 'application/javascript; charset=utf-8');
  res.setHeader('cache-control', 'no-store, max-age=0');

  const runtimeConfig = {
    titleIds: {
      adcom: PLAYFAB_TITLE_ID_ADCOM || '',
      ages: PLAYFAB_TITLE_ID_AGES || ''
    },
    assetBaseByTitleId: {
      ...(PLAYFAB_TITLE_ID_ADCOM ? { [PLAYFAB_TITLE_ID_ADCOM]: assetPublicBaseForTitle(PLAYFAB_TITLE_ID_ADCOM) } : {}),
      ...(PLAYFAB_TITLE_ID_AGES ? { [PLAYFAB_TITLE_ID_AGES]: assetPublicBaseForTitle(PLAYFAB_TITLE_ID_AGES) } : {})
    }
  };

  res.status(200).send(`window.__RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};`);
});

app.post('/api/import', async (req, res) => {
  const { payload } = req.body || {};

  if (!payload) {
    return res.status(400).send('Missing payload');
  }

  const safePayload = JSON.stringify(payload);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>AdVenture Communist/Ages Mission Tracker</title>
</head>
<body>
  <h1>The Mission Tracker has moved!</h1>
  <p>Importing your data ...</p>
  <script>
    (function () {
      const encoded = ${safePayload};

      function fromBase64(b64) {
        const binary = atob(b64);
        const utf8 = Array.prototype.map.call(binary, function (ch) {
          return '%' + ch.charCodeAt(0).toString(16).padStart(2, '0');
        }).join('');
        return decodeURIComponent(utf8);
      }

      try {
        const json = fromBase64(encoded);
        const data = JSON.parse(json);

        if (data && typeof data === 'object') {
          Object.keys(data).forEach(function (key) {
            localStorage.setItem(key, data[key]);
          });
        }
      } catch (err) {
        console.error('Import failed:', err);
      }

      window.location.href = '/adcom-mission-tracker/';
    })();
  </script>
</body>
</html>`);
});

app.get('/api/data/:title', async (req, res) => {
  const titleId = req.params.title;
  if (!isTitleAllowed(titleId)) {
    return res.sendStatus(400);
  }

  const titleAssetServerBase = assetServerBaseForTitle(titleId);
  if (!titleAssetServerBase) {
    return res.sendStatus(500);
  }

  try {
    const scheduleUrl = `${titleAssetServerBase}/schedule.json`;
    const localizationUrl = `${titleAssetServerBase}/localization.txt`;

    const schedule = await fetchJson(scheduleUrl);
    const localizationRaw = await fetchText(localizationUrl);

    const balanceIds = new Set(['common', 'evergreen']);
    const knownBalanceIds = KNOWN_BALANCE_IDS_BY_TITLE[titleId] || [];
    for (const knownBalanceId of knownBalanceIds) {
      balanceIds.add(knownBalanceId);
    }

    const mapBalanceIdForAsset = (balanceId) => {
      if (!balanceId) {
        return balanceId;
      }

      if (balanceId === 'common') {
        return 'common';
      }

      if (balanceId === 'main' || balanceId === 'evergreen') {
        return 'evergreen';
      }

      return balanceId.split('-')[0];
    };

    const balanceFetchCache = {};
    const fetchBalanceForAssetId = async (assetBalanceId) => {
      if (balanceFetchCache[assetBalanceId]) {
        return balanceFetchCache[assetBalanceId];
      }

      let balanceUrl;
      if (assetBalanceId === 'common') {
        balanceUrl = `${titleAssetServerBase}/common.json`;
      } else {
        balanceUrl = `${titleAssetServerBase}/${assetBalanceId}/balance.json`;
      }

      const parsedBalance = await fetchJson(balanceUrl);
      balanceFetchCache[assetBalanceId] = parsedBalance;
      return parsedBalance;
    };

    const sortedBalanceIds = Array.from(balanceIds).sort((a, b) => a.localeCompare(b));
    const balanceEntries = await Promise.all(
      sortedBalanceIds.map(async (balanceId) => {
        const assetBalanceId = mapBalanceIdForAsset(balanceId);
        const parsedBalance = await fetchBalanceForAssetId(assetBalanceId);
        return [balanceId, parsedBalance];
      })
    );
    const balanceResult = Object.fromEntries(balanceEntries);

    const responseBody = {
      Balance: balanceResult,
      Localization: Buffer.from(localizationRaw, 'utf8').toString('base64'),
      LTESchedule: schedule
    };

    return res.json(responseBody);
  } catch (error) {
    console.error(`Failed to load asset data for title "${titleId}". ${error}`);
    return res.sendStatus(502);
  }
});

app.get('/api/admin/status', async (req, res) => {
  if (!PLAYFAB_TITLE_ID_ADCOM || !PLAYFAB_TITLE_ID_AGES) {
    return res.sendStatus(500);
  }

  const statusByTitle = await getAssetServerStatusByTitle();
  res.status(200).json(statusByTitle);
});

app.post('/api/admin/data-file', async (req, res) => {
  if (!PLAYFAB_TITLE_ID_ADCOM || !PLAYFAB_TITLE_ID_AGES) {
    return res.sendStatus(500);
  }

  const body = req.body || {};
  if (!body.title || !isTitleAllowed(body.title) || !body.version || !body.password) {
    return res.status(400).json({ message: 'Invalid parameters' });
  }

  const updateUrl = assetUpdateUrl();
  if (!updateUrl) {
    return res.status(500).json({ message: 'Asset update URL is not configured.' });
  }

  try {
    const proxyResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        titleId: body.title,
        dataVersion: body.version,
        password: body.password,
        allowDowngrade: Boolean(body.allowDowngrade)
      })
    });

    const responseText = await proxyResponse.text();
    if (!responseText) {
      return res.sendStatus(proxyResponse.status);
    }

    try {
      return res.status(proxyResponse.status).json(JSON.parse(responseText));
    } catch (error) {
      return res.status(proxyResponse.status).send(responseText);
    }
  } catch (error) {
    console.error(`Failed to proxy update request to asset server. ${error}`);
    return res.status(502).json({ message: 'Internal server error. Please see logs for details.' });
  }
});

app.get('/api/build', async (req, res) => {
  const buildId = process.env.COMMIT_HASH || 'BUILD UNKNOWN';
  res.status(200).send(buildId);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${server.address().port}.`);
});
