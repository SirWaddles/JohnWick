const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const { Client } = require('fortnite-basic-api');
const { FortniteToken } = require('./tokens');

const OAUTH_TOKEN = "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token";
const OAUTH_EXCHANGE = "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/exchange";
const LAUNCHER_LOGIN = "https://accounts.launcher-website-prod07.ol.epicgames.com/login/doLauncherLogin";
const LAUNCHER_WAIT = "https://accounts.launcher-website-prod07.ol.epicgames.com/login/showPleaseWait";
const EPIC_CSRF = "https://www.epicgames.com/id/api/csrf";
const EPIC_LOGIN = "https://www.epicgames.com/id/api/login";
const EPIC_EXCHANGE = "https://www.epicgames.com/id/api/exchange";
const FORTNITE_STORE = "https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/storefront/v2/catalog";
const FORTNITE_KEYCHAIN = "https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/storefront/v2/keychain";
const FORTNITE_CLOUDSTORAGE = "https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/cloudstorage/system";

const client = new Client({
  email: FortniteToken[0],
  useDeviceAuth: true,
  removeOldDeviceAuths: true,
  deviceAuthPath: './fbadeviceauths.json', // Default is './fbadeviceauths.json'
  // You should not have to update any of the tokens.
  launcherToken: 'MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=',
  fortniteToken: 'ZWM2ODRiOGM2ODdmNDc5ZmFkZWEzY2IyYWQ4M2Y1YzY6ZTFmMzFjMjExZjI4NDEzMTg2MjYyZDM3YTEzZmM4NGQ=',
  // iosToken: 'token' // this does not have to be changed unless something changes
  autokill: true,
});

async function refreshLoginToken() {
    await client.authenticator.checkToken();
}

async function clientLogin() {
    await client.authenticator.login();
}

let loginResolved = clientLogin();

function getAccessToken() {
    return client.authenticator.accessToken;
}

async function getStoreData(signal) {
    let requestOptions = {
        headers: {
            "X-EpicGames-Language": "en",
            "Authorization": "bearer " + getAccessToken(),
        },
        method: "GET",
    };
    if (typeof signal !== "undefined") {
        requestOptions.signal = signal;
    }
    return fetch(FORTNITE_STORE, requestOptions).then(r => r.json());
}

const MAX_RETRIES = 20;

async function getStoreDataRetry() {
    await loginResolved;
    // refresh login token so that it doesn't trigger the timeout.
    await refreshLoginToken();
    for (let i = 0; i < MAX_RETRIES; i++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => { controller.abort(); }, (i * 1000) + 3000);
        try {
            return await getStoreData(controller.signal);
        } catch (e) {
            console.error(e);
            console.log("Request failed on attempt #" + i);
        } finally {
            clearTimeout(timeout);
        }
    }
}

async function getKeychain() {
    await refreshLoginToken();
    return fetch(FORTNITE_KEYCHAIN, {
        headers: {
            "X-EpicGames-Language": "en",
            "Authorization": "bearer " + getAccessToken(),
        },
        method: "GET",
    }).then(r => r.json());
}

async function getLatestHotfix() {
     await refreshLoginToken();
     let fixFiles = await fetch(FORTNITE_CLOUDSTORAGE, {
         headers: {
             "X-EpicGames-Language": "en",
             "Authorization": "bearer " + getAccessToken(),
         },
         method: "GET",
     }).then(r => r.json());
     let [finalFile] = fixFiles.filter(v => v.filename == "DefaultGame.ini");
     if (!finalFile) return "";
     let finalUrl = FORTNITE_CLOUDSTORAGE + "/" + finalFile.uniqueFilename;
     return fetch(finalUrl, {
         headers: {
             "X-EpicGames-Language": "en",
             "Authorization": "bearer " + getAccessToken(),
         },
         method: "GET",
     }).then(r => r.text());
}

exports.getLatestHotfix = getLatestHotfix;
exports.getStoreData = getStoreData;
exports.getStoreDataRetry = getStoreDataRetry;
exports.getKeychain = getKeychain;
exports.refreshLoginToken = refreshLoginToken;
