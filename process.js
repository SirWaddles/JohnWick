const RarityLevels = {
    "EFortRarity::Common": "Common",
    "EFortRarity::Rare": "Rare",
    "EFortRarity::Epic": "Epic",
    "EFortRarity::Legendary": "Legendary",
};

function buildRarity(rarity) {
    if (!rarity) return "Uncommon";
    return RarityLevels[rarity.toString()];
}

function makeEmptyHashList(data) {
    return data.reduce((acc, v) => Object.assign(acc, {[v]: {}}), {});
}

function isObject(obj) {
    return (!!obj) && (obj.constructor === Object);
}

function findImport(definition) {
    if (!definition) return false;
    if (isObject(definition)) return false;
    return definition[0].toLowerCase();
}

function findAsset(location) {
    if (!location) return false;
    return location.asset_path_name.split("/").pop().split(".")[0].toLowerCase();
}

function buildImagePath(path) {
    if (!path) return false;
    return findAsset(path) + ".png";
}

function processAsset(data) {
    let processed = {};
    if (data.hasOwnProperty('DisplayName')) {
        processed.name = data.DisplayName;
    }
    if (data.hasOwnProperty('Description')) {
        processed.description = data.Description;
    }
    if (data.hasOwnProperty('LargePreviewImage')) {
        processed.image = buildImagePath(data.LargePreviewImage);
    }
    if (data.hasOwnProperty('Series')) {
        processed.series = findImport(data.Series);
    }

    return processed;
}

const AssetProcessors = {
    "FortHeroType": asset => ({}),
    "AthenaPickaxeItemDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
        definition: findImport(asset.WeaponDefinition),
    }),
    "AthenaGliderItemDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "AthenaCharacterItemDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
        definition: findImport(asset.HeroDefinition),
    }),
    "AthenaPetCarrierItemDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "AthenaMusicPackItemDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "AthenaSkyDiveContrailItemDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "AthenaBackpackItemDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "AthenaItemWrapDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "FortWeaponMeleeItemDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "FortWeaponMeleeDualWieldItemDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "AthenaDanceItemDefinition": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "FortItemSeriesDefinition": asset => ({
        image: buildImagePath(asset.BackgroundTexture),
    }),
    "FortMtxOfferData": asset => {
        if (asset.hasOwnProperty('TileImage') && asset.TileImage.hasOwnProperty('ResourceObject')) {
            return {
                import: findImport(asset.TileImage.ResourceObject),
                image: findImport(asset.TileImage.ResourceObject) + '.png',
            };
        }
        if (asset.hasOwnProperty('DetailsImage') && asset.DetailsImage.hasOwnProperty('ResourceObject')) {
            return {
                import: findImport(asset.DetailsImage.ResourceObject),
                image: findImport(asset.DetailsImage.ResourceObject) + '.png',
            };
        }
        return {
            // ???
        };
    },
    "FortTokenType": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "FortBannerTokenType": asset => ({
        rarity: buildRarity(asset.Rarity),
    }),
    "MaterialInstanceConstant": asset => {
        if (asset.hasOwnProperty('TextureParameterValues')) {
            return {
                images: asset.TextureParameterValues.map(v => findImport(v.ParameterValue) + '.png'),
            };
        }
        return {

        };
    },
};

const ItemList = [];
const DefinitionProcessors = [
    'FortHeroType',
    'FortWeaponMeleeItemDefinition',
    'FortWeaponMeleeDualWieldItemDefinition',
];
const FinalProcessors = [
    'AthenaPickaxeItemDefinition',
    'AthenaGliderItemDefinition',
    'AthenaBackpackItemDefinition',
    'AthenaCharacterItemDefinition',
    'AthenaItemWrapDefinition',
    'AthenaMusicPackItemDefinition',
    'AthenaSkyDiveContrailItemDefinition',
    'AthenaDanceItemDefinition',
    'AthenaPetCarrierItemDefinition',
    'FortTokenType',
    'FortBannerTokenType',
    'FortMtxOfferData',
    'FortItemSeriesDefinition',
];

let AssetList = makeEmptyHashList(Object.keys(AssetProcessors));

function AddAsset(asset, assetName) {
    if (!AssetProcessors.hasOwnProperty(asset.export_type)) return false;
    let pAsset = Object.assign(processAsset(asset), AssetProcessors[asset.export_type](asset));
    AssetList[asset.export_type][assetName] = pAsset;
}

function ProcessItems(initial) {
    let definitions = DefinitionProcessors.reduce((acc, v) => Object.assign(acc, AssetList[v]), {});

    for (item in Object.values(AssetList.FortMtxOfferData)) {
        if (!item.hasOwnProperty('import')) continue;
        if (AssetList.MaterialInstanceConstant.hasOwnProperty(item.import)) {
            if (AssetList.MaterialInstanceConstant[item.import].hasOwnProperty('images')) {
                item.image = AssetList.MaterialInstanceConstant[item.import].images.pop();
            }
        }
    }

    let items = FinalProcessors.reduce((acc, v) => Object.assign(acc, AssetList[v]), {});
    let processedItems = [];
    let series = AssetList.FortItemSeriesDefinition;

    for (itemId in items) {
        let item = items[itemId];
        if (item.hasOwnProperty('definition') && definitions.hasOwnProperty(item.definition) && definitions[item.definition].image) {
            item.image = definitions[item.definition].image;
        }
        if (item.hasOwnProperty('series')) {
            if (series.hasOwnProperty(item.series)) {
                item.series_data = series[item.series];
            } else if (typeof initial !== 'undefined') {
                let [series_item] = initial.filter(v => v.id == item.series);
                if (series_item) {
                    item.series_data = series_item;
                }
            }
        }
        item.id = itemId;
        processedItems.push(item);
    }

    return processedItems;
}

const AssetPaths = [
    'Items/Tokens',
    'Athena/Items/Cosmetics/Backpacks',
    'Athena/Items/Cosmetics/Characters',
    'Athena/Items/Cosmetics/Dances',
    'Athena/Items/Cosmetics/Gliders',
    'Athena/Items/Cosmetics/MusicPacks',
    'Athena/Items/Cosmetics/Pickaxes',
    'Athena/Items/Cosmetics/ItemWraps',
    'Athena/Items/Cosmetics/PetCarriers',
    'Athena/Items/Cosmetics/Series',
    'Athena/Items/BannerToken',
    'Athena/Items/Weapons',
    'Athena/Heroes',
    'Catalog/DisplayAssets',
    'UI/Foundation/Textures/BattleRoyale/FeaturedItems/Glider',
    'UI/Foundation/Textures/BattleRoyale/FeaturedItems/Outfit',
    'UI/Foundation/Textures/BattleRoyale/FeaturedItems/Outfit/RenderSwitch_Materials',
    'UI/Foundation/Textures/BattleRoyale/FeaturedItems/Pickaxe',
    'UI/Foundation/Textures/BattleRoyale/FeaturedItems/Sales',
    'UI/Foundation/Textures/BattleRoyale/FeaturedItems/Pets',
    'UI/Foundation/Textures/BattleRoyale/FeaturedItems/Banner',
    'UI/Foundation/Textures/Icons/Wraps/WeaponRenders/StaticRenders',
    'UI/Foundation/Textures/Icons/Backpacks',
    'UI/Foundation/Textures/Icons/Emotes',
    'UI/Foundation/Textures/Icons/Heroes/Athena/Soldier',
    'UI/Foundation/Textures/Icons/Skydiving',
    'UI/Foundation/Textures/Icons/Pets',
    'UI/Foundation/Textures/Icons/Weapons/Items',
    'UI/Foundation/Textures/Icons/Wraps',
    'Athena/Items/Cosmetics/Contrails/',
    'UI/Foundation/Textures/Icons/Skydiving/FX-Trails/',
    {path: '2dAssets/Music', subdirs: true},
    {path: '2dAssets/Banners', subdirs: true},
    {path: 'UI/Series/Art', subdirs: true},
];

function GetItemPaths(paths) {
    return paths.filter(path => {
        return AssetPaths.map(v => {
            if (typeof v === 'string') {
                let index = path.path.indexOf(v);
                if (index === -1) return false;
                if (path.path.slice(index + v.length + 1).includes('/')) return false;
                return true;
            }
            if (v.hasOwnProperty('subdirs') && v.subdirs) {
                let index = path.path.indexOf(v.path);
                if (index === -1) return false;
                return true;
            }
            return false;
        }).filter(v => v).length > 0;
    });
}

exports.AssetPaths = AssetPaths;
exports.GetItemPaths = GetItemPaths;
exports.AddAsset = AddAsset;
exports.ProcessItems = ProcessItems;
