const express = require('express');
const fs = require('fs');
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

function getStore(data, assets, type) {
    return data.storefronts.filter(v => v.name == type).pop().catalogEntries
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

async function GetAssetList() {
    let datas = await Promise.all([GetStoreData('assets.json'), GetStoreData('store.json')]);
    let featuredStore = getStore(datas[1], datas[0], 'BRWeeklyStorefront');
    let dailyStore = getStore(datas[1], datas[0], 'BRDailyStorefront');
    return {
        featured: featuredStore,
        daily: dailyStore,
    };
}

app.get("/api", (req, res) => {
    let data = JSON.parse(fs.readFileSync('./package.json'));
    res.json({
        message: "This is the JohnWick API",
        version: data.version,
    });
});

app.get("/api/assets", (req, res) => {
    GetAssetList().then(data => {
        res.json(data);
    });
});

app.set('trust proxy', true);
app.listen(8061);
