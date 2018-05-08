const fs = require('fs');
const Fortnite = require('./fortnite');
const { createCanvas, loadImage, registerFont } = require('canvas');

registerFont('resources/fonts/LuckiestGuy-Regular.ttf', { family: 'Luckiest Guy'});

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
        writeString += ' ' + words[i];
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
    stData = stData.map(Fortnite.GetAssetData);
    var rows = Math.ceil(stData.length / 3);
    var cols = 3;
    var canvas = createCanvas(512 * cols, 512 * rows);
    var ctx = canvas.getContext('2d');

    return Promise.all(stData.map((v, idx) => {
        var row = Math.floor(idx / cols);
        var col = idx % cols;
        var xOff = 512 * col;
        var yOff = 512 * row;

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';

        var filePath = v.imagePath;
        if (filePath) {
            filePath = 'resources/textures' + filePath.split('.')[0] + '.png';
        }
        if (!filePath || !fs.existsSync(filePath)) {
            ctx.font = '24pt "Luckiest Guy"';
            var writeStrings = GetWrappedString(ctx, v.displayName, 512);
            writeStrings.forEach((v, idx) => {
                ctx.fillText(v, xOff + 256, yOff + 500 + (idx * 25) - (writeStrings.length * 25));
                ctx.strokeText(v, xOff + 256, yOff + 500 + (idx * 25) - (writeStrings.length * 25));
            });
            ctx.font = '14pt "Luckiest Guy"';
            ctx.fillText(v.price, xOff + 256, yOff + 500);
            ctx.strokeText(v.price, xOff + 256, yOff + 500);
            return Promise.resolve(true);
        }
        return loadImage(filePath).then(image => {
            ctx.drawImage(image, xOff, yOff, 512, 512);

            ctx.font = '24pt "Luckiest Guy"';
            ctx.fillText(v.displayName, xOff + 256, yOff + 475);
            ctx.strokeText(v.displayName, xOff + 256, yOff + 475);
            ctx.font = '14pt "Luckiest Guy"';
            ctx.fillText(v.price, xOff + 256, yOff + 500);
            ctx.strokeText(v.price, xOff + 256, yOff + 500);
        });
    })).then(v => canvas.toBuffer());
}

function GetStoreImages() {
    return Fortnite.GetStoreData().then(data => {
        var storeInfo = Fortnite.GetStoreInfo(data);
        return CreateImageTile(storeInfo);
    }).catch(e => console.error(e));
}

/*GetStoreImages().then(v => {
    fs.writeFileSync('image.png', v);
});*/

exports.GetStoreImages = GetStoreImages;
