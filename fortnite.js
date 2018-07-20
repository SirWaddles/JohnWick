const fs = require('fs');
const path = require('path');

const Fortnite = require('fortnite-api');
const { FortniteToken } = require('./tokens');

var fortniteAPI = new Fortnite(FortniteToken, {
    debug: true,
});

fortniteAPI.login();

var storeData = false;
//storeData = JSON.parse(fs.readFileSync('store.json'));

const assetList = JSON.parse(fs.readFileSync('./assets.json'));

function RefreshStoreData() {
    return fortniteAPI.getStore('en').then(store => {
        fs.writeFileSync('store.json', JSON.stringify(store));
        storeData = store;
        return store;
    });
}

function GetStoreData() {
    //return Promise.resolve(storeData);
    if (!storeData) return RefreshStoreData();
    var now = new Date();
    var expires = new Date(storeData.expiration);
    if (now > expires) return RefreshStoreData();
    return Promise.resolve(storeData);
}

function GetStoreItems(storeData) {
    return storeData.storefronts.filter(v => v.name == 'BRDailyStorefront' || v.name == 'BRWeeklyStorefront').map(v => v.catalogEntries).reduce((acc, v) => acc.concat(v), []).map(v => v.devName);
}

function GetStoreInfo(storeData) {
    return storeData.storefronts.filter(v => v.name == 'BRDailyStorefront' || v.name == 'BRWeeklyStorefront')
        .map(v => v.catalogEntries)
        .reduce((acc, v) => acc.concat(v), []);
}

function GetAssetData(storeItem) {
    try {
        if (storeItem.hasOwnProperty('itemGrants') && storeItem.itemGrants.length > 0) {
            var price = storeItem.prices[0].finalPrice;
            var asset = storeItem.itemGrants[0].templateId.split(':');
            let [assetData] = assetList.filter(v => v.id == asset[1]);
            if (!assetData) throw asset + " not found";

            let storeObj = {
                imagePath: assetData.image,
                displayName: assetData.name,
                price: price,
                rarity: assetData.rarity,
                description: assetData.description,
            };

            if (storeItem.hasOwnProperty('displayAssetPath')) {
                let daPath = path.basename(storeItem.displayAssetPath).split('.')[0].toLowerCase();
                let [daAsset] = assetList.filter(v => v.id == daPath);
                if (daAsset) storeObj.imagePath = daAsset.image;
            }

            return storeObj;
        }
    } catch (error) {
        console.error(error);
        return {
            imagePath: false,
            displayName: storeItem.devName,
            price: storeItem.prices[0].finalPrice,
            rarity: false,
        };
    }
    return false;
}

function GetChangeData(changeItem) {
    return {
        imagePath: changeItem.image,
        displayName: changeItem.name,
        rarity: changeItem.rarity,
        description: changeItem.description,
    };
}

function GetChangeItems() {
    if (!fs.existsSync('changelist.json')) return [];
    return JSON.parse(fs.readFileSync('changelist.json')).map(GetChangeData);
}

exports.GetChangeItems = GetChangeItems;
exports.GetAssetData = GetAssetData;
exports.GetStoreData = GetStoreData;
exports.GetStoreItems = GetStoreItems;
exports.GetStoreInfo = GetStoreInfo;
