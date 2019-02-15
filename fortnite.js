const fs = require('fs');
const path = require('path');
const { atob } = require('abab');
const { PakExtractor, read_asset, read_texture_to_file, read_pak_key } = require('node-wick');
const { GetItemPaths, AddAsset, ProcessItems } = require('./process');
const { getStoreData, getKeychain } = require('./api');
const { addShopHistory } = require('./db');

var storeData = false;
//storeData = JSON.parse(fs.readFileSync('store.json'));

function RefreshStoreData() {
    return getStoreData().then(store => {
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

async function PrepareStoreAssets(storeData) {
    let storeInfo = await storeData;
    let keyDatas = storeInfo.storefronts
        .filter(v => v.hasOwnProperty('catalogEntries'))
        .reduce((acc, v) => acc.concat(v.catalogEntries), [])
        .filter(v => v.hasOwnProperty('metaInfo') && v.metaInfo.map(e => e.key).includes("EncryptionKey"))
        .map(v => v.metaInfo.filter(e => e.key == 'EncryptionKey').pop().value)
        .reduce((acc, v) => acc.concat(v.split(',').map(guidStringParse)), []);

    try {
        let chainData = await getKeychain();
        keyDatas = keyDatas.concat(chainData.map(guidStringParse));
    } catch (e) {
        console.error(e);
    }

    if (keyDatas.length <= 0) return storeInfo;
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
            return;
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
        let fileAsset = filename.slice(0, -7);
        let asset = false;
        try {
            asset = read_asset('./live/assets/' + fileAsset);
        } catch (e) {
            console.error(e);
            continue;
        }
        let object = asset[0];
        if (object.export_type == "Texture2D") {
            let tPath = './textures/' + fileAsset + '.png';
            if (!fs.existsSync(tPath)) {
                read_texture_to_file('./live/assets/' + fileAsset, tPath);
            }
        }
        AddAsset(object, fileAsset);
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
        id: assetData.id,
        imagePath: assetData.image,
        displayName: assetData.name,
        rarity: assetData.rarity,
        description: assetData.description,
    };
}

function GetAssetData(storeItem, save) {
    const assetList = JSON.parse(fs.readFileSync('./assets.json'));
    try {
        if (storeItem.hasOwnProperty('itemGrants') && storeItem.itemGrants.length > 0) {
            let price = 0;
            if (storeItem.hasOwnProperty('prices') && storeItem.prices.length > 0) {
                price = storeItem.prices[0].finalPrice;
            } else if (storeItem.hasOwnProperty('dynamicBundleInfo') && storeItem.dynamicBundleInfo.hasOwnProperty('bundleItems')) {
                price = storeItem.dynamicBundleInfo.bundleItems.map(v => v.discountedPrice).reduce((acc, v) => acc + v, 0);
            }

            let storeObjs = storeItem.itemGrants.map(v => GetAssetItemData(assetList, v.templateId)).filter(v => v);

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
        let devMatch = /\[VIRTUAL\][1-9]+ x ([\w\d\s]+) for/g;
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
exports.PrepareStoreAssets = PrepareStoreAssets;
