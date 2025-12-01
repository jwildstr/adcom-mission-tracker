import express from 'express';
import 'dotenv/config';
import axios from 'axios';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';

const gunzip = promisify(zlib.gunzip);
const app = express();

app.use(express.urlencoded({
  extended: false,
  limit: '5mb'
}));
app.use(express.json());
app.use(
  express.static('public', {
    extensions: ['html']
  }
));
app.enable('trust proxy');

// Get core data from .env
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PLAYFAB_TITLE_ID_ADCOM = process.env.PLAYFAB_TITLE_ID_ADCOM;
const PLAYFAB_TITLE_ID_AGES = process.env.PLAYFAB_TITLE_ID_AGES;
const PLAYFAB_DEVICE_ID = process.env.PLAYFAB_DEVICE_ID;
const PLAYFAB_DEVICE_ID_TYPE = process.env.PLAYFAB_DEVICE_ID_TYPE;
const LANGUAGE = process.env.LANGUAGE || 'English';

const getDataFilesForTitleVersion = async (title, version) => {
  if (PLAYFAB_DEVICE_ID_TYPE !== 'IOS' && PLAYFAB_DEVICE_ID_TYPE !== 'ANDROID') {
    throw new Error(
      `Invalid PlayFab device ID type: "${PLAYFAB_DEVICE_ID_TYPE}". Expected "IOS" or "ANDROID".`
    );
  };

  const playfabLoginEndpoint = PLAYFAB_DEVICE_ID_TYPE === 'IOS' ? 'LoginWithIOSDeviceID' : 'LoginWithAndroidDeviceID';
  
  // Get title data from env
  if (title !== PLAYFAB_TITLE_ID_ADCOM && title !== PLAYFAB_TITLE_ID_AGES) {
    throw new Error(
      `Invalid title ID: "${title}". Expected "6bf5" or "dc4bb".`
    );
  };

  // Create login payload
  const loginPayload =
  PLAYFAB_DEVICE_ID_TYPE === 'IOS'
    ? {
        DeviceId: PLAYFAB_DEVICE_ID,
        TitleId: title
      }
    : {
        AndroidDeviceId: PLAYFAB_DEVICE_ID,
        TitleId: title
      };
  
  // Send session request
  const sessionRequest = await axios.post(
    `https://${title}.playfabapi.com/Client/${playfabLoginEndpoint}`,
    loginPayload
  );

  const sessionToken = sessionRequest.data.data.SessionTicket;

  // Send data file manifest request
  const dataFileManifestRequest = await axios.post(
    `https://${title}.playfabapi.com/Client/ExecuteCloudScript`,
    {
      FunctionName: 'DataConfig',
      FunctionParameter: {
        DataVersion: version
      },
    },
    {
      headers: {
        'X-Authorization': sessionToken,
      },
    }
  );

  return JSON.parse(dataFileManifestRequest.data.data.FunctionResult);
};

const downloadUrlList = async (urls, title) => {
  await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Unable to download "${url}": ${response.status} ${response.statusText}`);
      }

      // decompress gzip data
      const gzipBuffer = Buffer.from(await response.arrayBuffer());
      const data = await gunzip(gzipBuffer);

      // remove ".gz" extension
      let filename = url.split('/').pop().split('?')[0];
      if (filename.endsWith('.gz')) {
        filename = filename.slice(0, -3);
      }

      await fs.promises.writeFile(`data/${title}/${filename}`, data);
    })
  );
};

const compareSha256Hash = (inputRaw, hash) => {
  const inputHash = crypto.createHash('sha256').update(inputRaw).digest('hex');

  return inputHash === hash;
};

app.post('/api/import', async (req, res) => {
  const { payload } = req.body || {};

  if (!payload) {
    return res.status(400).send('Missing payload');
  }

  // Safely embed the base64 string in JS
  const safePayload = JSON.stringify(payload); // makes a valid JS string literal

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

      // Base64 → UTF-8 string (mirror of the encoder we used)
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
        // You *could* show a nicer error page here instead of silently redirecting
      }

      // After localStorage is repopulated, go to home page
      window.location.href = '/adcom-mission-tracker/';
    })();
  </script>
</body>
</html>`);
});

app.get('/api/data/:title', async (req, res) => {
  // validate title
  if (req.params.title !== PLAYFAB_TITLE_ID_ADCOM && req.params.title !== PLAYFAB_TITLE_ID_AGES) {
    return res.sendStatus(400);
  }

  try {
    // read manifest
    const manifestRaw = await fs.promises.readFile(`./data/${req.params.title}/manifest.json`, 'utf8');
    const manifestExistingData = JSON.parse(manifestRaw);

    // ---- Balance: key/value by manifest Balance.Urls key ----
    const balanceResult = {};
    const balanceUrls = manifestExistingData?.VersionSettings?.Balance?.Urls || {};

    for (const [key, value] of Object.entries(balanceUrls)) {
      // value is the filename with .gz; local file is stored without .gz
      const filename = value.replace('.gz', '');
      const filePath = `./data/${req.params.title}/${filename}`;
      const fileContents = await fs.promises.readFile(filePath, 'utf8');
      balanceResult[key] = JSON.parse(fileContents);
    }

    // ---- Localization: select file matching LANGUAGE prefix ----
    const localizationUrls = manifestExistingData?.VersionSettings?.Localization?.Urls || {};
    let localizationFilename = null;

    for (const value of Object.values(localizationUrls)) {
      const withoutGz = value.replace('.gz', '');
      // file format: LANGUAGE.uselessMd5Hash.json
      if (withoutGz.startsWith(`${LANGUAGE}.`)) {
        localizationFilename = withoutGz;
        break;
      }
    }

    if (!localizationFilename) {
      throw new Error(`No localization file found for language "${LANGUAGE}" in manifest for title "${req.params.title}".`);
    }

    const localizationPath = `./data/${req.params.title}/${localizationFilename}`;
    const localizationContents = await fs.promises.readFile(localizationPath, 'utf8');
    const localizationResult = Buffer.from(localizationContents).toString('base64');

    // ---- LTESchedule: always CombinedLTESchedule from manifest ----
    const lteUrl = manifestExistingData?.VersionSettings?.LTESchedule?.Url;
    if (!lteUrl) {
      throw new Error(`No LTESchedule URL found in manifest for title "${req.params.title}".`);
    }

    let lteFilename = lteUrl.split('/').pop().split('?')[0];
    lteFilename = lteFilename.replace('.gz', '');
    const ltePath = `./data/${req.params.title}/${lteFilename}`;
    const lteContents = await fs.promises.readFile(ltePath, 'utf8');
    const lteResult = JSON.parse(lteContents);

    // Final response
    const responseBody = {
      Balance: balanceResult,
      Localization: localizationResult,
      LTESchedule: lteResult
    };

    return res.json(responseBody);
  } catch (error) {
    console.error(`Failed to read data files for title "${req.params.title}". ${error}`);
    return res.sendStatus(500);
  }
})

app.post('/api/admin', async (req, res) => {
  if (!ADMIN_PASSWORD || !PLAYFAB_TITLE_ID_ADCOM || !PLAYFAB_TITLE_ID_AGES || !PLAYFAB_DEVICE_ID || !PLAYFAB_DEVICE_ID_TYPE) {
    return res.sendStatus(500);
  } else if (req.body && compareSha256Hash(req.body.password, ADMIN_PASSWORD)) {
    const returnStruct = {
      PLAYFAB_TITLE_ID_ADCOM: null,
      PLAYFAB_TITLE_ID_AGES: null
    };

    returnStruct.PLAYFAB_TITLE_ID_ADCOM = await fs.promises.readFile(`./data/${PLAYFAB_TITLE_ID_ADCOM}/version`, 'utf8')
    .then((data) => {
      return data
    })
    .catch((error) => {
      console.error(`Unable to determine data version for title "${PLAYFAB_TITLE_ID_ADCOM}". ${error}`)
    });

    returnStruct.PLAYFAB_TITLE_ID_AGES = await fs.promises.readFile(`./data/${PLAYFAB_TITLE_ID_AGES}/version`, 'utf8')
    .then((data) => {
      return data
    })
    .catch((error) => {
      console.error(`Unable to determine data version for title "${PLAYFAB_TITLE_ID_AGES}". ${error}`)
    });

    res.json(returnStruct);
  } else {
    return res.sendStatus(401);
  }
  
  return;
})

app.post('/api/admin/data-file', async (req, res) => {
  const returnStruct = {
    "message": null
  };

  if (!ADMIN_PASSWORD || !PLAYFAB_TITLE_ID_ADCOM || !PLAYFAB_TITLE_ID_AGES || !PLAYFAB_DEVICE_ID || !PLAYFAB_DEVICE_ID_TYPE) {
    returnStruct.message = 'Server error';
    res.status(500).json(returnStruct);
  } else if (!req.body || !req.body.title || !req.body.version || (req.body.title !== PLAYFAB_TITLE_ID_ADCOM && req.body.title !== PLAYFAB_TITLE_ID_AGES)) {
    returnStruct.message = 'Invalid parameters';
    res.status(400).json(returnStruct);
  } else if (req.body && compareSha256Hash(req.body.password, ADMIN_PASSWORD)) {
    // Create directory if doesn't exist
    await fs.promises.mkdir(`./data/${req.body.title}`,
      {
        recursive: true
      }
    )
    .catch((error) => {
      console.error(`Failed to create path. ${error}`);
    });
    
    // parse existing data version
    const dataVersionExisting = await fs.promises.readFile(`./data/${req.body.title}/version`, 'utf8')
    .then((data) => {
      return data;
    })
    .catch((error) => {
      console.error(`Unable to determine data version for title "${PLAYFAB_TITLE_ID_ADCOM}". ${error}`);
    });

    const dataVersionRequested = req.body.version;
    const dataVersionRequestedArr = dataVersionRequested.split('.');

    // make sure version strings are ints
    for (let i of dataVersionRequestedArr) {
      if (isNaN(parseInt(i))) {
        returnStruct.message = 'Invalid version requested. Version should be in the format "1.23".'
        res.status(400).json(returnStruct);
        return
      }
    }

    if (dataVersionExisting) {
      let continueCheckingDataVersionExisting = true;
      const dataVersionExistingArr = dataVersionExisting.split('.');

      for (let i of dataVersionExistingArr) {
        if (isNaN(parseInt(i))) {
          // there is a problem with the stored version #
          console.error(`There is a problem with the version identifier for title ID "${req.body.title}".`);
          continueCheckingDataVersionExisting = false;
          break;
        }
      }

      // make sure we're not going back to a previous version
      if (continueCheckingDataVersionExisting &&
        ((parseInt(dataVersionExistingArr[0]) > parseInt(dataVersionRequestedArr[0])) ||
        ((parseInt(dataVersionExistingArr[0]) === parseInt(dataVersionRequestedArr[0])) && (parseInt(dataVersionExistingArr[1]) > parseInt(dataVersionRequestedArr[1]))))
      ) {
        returnStruct.message = 'You cannot request an older version. If you need to revert, please contact the server administrator.'
        res.status(400).json(returnStruct);
        return;
      }
    }
    
    // request new data files
    const dataFilesForRequestedVersion = await getDataFilesForTitleVersion(req.body.title, dataVersionRequested)
    .then((data) => {
      return data;
    })
    .catch((error) => {
      console.error(`Failed to load data files for ${req.body.title}/${req.body.version}: ${error}`);
      returnStruct.message = 'There was a problem loading the data files. This version may not exist yet.';
      res.status(404).json(returnStruct);
    });

    if (!dataFilesForRequestedVersion) {
      return;
    };

    // get existing manifest and delete existing files
    const manifestExisting = await fs.promises.readFile(`./data/${req.body.title}/manifest.json`, 'utf8')
    .then(async (data) => {
      const manifestExistingData = JSON.parse(data);
      
      const dataFilesExisting = [];

      for (let i of Object.values(manifestExistingData.VersionSettings.Balance.Urls)) {
        dataFilesExisting.push(i)
      };

      for (let i of Object.values(manifestExistingData.VersionSettings.Localization.Urls)) {
        dataFilesExisting.push(i)
      };

      dataFilesExisting.push(manifestExistingData.VersionSettings.LTESchedule.Url.split('/').pop().split('?')[0]);
    
      for (let i of dataFilesExisting) {
        await fs.promises.unlink(`./data/${req.body.title}/${i.replace('.gz', '')}`)
        .catch((error) => {
          console.log(`Failed to delete data file indicated in existing manifest "${i.replace('.gz', '')}". Does it exist? ${error}`);
        });
      };
    })
    .catch((error) => {
      console.error(`Failed to read existing manifest for title "${req.body.title}". ${error}`)
    });

    // write new data file manifest
    const writeRequestedDataFileManifest = await fs.promises.writeFile(`./data/${req.body.title}/manifest.json`, JSON.stringify(dataFilesForRequestedVersion))
    .catch((error) => {
      console.error(`Failed to write data file manifest for ${req.body.title}/${req.body.version}: ${error}`);
      returnStruct.message = 'There was a problem loading the data files.';
      res.status(500).json(returnStruct);
      return null;
    });

    if (writeRequestedDataFileManifest === null) {
      return;
    }

    const urlsForRequestedVersion = [];

    for (let i of Object.values(dataFilesForRequestedVersion.VersionSettings.Balance.Urls)) {
      urlsForRequestedVersion.push(`${dataFilesForRequestedVersion.VersionSettings.Balance.BaseURL}${i}`);
    };

    for (let i of Object.values(dataFilesForRequestedVersion.VersionSettings.Localization.Urls)) {
      urlsForRequestedVersion.push(`${dataFilesForRequestedVersion.VersionSettings.Localization.BaseURL}${i}`);
    };

    urlsForRequestedVersion.push(dataFilesForRequestedVersion.VersionSettings.LTESchedule.Url);
    
    const downloadRequestedFilesStatus = await downloadUrlList(urlsForRequestedVersion, req.body.title)
    .catch((error) => {
      console.error(`Failed to download new data files for ${req.body.title}/${req.body.version}. ${error}`)
      returnStruct.message = 'There was a problem updating the data files.';
      res.status(500).json(returnStruct);
      return null;
    });

    if (downloadRequestedFilesStatus === null) {
      return;
    }
      
    const writeRequestedManifestStatus = await fs.promises.writeFile(`./data/${req.body.title}/version`, dataVersionRequested)
    .catch((error) => {
      console.error(`Failed to write version identifier for ${req.body.title}/${req.body.version}. ${error}`)
      returnStruct.message = 'There was a problem updating the data files.';
      res.status(500).json(returnStruct);
      return null
    });

    if (writeRequestedManifestStatus === null) {
      return;
    }

    return res.sendStatus(200);
  } else {
    return res.sendStatus(401);
  }

  return;
})

app.get('/api/build', async(req, res) => {
  const buildId = process.env.COMMIT_HASH || "BUILD UNKNOWN";
  res.status(200).send(buildId);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${server.address().port}.`);
});