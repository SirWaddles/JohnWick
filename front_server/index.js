const express = require('express');
const fs = require('fs');
const { JWAPIToken } = require('../tokens');
const { UpdateLocale, GetLocaleStrings, GetAppearances } = require('./db');
const bodyparser = require('body-parser');
const app = express();

async function getAssetFromId(assets, id) {
    if (!id) return null;
    id = id.toLowerCase();
    let asset = assets.filter(v => v.id == id).pop();
    if (!asset) return null;
    return Object.assign({}, asset, {
        appearances: await GetAppearances(id),
    });
}

function getItemPrice(item) {
    let price = 0;
    if (item.hasOwnProperty('prices') && item.prices.length > 0) {
        price = item.prices[0].finalPrice;
    }
    if (item.hasOwnProperty('dynamicBundleInfo') && item.dynamicBundleInfo.hasOwnProperty('bundleItems')) {
        price = item.dynamicBundleInfo.bundleItems.map(v => v.discountedPrice).reduce((acc, v) => acc + v, 0);
        if (item.dynamicBundleInfo.hasOwnProperty('discountedBasePrice')) {
            price += item.dynamicBundleInfo.discountedBasePrice;
        }
    }
    return price;
}

function getBannerType(item) {
    if (!item.hasOwnProperty("meta")) {
        return null;
    }
    if (!item.meta.hasOwnProperty("BannerOverride")) {
        return null;
    }
    return item.meta.BannerOverride;
}

function getStore(data, assets, types) {
    let fronts = data.storefronts.filter(v => types.includes(v.name));
    if (fronts.length <= 0) return [];
    let items = fronts.reduce((acc, v) => acc.concat(v.catalogEntries), []);
    return Promise.all(items
    .sort((a, b) => {
        if (a.sortPriority > b.sortPriority) return -1;
        if (a.sortPriority < b.sortPriority) return 1;
        return 0;
    })
    .map(async v => ({
        price: getItemPrice(v),
        categories: v.categories,
        itemGrants: await Promise.all(v.itemGrants.map(e => e.templateId.split(':')).map(async e => ({
            item: await getAssetFromId(assets, e[1]),
            type: e[0],
        }))),
        displayAsset: await getAssetFromId(assets, v.displayAssetPath ? v.displayAssetPath.split('/').pop().split('.').pop() : null),
        banner: getBannerType(v),
    })));
}

function GetStoreData(dataLink) {
    return new Promise((resolve, reject) => {
        fs.readFile("../" + dataLink, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(JSON.parse(data));
        });
    });
}

function ConsolidateKeys(assets) {
    return assets
        .map(v => v.itemGrants)
        .reduce((acc, v) => acc.concat(v), [])
        .filter(v => v.hasOwnProperty('item') && v.item)
        .map(v => [v.item.name.key, v.item.description.key])
        .reduce((acc, v) => acc.concat(v), []);
}

async function GetAssetList(lang_key) {
    let now = new Date();
    let datas = await Promise.all([GetStoreData('assets.json'), GetStoreData('store.json')]);
    let featuredStore = await getStore(datas[1], datas[0], ['BRWeeklyStorefront', 'BRSpecialFeatured']);
    let dailyStore = await getStore(datas[1], datas[0], ['BRDailyStorefront', 'BRSpecialDaily']);
    let voteStore = await getStore(datas[1], datas[0], 'CommunityVoteWinners');
    let localeData = await GetLocaleStrings(ConsolidateKeys([...featuredStore, ...dailyStore, ...voteStore]), lang_key);
    return {
        featured: featuredStore,
        daily: dailyStore,
        votes: voteStore,
        locales: localeData,
        expires: datas[1].expiration,
        generated: now.toUTCString(),
    };
}

app.use(bodyparser.json({limit: '10mb'}));

app.get("/api", (req, res) => {
    let data = JSON.parse(fs.readFileSync('./package.json'));
    res.json({
        message: "This is the JohnWick API",
        version: data.version,
    });
});

const RateLimits = {};
const SIX_HOURS = 6 * 60 * 60 * 1000;
const MAX_REQUESTS = 10;

app.get("/api/assets/:langkey", async (req, res) => {
    if (!RateLimits.hasOwnProperty(req.ip)) {
        RateLimits[req.ip] = {
            requests: 1,
            lastRequest: new Date(),
        };
    }
    let rates = RateLimits[req.ip];
    let now = new Date();
    rates.lastRequest = now;
    if ((now - rates.lastRequest) < SIX_HOURS) {
        rates.requests += 1;
    } else {
        rates.requests = 1;
    }
    if (rates.requests >= MAX_REQUESTS) {
        console.log("Rate limited: " + req.ip);
        res.json({
            error: "RATE_LIMIT",
            message: "You have exceeded the maximum number of requests. Please try again later",
        });
        return;
    }
    try {
        const assets = await GetAssetList(req.params.langkey);
        let expire = new Date(assets.expires);
        res.append("Cache-Control", "no-store");
        res.append("Expires", expire.toUTCString());
        res.append("Access-Control-Allow-Origin", "http://localhost");
        res.append("Access-Control-Allow-Methods", "GET");
        res.json(assets);
    } catch (e) {
        console.error(e);
        res.json({
            error: 'An unexpected error ocurred. It has been logged though. So uhhh... sorry.',
        });
    }
});

app.post("/api/update_locale", (req, res) => {
    let token = req.get("X-JWAPI-Token");
    if (token !==  JWAPIToken) {
        res.json({
            success: false,
            message: "Authentication Failed",
        });
        return;
    }
    UpdateLocale(req.body.locale, req.body.lang_key).then(r => {
        res.json({
            success: true,
            message: "None",
        });
    }).catch(e => {
        res.json({
            success: false,
            message: e.toString(),
        });
    });
});

app.set('trust proxy', true);
app.listen(8061);
