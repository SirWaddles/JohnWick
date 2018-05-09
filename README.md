# JohnWick
A Discord bot that posts the contents of the Fortnite shop.

## Extracted resources
Most of the files in the `resources/` folder are extracted from Fortnite itself. The structure is a bit messy based on some of the limited connections between data I was able to make.

`resources/assets/` contains all DisplayAsset files (these are usually specific to the Featured Items in the store) contained within a single folder instead of the internal hierarchy.

`resources/items/` contains the asset files for the items you can find in the shop. I've also put these in a single folder, and lower-cased all the filenames.

`resources/definitions/` contains the item details, which does follow the internal hierarchy, so an example path would be `resources/definitions/Game/Athena/Heroes/HID_001_Athena_Commando_F`

`resources/textures/` contains the actual textures and icons from the game, converted into PNG format. These files do follow the internal hierarchy.

`resources/fonts/` just has the Luckiest Guy font from Google Fonts. I just needed somewhere to put it. I know Fortnite uses Burbank.
