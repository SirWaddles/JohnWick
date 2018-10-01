const fs = require('fs');
const Fortnite = require('./fortnite');
const { createCanvas, loadImage, registerFont } = require('canvas');

registerFont('resources/fonts/LuckiestGuy-Regular.ttf', { family: 'Luckiest Guy'});
registerFont('resources/fonts/OpenSans-Regular.ttf', { family: 'Open Sans'});

const RarityColours = {
    'Common': ['#bebebe','#646464'],
    'Uncommon': ['#60aa3a','#175117'],
    'Rare': ['#49acf2','#143977'],
    'Epic': ['#b15be2','#4b2483'],
    'Legendary': ['#d37841','#78371d'],
};

function GetWrappedString(ctx, string, width) {
    var words = string.split(' ');
    var writeStrings = [];
    var writeString = '';
    for (var i=0; i < words.length; i++) {
        var metr = ctx.measureText(writeString + ' ' + words[i]);
        if (metr.width > width) {
            if (writeString.length > 0) writeStrings.push(writeString);
            writeString = words[i];
            continue;
        }
        writeString += (i == 0 ? '' : ' ') + words[i];
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

function CreateImageTile(stData) {
    var rows = Math.min(stData.length, Math.round(Math.sqrt(stData.length)));
    var cols = Math.ceil(stData.length / rows);
    var canvas = createCanvas(512 * cols, 512 * rows);
    var ctx = canvas.getContext('2d');

    let vBucksIcon = loadImage('resources/images/vbucks.png');

    return vBucksIcon.then(vBuckImage => Promise.all(stData.map((v, idx) => {
        var row = Math.floor(idx / cols);
        var col = idx % cols;
        var xOff = 512 * col;
        var yOff = 512 * row;

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';

        var filePath = v.imagePath;
        if (filePath) {
            filePath = 'textures/' + filePath;
        }
        if (!filePath || !fs.existsSync(filePath)) {
            return Promise.resolve(true);
        }
        return loadImage(filePath).then(image => {
            if (v.rarity) {
                var gradient = ctx.createRadialGradient(xOff + 256, yOff + 256, 128, xOff + 256, yOff + 256, 384);
                gradient.addColorStop(0, RarityColours[v.rarity][0]);
                gradient.addColorStop(1, RarityColours[v.rarity][1]);
                ctx.fillStyle = gradient;
                ctx.fillRect(xOff, yOff, 512, 512);
            }
            ctx.drawImage(image, xOff, yOff, 512, 512);
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
            }

            if (v.hasOwnProperty('price') && v.price) {
                ctx.textAlign = 'right';
                ctx.font = '24pt "Luckiest Guy"';
                ctx.drawImage(vBuckImage, xOff + 468, yOff + 468, 32, 32);
                ctx.fillText(v.price, xOff + 460, yOff + 495);
                ctx.strokeText(v.price, xOff + 460, yOff + 495);


            }
        });
    }))).then(v => canvas.toBuffer());
}

function GetStoreImages() {
    return Fortnite.GetStoreData().then(Fortnite.PrepareStoreAssets).then(data => {
        var storeInfo = Fortnite.GetStoreInfo(data);
        return CreateImageTile(storeInfo.map(Fortnite.GetAssetData));
    }).catch(e => console.error(e));
}

function GetChangeImage() {
    return CreateImageTile(Fortnite.GetChangeItems());
}

exports.GetStoreImages = GetStoreImages;
exports.GetChangeImage = GetChangeImage;
