const fetch = require('node-fetch');
const fs = require('fs');
const querystring = require('querystring');
const AbortController = require('abort-controller');
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

function getClientCredentials() {
    return fetch(OAUTH_TOKEN, {
        method: "POST",
        headers: {
            'Authorization': "basic " + FortniteToken[2],
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: querystring.stringify({
            grant_type: "client_credentials",
            token_token: "eg1",
        }),
    }).then(r => r.json());
}

function headersToCookies(headers) {
    return headers.raw()['set-cookie'].map(v => v.split(";").shift().split("="));
}

function cookiesToObj(cookies) {
    return cookies.reduce((acc, v) => {
        acc[v[0]] = v[1];
        return acc;
    }, {});
}

function cookiesToString(cookies) {
    if (Array.isArray(cookies)) {
        return cookies.map(v => v[0] + "=" + v[1]).join("; ");
    } else {
        return Object.keys(cookies).map(v => v + "=" + cookies[v]).join("; ");
    }
}

function getCsrfToken() {
    return fetch(EPIC_CSRF, {
        method: "GET",
    }).then(r => r.headers).then(r => cookiesToObj(headersToCookies(r)));
}

async function launcherLogin(cookies) {
    let code = 409;
    let result = false;
    let xsrfToken = cookies['XSRF-TOKEN'];
    while (code == 409) {
        console.log("Fetching Login Data");
        result = await fetch(EPIC_LOGIN, {
            method: "POST",
            headers: {
                "Cookie": cookiesToString(cookies),
                "X-XSRF-TOKEN": xsrfToken,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: querystring.stringify({
                email: FortniteToken[0],
                password: FortniteToken[1],
                rememberMe: false,
            }),
        });
        code = result.status;
        cookies = cookiesToObj(headersToCookies(result.headers));
        if (code == 409) {
            console.log(await result.json());
        }
    }
    return cookies;
}

function launcherExchange(cookies) {
    return fetch(EPIC_EXCHANGE, {
        method: "GET",
        headers: {
            "Cookie": cookiesToString(cookies),
            "X-XSRF-TOKEN": cookies['XSRF-TOKEN'],
        },
    }).then(r => r.json());
}

// Older way of getting CSRF??
/*function getXsrfToken(client_credentials) {
    let params = {
        client_id: client_credentials.client_id,
        redirectUrl: LAUNCHER_WAIT + "?" + querystring.stringify({client_id: client_credentials.client_id, rememberEmail: false}),
    };
    return fetch(LAUNCHER_LOGIN + "?" + querystring.stringify(params), {
        method: "GET",
    }).then(r => r.headers);
}*/

async function getExchangeCode(client_credentials, cookies) {
    let xsrfCookie = cookies.filter(v => v[0] == 'XSRF-TOKEN').pop()[1];
    let cookieString = cookiesToString(cookies);
    let redirectUrl = LAUNCHER_WAIT + "?" + querystring.stringify({client_id: client_credentials.client_id, rememberEmail: false});
    let redirectData = await fetch(LAUNCHER_LOGIN, {
        method: "POST",
        headers: {
            "Cookie": cookieString,
            "X-XSRF-TOKEN": xsrfCookie,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: querystring.stringify({
            fromForm: "yes",
            authType: '',
            linkExtAuth: '',
            client_id: client_credentials.client_id,
            redirectUrl: redirectUrl,
            epic_username: FortniteToken[0],
            password: FortniteToken[1],
            rememberMe: "NO",
        }),
    });
    let cookies2 = headersToCookies(redirectData.headers);

    let tokenRequest = await fetch(redirectUrl, {
        method: "GET",
        headers: {
            "Cookie": cookiesToString(cookies2),
            "X-XSRF-TOKEN": xsrfCookie,
        },
    }).then(r => r.text());
    let tokenTest = /com\.epicgames\.account\.web\.widgets\.loginWithExchangeCode\('([\w]+)'/g;
    let exchangeToken = tokenTest.exec(tokenRequest);

    return exchangeToken[1];
}

function getAccessToken() {
    if (!FortniteToken) {
        console.error("Credentials not found");
        return false;
    }
    var loginData = {
        "grant_type": "password",
        "username": FortniteToken[0],
        "password": FortniteToken[1],
        "includePerms": 'true',
    };
    return fetch(OAUTH_TOKEN, {
        method: "POST",
        headers: {
            'Authorization': "basic " + FortniteToken[2],
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: querystring.stringify(loginData),
    }).then(r => r.json()).then(r => {
        return r.access_token;
    }).catch(e => false);
}

function getAccessCode(access_token) {
    if (typeof access_token == 'undefined') {
        throw "Access Token For Code Undefined";
    }
    return fetch(OAUTH_EXCHANGE, {
        headers: {
            "Authorization": "bearer " + access_token,
        },
        method: "GET",
    }).then(r => r.json()).then(r => r.code);
}

function getExchangeToken(code) {
    if (typeof code == 'undefined') {
        throw "Exchange Token Undefined";
    }
    return fetch(OAUTH_TOKEN, {
        headers: {
            "Authorization": "basic " + FortniteToken[3],
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: querystring.stringify({
            grant_type: "exchange_code",
            exchange_code: code,
            includePerms: true,
            token_type: "eg1",
        }),
        method: "POST",
    }).then(r => r.json()).then(r => {
        if (!r.hasOwnProperty('access_token')) {
            console.error('No access token found while getting exchange code');
            console.error(r);
        }
        return {
            access_token: r.access_token,
            refresh_token: r.refresh_token,
            expires_at: r.expires_at,
            refresh_expires_at: r.refresh_expires_at,
        }
    });
}

function getRefreshToken(token) {
    if (typeof token == 'undefined' || !token.hasOwnProperty('refresh_token')) {
        throw "Refresh token undefined";
    }
    console.log("Getting Refresh Token");
    return fetch(OAUTH_TOKEN, {
        headers: {
            "Authorization": "basic " + FortniteToken[3],
             'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: "POST",
        body: querystring.stringify({
            grant_type: "refresh_token",
            refresh_token: token.refresh_token,
            includePerms: true,
        }),
    }).then(r => r.json()).then(r => {
        if (!r.hasOwnProperty('access_token')) {
            console.error('No access token found while refreshing');
            console.error(r);
        }
        const accessToken = {
            access_token: r.access_token,
            refresh_token: r.refresh_token,
            expires_at: r.expires_at,
            refresh_expires_at: r.refresh_expires_at,
        };

        fs.writeFileSync("./login.json", JSON.stringify(accessToken));
        return accessToken;
    });
}

async function refreshToken(token) {
    if (!token) return getLoginToken();
    let expire = new Date(token.expires_at);
    expire.setUTCHours(expire.getUTCHours() - 1);
    let refreshExpire = new Date(token.refresh_expires_at);
    refreshExpire.setUTCHours(refreshExpire.getUTCHours() - 1);
    if (Date.now() < expire) return token;
    if (Date.now() < refreshExpire) {
        return getRefreshToken(token);
    }
    return getLoginToken();
}

// Older grant_type: password login flow
/*async function getLoginToken() {
    let launcherToken = await getAccessToken();
    let accessCode = await getAccessCode(launcherToken);
    let params = await getExchangeToken(accessCode);
    return params;
}*/

// Backup login flow (Kysune's method)
/*async function getLoginToken() {
    let clientCredentials = await getClientCredentials();
    let xsrfToken = await getXsrfToken(clientCredentials);
    let xsrfCookies = headersToCookies(xsrfToken);
    let exchangeToken = await getExchangeCode(clientCredentials, xsrfCookies);
    let accessToken = await getExchangeToken(exchangeToken);
    return accessToken;
}*/

// Current login flow using epicgames endpoints
async function getLoginToken() {
    console.log("Getting new Login Token");
    let cookieObj = await getCsrfToken();
    let loginResult = await launcherLogin(cookieObj);
    Object.assign(cookieObj, loginResult);
    let exchangeResult = await launcherExchange(cookieObj);
    let accessToken = await getExchangeToken(exchangeResult.code);

    fs.writeFileSync("./login.json", JSON.stringify(accessToken));
    return accessToken;
}

let loginToken = false;
if (fs.existsSync("./login.json")) {
    loginToken = JSON.parse(fs.readFileSync("./login.json"));
}

async function getStoreData(signal) {
    loginToken = await refreshToken(loginToken);
    let requestOptions = {
        headers: {
            "X-EpicGames-Language": "en",
            "Authorization": "bearer " + loginToken.access_token,
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
    // refresh login token so that it doesn't trigger the timeout.
    loginToken = await refreshToken(loginToken);
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
    loginToken = await refreshToken(loginToken);
    return fetch(FORTNITE_KEYCHAIN, {
        headers: {
            "X-EpicGames-Language": "en",
            "Authorization": "bearer " + loginToken.access_token,
        },
        method: "GET",
    }).then(r => r.json());
}

async function refreshLoginToken() {
    loginToken = await refreshToken(loginToken);
}

async function getLatestHotfix() {
     loginToken = await refreshToken(loginToken);
     let fixFiles = await fetch(FORTNITE_CLOUDSTORAGE, {
         headers: {
             "X-EpicGames-Language": "en",
             "Authorization": "bearer " + loginToken.access_token,
         },
         method: "GET",
     }).then(r => r.json());
     let [finalFile] = fixFiles.filter(v => v.filename == "DefaultGame.ini");
     if (!finalFile) return "";
     let finalUrl = FORTNITE_CLOUDSTORAGE + "/" + finalFile.uniqueFilename;
     return fetch(finalUrl, {
         headers: {
             "X-EpicGames-Language": "en",
             "Authorization": "bearer " + loginToken.access_token,
         },
         method: "GET",
     }).then(r => r.text());
}

exports.getLatestHotfix = getLatestHotfix;
exports.getStoreData = getStoreData;
exports.getStoreDataRetry = getStoreDataRetry;
exports.getKeychain = getKeychain;
exports.refreshLoginToken = refreshLoginToken;
