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
    locales: null,
});

let params = (new URL(document.location)).searchParams;
let lang = params.get("lang");
if (!lang) lang = "en";

GetStoreData("api/assets/" + lang).then(v => AssetStore.updateState(v));

export default AssetStore;
