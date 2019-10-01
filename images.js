const fs = require('fs');
const Fortnite = require('./fortnite');
const Canvas = require('canvas');
const { getLastAppeared, getAppearanceCount } = require('./db');
const moment = require('moment');

Canvas.registerFont('resources/fonts/LuckiestGuy-Regular.ttf', { family: 'Luckiest Guy'});
Canvas.registerFont('resources/fonts/OpenSans-Regular.ttf', { family: 'Open Sans'});

const RarityColours = {
    'Common': {
        colours: ['#bebebe','#646464'],
    },
    'Uncommon': {
        colours: ['#60aa3a','#175117'],
    },
    'Rare': {
        colours: ['#49acf2','#143977'],
    },
    'Epic': {
        colours: ['#b15be2','#4b2483'],
    },
    'Legendary': {
        colours: ['#d37841','#78371d'],
    },
};

const SeriesColours = {
    'MarvelSeries': {
        colours: ['#c53334', '#761b1b'],
    },
    'CUBESeries': {
        background: './series/kevin.png',
    },
    'DCUSeries': {
        background: './series/batman.png',
    },
};

const RarityOrder = {
    'Legendary': 0,
    'Epic': 1,
    'Rare': 2,
    'Uncommon': 3,
    'Common': 4,
};

const PromoImages = {
    1: '1x1.png',
    2: '2x1.png',
    3: '3x1.png',
};

function GetWrappedString(ctx, string, width) {
    var words = string.split(' ').map(v => v.split("\n")).map(j => [].concat(...j.map(e => [{newline: true}, e])).slice(1)).reduce((acc, v) => acc.concat(v), []);
    var writeStrings = [];
    var writeString = '';
    let skipSpace = true;
    for (var i=0; i < words.length; i++) {
        if (words[i].hasOwnProperty('newline')) {
            writeStrings.push(writeString);
            writeString = '';
            skipSpace = true;
            continue;
        }
        var metr = ctx.measureText(writeString + ' ' + words[i]);
        if (metr.width > width) {
            if (writeString.length > 0) writeStrings.push(writeString);
            writeString = words[i];
            continue;
        }
        writeString += (skipSpace ? '' : ' ') + words[i];
        skipSpace = false;
    }
    writeStrings.push(writeString);
    return writeStrings;
}

function ColourToHex(colour) {
    var tag2 = function(x) {
        return Math.floor(x * 255);
    }
    return 'rgba(' + tag2(colour.R) + ', ' + tag2(colour.G) + ', ' + tag2(colour.B) + ', ' + colour.A + ')';
}

async function CreateImageTile(stData) {
    var rows = Math.min(stData.length, Math.round(Math.sqrt(stData.length)));
    var cols = Math.ceil(stData.length / rows);
    var canvas = Canvas.createCanvas(512 * cols, 576 * rows);
    var ctx = canvas.getContext('2d');

    stData.sort((a, b) => {
        let rarityA, rarityB = 5;
        if (a.hasOwnProperty('rarity')) rarityA = RarityOrder[a.rarity];
        if (b.hasOwnProperty('rarity')) rarityB = RarityOrder[b.rarity];
        if (a.hasOwnProperty('series') && SeriesColours.hasOwnProperty(a.series)) rarityA = -1;
        if (b.hasOwnProperty('series') && SeriesColours.hasOwnProperty(b.series)) rarityB = -1;
        if (rarityA < rarityB) {
            return -1;
        }
        if (rarityA > rarityB) {
            return 1;
        }
        return 0;
    });

    let vBuckImage = await Canvas.loadImage('resources/images/vbucks.png');

    await Promise.all(stData.map(async (v, idx) => {
        let lastAppeared = await getLastAppeared(v.id);
        let appearanceCount = await getAppearanceCount(v.id);
        let lastAppearedStr = lastAppeared ? ("Last Appearance: " + moment(lastAppeared).format('Do MMMM')) : "First Appearance";
        var row = Math.floor(idx / cols);
        var col = idx % cols;
        var xOff = 512 * col;
        var yOff = 576 * row;

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';

        var filePath = v.imagePath;
        if (filePath) {
            filePath = 'textures/' + filePath;
        }

        if (v.rarity) {
            let rarityColour = RarityColours[v.rarity];
            if (v.series && SeriesColours.hasOwnProperty(v.series)) {
                rarityColour = SeriesColours[v.series];
            }

            if (rarityColour.hasOwnProperty('colours')) {
                var gradient = ctx.createRadialGradient(xOff + 256, yOff + 256, 128, xOff + 256, yOff + 256, 384);
                gradient.addColorStop(0, rarityColour.colours[0]);
                gradient.addColorStop(1, rarityColour.colours[1]);
                ctx.fillStyle = gradient;
                ctx.fillRect(xOff, yOff, 512, 576);
            }

            if (rarityColour.hasOwnProperty('background')) {
                let bgImage = await Canvas.loadImage(rarityColour.background);
                ctx.drawImage(bgImage, xOff, yOff, 512, 576);
            }
        }

        if (filePath && fs.existsSync(filePath)) {
            let image = await Canvas.loadImage(filePath);
            ctx.drawImage(image, xOff, yOff, 512, 512);
        }

        ctx.fillStyle = "#fff";

        ctx.textAlign = 'center';
        ctx.font = '32pt "Luckiest Guy"';
        ctx.fillText(v.displayName, xOff + 256, yOff + 48);
        ctx.strokeText(v.displayName, xOff + 256, yOff + 48);

        if (v.hasOwnProperty('description') && v.description) {
            ctx.textAlign = 'left';
            ctx.font = '14pt "Open Sans"';
            let writeStrs = GetWrappedString(ctx, v.description, 360);
            writeStrs.forEach((str, idx) => {
                ctx.fillText(str, xOff + 20, yOff + 518 + (idx * 20) - writeStrs.length * 20);
            });
            if (appearanceCount > 0) {
                ctx.fillText("Appearances: " + appearanceCount, xOff + 20, yOff + 530);
            }
            ctx.fillText(lastAppearedStr, xOff + 20, yOff + 550);
        }

        if (v.hasOwnProperty('price') && v.price) {
            ctx.textAlign = 'right';
            ctx.font = '24pt "Luckiest Guy"';
            ctx.drawImage(vBuckImage, xOff + 468, yOff + 468, 32, 32);
            ctx.fillText(v.price, xOff + 460, yOff + 495);
            ctx.strokeText(v.price, xOff + 460, yOff + 495);
        }

        if (v.hasOwnProperty('extraItems')) await Promise.all(v.extraItems.map(async (extraItem, idx) => {
            if (!extraItem) return false;
            let itemImagePath = './textures/' + extraItem.imagePath;
            if (!fs.existsSync(itemImagePath)) return true;
            let itemImage = await Canvas.loadImage(itemImagePath);

            let rarityColour = RarityColours[extraItem.rarity];
            if (v.series && SeriesColours.hasOwnProperty(v.series) && SeriesColours[v.series].hasOwnProperty('colours')) {
                rarityColour = SeriesColours[extraItem.series];
            }
            ctx.fillStyle = rarityColour.colours[0];
            ctx.fillRect(xOff + (idx * 128), yOff + 320, 128, 128);
            ctx.drawImage(itemImage, xOff + (idx * 128), yOff + 320, 128, 128);
        }));
    }));

    let spareTiles = (cols * rows) - stData.length;
    if (PromoImages.hasOwnProperty(spareTiles)) {
        let promoImagePath = PromoImages[spareTiles];
        let promoImage = await Canvas.loadImage('resources/promo_images/' + promoImagePath);
        ctx.drawImage(promoImage, (cols - spareTiles) * 512, (rows - 1) * 576);
    }

    Fortnite.StampedLog("Created Image");
    return new Promise((resolve, reject) => {
        canvas.toBuffer((err, res) => {
            if (err === null) {
                resolve(res);
                return;
            } else {
                reject(err);
                return;
            }
        }, "image/png", {
            compressionLevel: 3,
        });
    });
}

async function GetStoreImages(save) {
    Fortnite.StampedLog("Starting Image Generation");
    let storeData = await Fortnite.GetStoreData();
    let storeInfo = Fortnite.GetStoreInfo(storeData);
    Fortnite.StampedLog("Retrieved Store Data");
    await Fortnite.PrepareStoreAssets(storeInfo);
    Fortnite.StampedLog("Assets Prepared");
    let locales = await Fortnite.ResolveLocaleDB(storeInfo, 'en');
    Fortnite.StampedLog("Fetched Locales");
    return CreateImageTile(storeInfo.map((item) => Fortnite.GetAssetData(item, save, locales)));
}

exports.GetStoreImages = GetStoreImages;
