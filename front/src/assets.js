import { Store } from 'samsio';

function GetStoreData(dataLink) {
    return fetch("/" + dataLink, {
        method: 'GET',
    }).then(r => r.json());
}

const AssetStore = new Store();
AssetStore.updateState({
    featured: null,
    daily: null,
});

GetStoreData("api/assets").then(v => AssetStore.updateState(v));

export default AssetStore;
