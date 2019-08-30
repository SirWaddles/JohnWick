const AssetList = {};

function buildImagePath(path) {
    if (!path) return false;
    path = path.asset_path_name;
    return path.split("/").pop().split(".")[0].toLowerCase() + ".png";
}

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

function findImport(definition) {
    if (!definition) return false;
    return definition.toLowerCase();
}

const AssetProcessors = {
    "FortHeroType": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
    }),
    "AthenaPickaxeItemDefinition": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
        rarity: buildRarity(asset.Rarity),
        series: asset.hasOwnProperty("Series") ? asset.Series : null,
        definition: findImport(asset.WeaponDefinition),
    }),
    "AthenaGliderItemDefinition": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
        rarity: buildRarity(asset.Rarity),
        series: asset.hasOwnProperty("Series") ? asset.Series : null,
    }),
    "AthenaCharacterItemDefinition": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        rarity: buildRarity(asset.Rarity),
        series: asset.hasOwnProperty("Series") ? asset.Series : null,
        definition: findImport(asset.HeroDefinition),
    }),
    "AthenaPetCarrierItemDefinition": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
        rarity: buildRarity(asset.Rarity),
    }),
    "AthenaMusicPackItemDefinition": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
        rarity: buildRarity(asset.Rarity),
    }),
    "AthenaSkyDiveContrailItemDefinition": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
        rarity: buildRarity(asset.Rarity),
    }),
    "AthenaBackpackItemDefinition": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
        rarity: buildRarity(asset.Rarity),
        series: asset.hasOwnProperty("Series") ? asset.Series : null,
    }),
    "AthenaItemWrapDefinition": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
        rarity: buildRarity(asset.Rarity),
        series: asset.hasOwnProperty("Series") ? asset.Series : null,
    }),
    "FortWeaponMeleeItemDefinition": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
        rarity: buildRarity(asset.Rarity),
        series: asset.hasOwnProperty("Series") ? asset.Series : null,
    }),
    "AthenaDanceItemDefinition": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
        rarity: buildRarity(asset.Rarity),
        series: asset.hasOwnProperty("Series") ? asset.Series : null,
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
                import: findImport(asset.TileImage.ResourceObject),
                image: findImport(asset.DetailsImage.ResourceObject) + '.png',
            };
        }
        return {
            // ???
        };
    },
    "FortTokenType": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
        rarity: buildRarity(asset.Rarity),
    }),
    "FortBannerTokenType": asset => ({
        name: asset.DisplayName ? asset.DisplayName : false,
        description: asset.Description ? asset.Description : false,
        image: buildImagePath(asset.LargePreviewImage),
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

function AddAsset(asset, assetName) {
    if (!AssetProcessors.hasOwnProperty(asset.export_type)) return false;
    if (!AssetList.hasOwnProperty(asset.export_type)) AssetList[asset.export_type] = {};
    AssetList[asset.export_type][assetName] = (AssetProcessors[asset.export_type](asset));
}

const ItemList = [];

function ProcessItems() {
    let definitions = Object.assign({}, AssetList.FortHeroType, AssetList.FortWeaponMeleeItemDefinition);

    if (AssetList.hasOwnProperty('FortMtxOfferData') && AssetList.hasOwnProperty('MaterialInstanceConstant')) {
        Object.keys(AssetList.FortMtxOfferData).forEach(itemId => {
            let item = AssetList.FortMtxOfferData[itemId];
            if (!item.hasOwnProperty('import')) return;
            if (AssetList.MaterialInstanceConstant.hasOwnProperty(item.import)) {
                if (AssetList.MaterialInstanceConstant[item.import].hasOwnProperty('images')) {
                    item.image = AssetList.MaterialInstanceConstant[item.import].images.pop();
                }
            }
        });
    }

    let items = Object.assign({}, AssetList.AthenaPickaxeItemDefinition, AssetList.AthenaGliderItemDefinition,
        AssetList.AthenaBackpackItemDefinition, AssetList.AthenaCharacterItemDefinition, AssetList.AthenaItemWrapDefinition, AssetList.AthenaMusicPackItemDefinition, AssetList.AthenaSkyDiveContrailItemDefinition,
        AssetList.AthenaDanceItemDefinition, AssetList.AthenaPetCarrierItemDefinition, AssetList.FortTokenType, AssetList.FortBannerTokenType, AssetList.FortMtxOfferData);

    Object.keys(items).forEach(itemId => {
        let item = items[itemId];
        if (item.hasOwnProperty('definition') && definitions.hasOwnProperty(item.definition) && definitions[item.definition].image) {
            item.image = definitions[item.definition].image;
        }
        item.id = itemId;
    });
    return Object.values(items);
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
    '2dAssets/Music/Season6/PreviewImages',
    '2dAssets/Music/Season7/PreviewImages',
    '2dAssets/Music/Season8/PreviewImages',
    '2dAssets/Music/Season9/PreviewImages',
    '2dAssets/Music/Season10/PreviewImages',
    '2dAssets/Banners/Season9',
    'Athena/Items/Cosmetics/Contrails/',
    'UI/Foundation/Textures/Icons/Skydiving/FX-Trails/',
];

function GetItemPaths(paths) {
    return paths.filter(path => {
        return AssetPaths.map(v => {
            let index = path.path.indexOf(v);
            if (index === -1) return false;
            if (path.path.slice(index + v.length + 1).includes('/')) return false;
            return true;
        }).filter(v => v).length > 0;
    });
}

exports.AssetPaths = AssetPaths;
exports.GetItemPaths = GetItemPaths;
exports.AddAsset = AddAsset;
exports.ProcessItems = ProcessItems;
