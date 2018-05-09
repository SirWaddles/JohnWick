const Fortnite = require('fortnite-api');
const fs = require('fs');
const path = require('path');
const { ReadAsset } = require('./parse');
const { FortniteToken } = require('./tokens');

var fortniteAPI = new Fortnite(FortniteToken, {
    debug: true,
});

fortniteAPI.login();

var storeData = false;
//storeData = JSON.parse(fs.readFileSync('store.json'));

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
            var upak = ReadAsset('resources/items/' + asset[1]);
            if (storeItem.hasOwnProperty('displayAssetPath')) {
                var components = path.basename(storeItem.displayAssetPath).split('.');
                var upak2 = ReadAsset('resources/assets/' + components[0]);
                return {
                    imagePath: upak2.DetailsImage.ResourceObject.Package.OuterIndex.Package.ObjectName.toString(),
                    displayName: upak.DisplayName.toString(),
                    price: price,
                };
            }
            if (upak.hasOwnProperty('HeroDefinition')) {
                asset = upak.HeroDefinition.Package.OuterIndex.Package.ObjectName.toString();
                var upak2 = ReadAsset('resources/definitions' + asset);
                return {
                    imagePath: upak2.LargePreviewImage.toString(),
                    displayName: upak.DisplayName.toString(),
                    price: price,
                }
            }
            if (upak.hasOwnProperty('WeaponDefinition')) {
                asset = upak.WeaponDefinition.Package.OuterIndex.Package.ObjectName.toString();
                var upak2 = ReadAsset('resources/definitions' + asset);
                return {
                    imagePath: upak2.LargePreviewImage.toString(),
                    displayName: upak.DisplayName.toString(),
                    price: price,
                }
            }
            if (upak.hasOwnProperty('LargePreviewImage')) {
                return {
                    imagePath: upak.LargePreviewImage.toString(),
                    description: upak.Description.toString(),
                    displayName: upak.DisplayName.toString(),
                    price: price,
                }
            }
        }
    } catch (error) {
        console.error(error);
        return {
            imagePath: false,
            displayName: storeItem.devName,
            price: storeItem.prices[0].finalPrice,
        };
    }
    return false;
}

exports.GetAssetData = GetAssetData;
exports.GetStoreData = GetStoreData;
exports.GetStoreItems = GetStoreItems;
exports.GetStoreInfo = GetStoreInfo;
