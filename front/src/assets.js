import { Store } from 'samsio';
import AssetList from '../assets.json';
import StoreData from '../store.json';

function getAssetFromId(id) {
    return AssetList.filter(v => v.id == id).pop();
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

function getStore(data, type) {
    return data.storefronts.filter(v => v.name == type).pop().catalogEntries
    .sort((a, b) => {
        if (a.sortPriority > b.sortPriority) return -1;
        if (a.sortPriority < b.sortPriority) return 1;
        return 0;
    })
    .map(v => ({
        price: getItemPrice(v),
        categories: v.categories,
        itemGrants: v.itemGrants.map(e => e.templateId.split(':').pop()).map(e => getAssetFromId(e.toLowerCase())),
        displayAsset: v.displayAssetPath ? v.displayAssetPath.split('/').pop().split('.').pop() : null,
    }));
}

async function GetAssetList() {
    let featuredStore = getStore(StoreData, 'BRWeeklyStorefront');
    let dailyStore = getStore(StoreData, 'BRDailyStorefront');
    return {
        featured: featuredStore,
        daily: dailyStore,
    };
}

const AssetStore = new Store();
AssetStore.updateState({
    featured: null,
    daily: null,
});

GetAssetList().then(v => AssetStore.updateState(v));

export default AssetStore;
