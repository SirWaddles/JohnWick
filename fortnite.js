const fs = require('fs');
const path = require('path');
const { atob } = require('abab');
const { PakExtractor } = require('john-wick-extra/extract');
const { GetItemPaths, AddAsset, ProcessItems } = require('john-wick-extra/process');
const { ReadAsset, Texture2D } = require('john-wick-extra/parse');
const { getStoreData } = require('./api');

var storeData = false;
//storeData = JSON.parse(fs.readFileSync('store.json'));

function RefreshStoreData() {
    return getStoreData().then(store => {
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

// from https://stackoverflow.com/questions/39460182/decode-base64-to-hexadecimal-string-with-javascript
function base64ToBase16(base64) {
  return atob(base64)
      .split('')
      .map(function (aChar) {
        return ('0' + aChar.charCodeAt(0).toString(16)).slice(-2);
      })
     .join('');
}
// *

function BuildPakMap() {
    return fs.readdirSync('./live/paks/', 'utf8').map(v => {
        let extractor = new PakExtractor('./live/paks/' + v);
        extractor.readHeader();
        return {
            file: v,
            guid: extractor.header.EncryptionKeyGuid.toString(),
            extractor: extractor,
        };
    });
}

async function PrepareStoreAssets(storeData) {
    let storeInfo = await storeData;
    let keyDatas = storeInfo.storefronts
        .filter(v => v.hasOwnProperty('catalogEntries'))
        .reduce((acc, v) => acc.concat(v.catalogEntries), [])
        .filter(v => v.hasOwnProperty('metaInfo') && v.metaInfo.map(e => e.key).includes("EncryptionKey"))
        .map(v => v.metaInfo.filter(e => e.key == 'EncryptionKey').pop().value)
        .reduce((acc, v) => acc.concat(v.split(',').map(e => e.split(':')).map(e => ({guid: e[0].toLowerCase(), key: base64ToBase16(e[1]), asset: e[2]}))), []);

    if (keyDatas.length <= 0) return storeInfo;
    let guidList = keyDatas.map(v => v.guid);
    let pakMap = BuildPakMap().filter(v => guidList.includes(v.guid));
    let assetFiles = [];
    pakMap.forEach(v => {
        v.extractor.replaceKey(keyDatas.filter(e => e.guid == v.guid).pop().key);
        v.extractor.readIndex();
        let paths = GetItemPaths(v.extractor.getPaths());
        for (let i = 0; i < paths.length; i++) {
            let filepath = paths[i];
            let filename = filepath.split('/').pop().toLowerCase();
            let file = v.extractor.getFileFromPath(filepath);
            fs.writeFileSync('./live/assets/' + filename, file);
            assetFiles.push(filename);
        }
    });

    for (let i = 0; i < assetFiles.length; i++) {
        let filename = assetFiles[i];
        if (filename.endsWith('.uexp')) continue;
        let fileAsset = filename.slice(0, -7);
        let asset = ReadAsset('./live/assets/' + fileAsset);
        if (asset instanceof Texture2D) {
            let tPath = './textures/' + fileAsset + '.png';
            await asset.textures.pop().writeFile(tPath);
        }
        AddAsset(asset, fileAsset);
    }

    let assets = ProcessItems();
    let newIds = assets.map(v => v.id);
    let currentAssetList = JSON.parse(fs.readFileSync('./assets.json')).filter(v => !newIds.includes(v.id));
    currentAssetList = currentAssetList.concat(assets);
    fs.writeFileSync('./assets.json', JSON.stringify(currentAssetList));

    return storeInfo;
}

function GetAssetItemData(assetList, assetKey) {
    let assetPath = assetKey.split(':');
    let [assetData] = assetList.filter(v => v.id == assetPath[1]);
    if (!assetData) return false;
    return {
        imagePath: assetData.image,
        displayName: assetData.name,
        rarity: assetData.rarity,
        description: assetData.description,
    };
}

function GetAssetData(storeItem) {
    const assetList = JSON.parse(fs.readFileSync('./assets.json'));
    try {
        if (storeItem.hasOwnProperty('itemGrants') && storeItem.itemGrants.length > 0) {
            let price = 0;
            if (storeItem.hasOwnProperty('prices') && storeItem.prices.length > 0) {
                price = storeItem.prices[0].finalPrice;
            } else if (storeItem.hasOwnProperty('dynamicBundleInfo') && storeItem.dynamicBundleInfo.hasOwnProperty('bundleItems')) {
                price = storeItem.dynamicBundleInfo.bundleItems.map(v => v.discountedPrice).reduce((acc, v) => acc + v, 0);
            }

            let storeObjs = storeItem.itemGrants.map(v => GetAssetItemData(assetList, v.templateId));

            if (storeObjs.length <= 0) throw "No asset found for " + storeItem.devName;
            let storeObj = storeObjs.shift();
            storeObj.price = price;
            storeObj.extraItems = storeObjs;

            if (storeItem.hasOwnProperty('displayAssetPath')) {
                let daPath = path.basename(storeItem.displayAssetPath).split('.')[0].toLowerCase();
                let [daAsset] = assetList.filter(v => v.id == daPath);
                if (daAsset && fs.existsSync('textures/' + daAsset.image)) storeObj.imagePath = daAsset.image;
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
exports.PrepareStoreAssets = PrepareStoreAssets;
