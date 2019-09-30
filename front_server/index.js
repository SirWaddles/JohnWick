const express = require('express');
const fs = require('fs');
const { JWAPIToken } = require('../tokens');
const { UpdateLocale, GetLocaleStrings } = require('./locale');
const bodyparser = require('body-parser');
const app = express();

function getAssetFromId(assets, id) {
    if (!id) return null;
    id = id.toLowerCase();
    return assets.filter(v => v.id == id).pop();
}

function getItemPrice(item) {
    let price = 0;
    if (item.hasOwnProperty('prices') && item.prices.length > 0) {
        price = item.prices[0].finalPrice;
    }
    if (item.hasOwnProperty('dynamicBundleInfo') && item.dynamicBundleInfo.hasOwnProperty('bundleItems')) {
        price = item.dynamicBundleInfo.bundleItems.map(v => v.discountedPrice).reduce((acc, v) => acc + v, 0);
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

function getStore(data, assets, type) {
    let fronts = data.storefronts.filter(v => v.name == type);
    if (fronts.length <= 0) return [];
    return fronts.pop().catalogEntries
    .sort((a, b) => {
        if (a.sortPriority > b.sortPriority) return -1;
        if (a.sortPriority < b.sortPriority) return 1;
        return 0;
    })
    .map(v => ({
        price: getItemPrice(v),
        categories: v.categories,
        itemGrants: v.itemGrants.map(e => e.templateId.split(':')).map(e => ({
            item: getAssetFromId(assets, e[1]),
            type: e[0],
        })),
        displayAsset: getAssetFromId(assets, v.displayAssetPath ? v.displayAssetPath.split('/').pop().split('.').pop() : null),
        banner: getBannerType(v),
    }));
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
    let datas = await Promise.all([GetStoreData('assets.json'), GetStoreData('store.json')]);
    let featuredStore = getStore(datas[1], datas[0], 'BRWeeklyStorefront');
    let dailyStore = getStore(datas[1], datas[0], 'BRDailyStorefront');
    let voteStore = getStore(datas[1], datas[0], 'CommunityVoteWinners');
    let localeData = await GetLocaleStrings(ConsolidateKeys([...featuredStore, ...dailyStore, ...voteStore]), lang_key);
    let now = new Date();
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

app.get("/api/assets/:langkey", (req, res) => {
    GetAssetList(req.params.langkey).then(data => {
        let expire = new Date(data.expires);
        res.append("Cache-Control", "no-store");
        res.append("Expires", expire.toUTCString());
        res.append("Access-Control-Allow-Origin", "http://localhost");
        res.append("Access-Control-Allow-Methods", "GET");
        res.json(data);
    });
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
