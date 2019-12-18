const fs = require('fs');
const path = require('path');
const { atob } = require('abab');
const { PakExtractor, Package, read_texture_to_file, read_pak_key } = require('node-wick');
const { GetItemPaths, AddAsset, ProcessItems } = require('./process');
const { getStoreDataRetry, getKeychain, getLatestHotfix } = require('./api');
const { addShopHistory, getLocaleStrings, insertLocaleString } = require('./db');
const { ReadConfig } = require('./config');

var storeData = false;
//storeData = JSON.parse(fs.readFileSync('store.json'));

var lastMsgTime = null;

function StampedLog(message) {
    let time = new Date();
    let timeStr = time.getUTCHours() + ":" + time.getUTCMinutes() + ":" + time.getUTCSeconds() + "-" + time.getUTCMilliseconds();
    message = "[" + timeStr + "] " + message;
    if (lastMsgTime) {
        let timeDiff = time.getTime() - lastMsgTime.getTime();
        if (timeDiff < 30 * 60 * 1000) {
            message += " (" + (timeDiff) + "ms)";
        }
    }
    lastMsgTime = time;
    console.log(message);
}

function RefreshStoreData() {
    return getStoreDataRetry().then(store => {
        fs.writeFileSync('store.json', JSON.stringify(store));
        storeData = store;
        if (!storeData.hasOwnProperty('storefronts')) {
            console.error(storeData);
            throw "Invalid store found";
        }
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

const StoreNames = [
    'BRDailyStorefront',
    'BRWeeklyStorefront',
    'CommunityVoteWinners',
    'BRSpecialDaily',
    'BRSpecialFeatured',
];

function GetStoreItems(storeData) {
    return storeData.storefronts.filter(v => StoreNames.includes(v.name)).map(v => v.catalogEntries).reduce((acc, v) => acc.concat(v), []).map(v => v.devName);
}

function GetStoreInfo(storeData) {
    return storeData.storefronts.filter(v => StoreNames.includes(v.name))
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
        let filepath = './live/paks/' + v;
        return {
            file: v,
            filepath: filepath,
            guid: read_pak_key(filepath),
        };
    });
}

function guidStringParse(str) {
    let e = str.split(':');
    return {guid: e[0].toLowerCase(), key: base64ToBase16(e[1]), asset: e[2]};
}

async function PrepareStoreAssets(storeList, assetList) {
    StampedLog("Decrypting Assets");
    let keyDatas = storeList.slice()
        .filter(v => v.hasOwnProperty('metaInfo') && v.metaInfo.map(e => e.key).includes("EncryptionKey"))
        .map(v => v.metaInfo.filter(e => e.key == 'EncryptionKey').pop().value)
        .reduce((acc, v) => acc.concat(v.split(',').map(guidStringParse)), []);

    let currentAssetList = JSON.parse(fs.readFileSync('./assets.json'));
    let currentAssetIds = currentAssetList.map(v => v.id);

    // Calculate which assets we need keys for (that are not already in the shop response)
    let requiredAssets = storeList
        .filter(v => !(v.hasOwnProperty('metaInfo') && v.metaInfo.map(e => e.key).includes("EncryptionKey")))
        .reduce((acc, v) => acc.concat(v.itemGrants), [])
        .map(v => v.templateId.split(':')[1].toLowerCase())
        .filter(v => !currentAssetIds.includes(v));

    // If we still have some assets that don't have an assigned key, check the keychain
    if (requiredAssets.length > 0) {
        try {
            let chainData = await getKeychain();
            StampedLog("Keychain retreived");
            keyDatas = keyDatas.concat(chainData.map(guidStringParse));
        } catch (e) {
            console.error(e);
        }
    }

    if (keyDatas.length <= 0) {
        StampedLog("Nothing to decrypt");
        return assetList;
    }
    let guidList = keyDatas.map(v => v.guid);
    let pakMap = BuildPakMap().filter(v => guidList.includes(v.guid));
    let assetFiles = [];
    pakMap.forEach(v => {
        let pakKey = keyDatas.filter(e => e.guid == v.guid).pop().key;
        let extractor = false;
        try {
            extractor = new PakExtractor(v.filepath, pakKey);
        } catch (e) {
            console.error(e);
            return assetList;
        }

        let paths = extractor.get_file_list().map((v, idx) => ({
            path: v,
            index: idx,
        }));
        paths = GetItemPaths(paths);
        for (let i = 0; i < paths.length; i++) {
            let filepath = paths[i];
            let filename = filepath.path.split('/').pop().toLowerCase();
            assetFiles.push(filename);
            if (fs.existsSync('./live/assets/' + filename)) continue;
            let file = extractor.get_file(filepath.index);
            fs.writeFileSync('./live/assets/' + filename, file);
        }
    });

    for (let i = 0; i < assetFiles.length; i++) {
        let filename = assetFiles[i];
        if (filename.endsWith('.uexp')) continue;
        if (filename.endsWith('.ubulk')) continue;
        let fileAsset = filename.slice(0, -7);
        let asset = false;
        try {
            asset = new Package('./live/assets/' + fileAsset);
        } catch (e) {
            console.error(e);
            continue;
        }
        let object = asset.get_data()[0];
        if (object.export_type == "Texture2D") {
            let tPath = './textures/' + fileAsset + '.png';
            if (!fs.existsSync(tPath)) {
                read_texture_to_file('./live/assets/' + fileAsset, tPath);
            }
        }
        AddAsset(object, fileAsset);
    }

    let assets = ProcessItems(assetList);
    let newIds = assets.map(v => v.id);
    currentAssetList = currentAssetList.filter(v => !newIds.includes(v.id)).concat(assets);
    fs.writeFileSync('./assets.json', JSON.stringify(currentAssetList));
    return currentAssetList;
}

function GetAssetKeys(assetList, assetKey) {
    let assetPath = assetKey.split(':');
    let [assetData] = assetList.filter(v => v.id == assetPath[1]);
    if (!assetData) return false;
    return [assetData.name, assetData.description];
}

async function ResolveLocaleDB(storeData, lang_key) {
    const assetList = JSON.parse(fs.readFileSync('./assets.json'));
    let items = storeData
        .map(v => v.itemGrants)
        .reduce((acc, v) => acc.concat(v), [])
        .map(v => GetAssetKeys(assetList, v.templateId))
        .reduce((acc, v) => acc.concat(v), [])
        .map(v => v.key)
        .filter(v => v);
    return getLocaleStrings(items, lang_key);
}

function FindLocaleString(ftext, locales) {
    let strs = locales.filter(v => v.key == ftext.key);
    if (strs.length <= 0) return ftext.string;
    return strs[0].string;
}

function GetAssetItemData(assetList, assetKey, locales) {
    let assetPath = assetKey.split(':');
    let [assetData] = assetList.filter(v => v.id == assetPath[1]);
    if (!assetData) return false;
    return {
        id: assetData.id,
        imagePath: assetData.image,
        displayName: FindLocaleString(assetData.name, locales),
        rarity: assetData.rarity,
        description: FindLocaleString(assetData.description, locales),
        series: assetData.series_data ? assetData.series_data.image : false,
    };
}

async function UpdateLocaleInformation() {
    let hotfix = await getLatestHotfix();
    let replacements = hotfix
        .split("\n")
        .filter(v => v.startsWith("+TextReplacements"))
        .map(v => v.slice(18))
        .map(v => ReadConfig({str: v}));
    for (replacement of replacements) {
        let namespace = replacement.namespace;
        if (!namespace) namespace = "";
        if (!replacement.hasOwnProperty('LocalizedStrings')) continue;
        for (lclString of replacement.LocalizedStrings) {
            await insertLocaleString(namespace, replacement.Key, lclString[0], lclString[1]);
        }
    }
    console.log("Update Complete");
}

function GetCurrentAssetList() {
    return JSON.parse(fs.readFileSync('./assets.json'));
}

function GetAssetData(storeItem, save, locales, assetList) {
    try {
        if (storeItem.hasOwnProperty('itemGrants') && storeItem.itemGrants.length > 0) {
            let price = 0;
            if (storeItem.hasOwnProperty('prices') && storeItem.prices.length > 0) {
                price = storeItem.prices[0].finalPrice;
            } else if (storeItem.hasOwnProperty('dynamicBundleInfo') && storeItem.dynamicBundleInfo.hasOwnProperty('bundleItems')) {
                price = storeItem.dynamicBundleInfo.bundleItems.map(v => v.discountedPrice).reduce((acc, v) => acc + v, 0);
                if (storeItem.dynamicBundleInfo.hasOwnProperty('discountedBasePrice'))
                    price += storeItem.dynamicBundleInfo.discountedBasePrice;
            }

            let storeObjs = storeItem.itemGrants.map(v => GetAssetItemData(assetList, v.templateId, locales)).filter(v => v);

            if (storeObjs.length <= 0 || !storeObjs) throw "No asset found for " + storeItem.devName;
            let storeObj = storeObjs.shift();
            storeObj.price = price;
            storeObj.extraItems = storeObjs;

            if (save && storeObj.hasOwnProperty('id')) addShopHistory(storeObj.id);

            if (storeItem.hasOwnProperty('displayAssetPath')) {
                let daPath = path.basename(storeItem.displayAssetPath).split('.')[0].toLowerCase();
                let [daAsset] = assetList.filter(v => v.id == daPath);
                if (daAsset && fs.existsSync('textures/' + daAsset.image)) storeObj.imagePath = daAsset.image;
            }

            return storeObj;
        }
    } catch (error) {
        console.log(error);
        let devMatch = /\[VIRTUAL\][1-9]+ x (.+) for/g;
        let result = devMatch.exec(storeItem.devName);
        return {
            id: 'error_asset',
            imagePath: false,
            displayName: result[1] ? result[1] : storeItem.devName,
            price: storeItem.prices[0].finalPrice,
            rarity: 'Uncommon',
        };
    }
    return false;
}

exports.GetAssetData = GetAssetData;
exports.GetStoreData = GetStoreData;
exports.GetStoreItems = GetStoreItems;
exports.GetStoreInfo = GetStoreInfo;
exports.UpdateLocaleInformation = UpdateLocaleInformation;
exports.ResolveLocaleDB = ResolveLocaleDB;
exports.PrepareStoreAssets = PrepareStoreAssets;
exports.GetCurrentAssetList = GetCurrentAssetList;
exports.StampedLog = StampedLog;
