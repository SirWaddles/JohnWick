const fs = require('fs');

class DataReader {
    constructor(data, context) {
        this.data = data;
        this.context = context;
        this.offset = 0;
    }
    readInt32LE() {
        const result = this.data.readInt32LE(this.offset);
        this.offset += 4;
        return result;
    }
    readUInt32LE() {
        const result = this.data.readUInt32LE(this.offset);
        this.offset += 4;
        return result;
    }
    readUInt16LE() {
        const result = this.data.readUInt16LE(this.offset);
        this.offset += 2;
        return result;
    }
    readInt64LE() {
        const result = this.data.readIntLE(this.offset, 6);
        this.offset += 8;
        return result;
    }
    readData(bytes) {
        const result = this.data.slice(this.offset, this.offset + bytes);
        this.offset += bytes;
        return result;
    }
    readString(length) {
        let result = this.data.toString('utf8', this.offset, this.offset + length);
        this.offset += length;
        if (length > 0) {
            result = result.slice(0, -1);
        }
        return result;
    }
    readWString(length) {
        let result = this.data.toString('utf16le', this.offset, this.offset + length * 2);
        this.offset += length * 2;
        if (length > 0) {
            result = result.slice(0, -1);
        }
        return result;
    }
    readBool() {
        const result = this.data.readInt8(this.offset);
        this.offset += 1;
        return result === 1 ? true : false;
    }
    readInt8() {
        const result = this.data.readInt8(this.offset);
        this.offset += 1;
        return result;
    }
    readUInt8() {
        const result = this.data.readUInt8(this.offset);
        this.offset += 1;
        return result;
    }
    readFloatLE() {
        const result = this.data.readFloatLE(this.offset);
        this.offset += 4;
        return result;
    }
    seek(pos) {
        this.offset = pos;
    }
    skip(length) {
        this.offset += length;
    }
    tell() {
        return this.offset;
    }
}

class FGuid {
    constructor(reader) {
        this.A = reader.readUInt32LE();
        this.B = reader.readUInt32LE();
        this.C = reader.readUInt32LE();
        this.D = reader.readUInt32LE();
    }
}

class FCustomVersion {
    constructor(reader) {
        this.Key = new FGuid(reader);
        this.Version = reader.readInt32LE();
    }
}

class FCustomVersionSet {
    constructor(reader) {
        this.NumElements = reader.readInt32LE();
        this.Elements = [];
        for (let i = 0; i < this.NumElements; i++) {
            this.Elements.push(new FCustomVersion(reader));
        }
    }
}

class FCustomVersionContainer {
    constructor(reader) {
        this.Versions = new FCustomVersionSet(reader);
    }
}

class FString {
    constructor(reader) {
        this.SaveNum = reader.readInt32LE();
        this.Data = reader.readString(this.SaveNum);
    }
    toString() {
        return this.Data;
    }
}

class FGenerationInfo {
    constructor(reader) {
        this.ExportCount = reader.readInt32LE();
        this.NameCount = reader.readInt32LE();
    }
}

class FEngineVersion {
    constructor(reader) {
        this.Major = reader.readUInt16LE();
        this.Minor = reader.readUInt16LE();
        this.Patch = reader.readUInt16LE();
        this.Changelist = reader.readUInt32LE();
        this.Branch = new FString(reader);
    }
}

class TArray {
    constructor(type, reader) {
        this.NewNum = reader.readUInt32LE();
        this.Elements = [];
        for (let i = 0; i < this.NewNum; i++) {
            this.Elements.push(new type(reader));
        }
    }
}

class FCompressedChunk {
    constructor(reader) {
        this.UncompressedOffset = reader.readInt32LE();
        this.UncompressedSize = reader.readInt32LE();
        this.CompressedOffset = reader.readInt32LE();
        this.CompressedSize = reader.readInt32LE();
    }
}

class FPackageFileSummary {
    constructor(reader) {
        this.Tag = reader.readInt32LE();
        this.LegacyFileVersion = reader.readInt32LE();
        this.LegacyUE3Version = reader.readInt32LE();
        this.FileVersionUE4 = reader.readInt32LE();
        this.FileVersionLicenseeUE4 = reader.readInt32LE();
        this.CustomVersionContainer = new FCustomVersionContainer(reader);
        this.TotalHeaderSize = reader.readInt32LE();
        this.FolderName = new FString(reader);
        this.PackageFlags = reader.readUInt32LE();
        this.NameCount = reader.readInt32LE();
        this.NameOffset = reader.readInt32LE();
        this.GatherableTextDataCount = reader.readInt32LE();
        this.GatherableTextDataOffset = reader.readInt32LE();
        this.ExportCount = reader.readInt32LE();
        this.ExportOffset = reader.readInt32LE();
        this.ImportCount = reader.readInt32LE();
        this.ImportOffset = reader.readInt32LE();
        this.DependsOffset = reader.readInt32LE();
        this.StringAssetReferencesCount = reader.readInt32LE();
        this.StringAssetReferencesOffset = reader.readInt32LE();
        this.SearchableNamesOffset = reader.readInt32LE();
        this.ThumbnailTableOffset = reader.readInt32LE();
        this.Guid = new FGuid(reader);
        this.GenerationCount = reader.readInt32LE();
        this.Generations = [];
        for (let i = 0; i < this.GenerationCount; i++) {
            this.Generations.push(new FGenerationInfo(reader));
        }
        this.SavedByEngineVersion = new FEngineVersion(reader);
        this.CompatibleWithEngineVersion = new FEngineVersion(reader);
        this.CompressionFlags = reader.readUInt32LE();
        this.CompressedChunks = new TArray(FCompressedChunk, reader);
        this.PackageSource = reader.readUInt32LE();
        this.AdditionalPackagesToCook = new TArray(FString, reader);
        this.AssetRegistryDataOffset = reader.readInt32LE();
        this.BulkDataStartOffset = reader.readInt32LE();
        this.WorldTileInfoDataOffset = reader.readInt32LE();
        this.ChunkIDs = new TArray(Number, reader);
        this.PreloadDependencyCount = reader.readInt32LE();
        this.PreloadDependencyOffset = reader.readInt32LE();
    }
}

class FNameEntrySerialized
{
    constructor(reader) {
        this.StringLen = reader.readInt32LE();
        if (this.StringLen < 0) {
            this.StringLen = -this.StringLen;
            this.Str = reader.readWString(this.StringLen);
        } else {
            this.Str = reader.readString(this.StringLen);
        }
        this.NonCasePreservingHash = reader.readUInt16LE();
        this.CasePreservingHash = reader.readUInt16LE();
    }
}

class FName {
    constructor(reader) {
        this.NameIndex = reader.readInt32LE();
        this.Number = reader.readInt32LE();
        this._nameMap = reader.context.NameMap;
    }
    toString() {
        return this._nameMap[this.NameIndex].Str;
    }
}

class FPackageIndex {
    constructor(reader) {
        this.Index = reader.readInt32LE();
        this._importMap = reader.context.ImportMap;
    }
    isImport() {
        return this.Index < 0;
    }
    isExport() {
        return this.Index > 0;
    }
    isNull() {
        return this.Index == 0;
    }
    toImport() {
        return -this.Index - 1;
    }
    toExport() {
        return this.Index - 1;
    }
    get Package() {
        if (this.isImport()) {
            return this._importMap[this.toImport()];
        } else if (this.isExport()) {
            return this._importMap[this.toExport()];
        }
    }
}

class FObjectImport {
    constructor(reader) {
        this.ClassPackage = new FName(reader);
        this.ClassName = new FName(reader);
        this.OuterIndex = new FPackageIndex(reader);
        this.ObjectName = new FName(reader);
    }
    toString() {
        let str = this.ClassName.toString() + " " + this.ObjectName.toString();
        if (!this.OuterIndex.isNull()) {
            str += " in " + this.OuterIndex.Package;
        }
        return str;
    }
}

class FObjectExport {
    constructor(reader) {
        this.ClassIndex = new FPackageIndex(reader);
        this.SuperIndex = new FPackageIndex(reader);
        this.TemplateIndex = new FPackageIndex(reader);
        this.OuterIndex = new FPackageIndex(reader);
        this.ObjectName = new FName(reader);
        this.Save = reader.readUInt32LE();
        this.SerialSize = reader.readInt64LE();
        this.SerialOffset = reader.readInt64LE();
        this.bForcedExport = reader.readBool();
        this.bNotForClient = reader.readBool();
        this.bNotForServer = reader.readBool();
        this.PackageGuid = new FGuid(reader);
        this.PackageFlags = reader.readUInt32LE();
    }
    toString() {
        return this.ClassIndex.Package.ObjectName.toString() + " " + this.ObjectName.toString();
    }
}

class FPropertyTag {
    constructor(reader) {
        this.Name = new FName(reader);
        if (this.Name.toString() == "None") {
            return;
        }

        this.Type = new FName(reader);
        this.Size = reader.readInt32LE();
        this.ArrayIndex = reader.readInt32LE();

        const typeStr = this.Type.toString();
        if (typeStr == "StructProperty") {
            this.StructName = new FName(reader);
            this.StructGuid = new FGuid(reader);
        } else if (typeStr == "BoolProperty") {
            this.BoolVal = reader.readBool();
        } else if (typeStr == "ByteProperty" || typeStr == "EnumProperty") {
            this.EnumName = new FName(reader);
        } else if (typeStr == "ArrayProperty") {
            this.InnerType = new FName(reader);
        }

        this.HasPropertyGuid = reader.readBool();
        if (this.HasPropertyGuid) {
            this.PropertyGuid = new FGuid(reader);
        }
    }
    toString() {
        let str = this.Type.toString() + " ";
        if (this.Type.toString() == "StructProperty") {
            str += this.StructName.toString() + " ";
        }
        return str + this.Name.toString() + " (Size = " + this.Size + ")";
    }
}

class FVector2D {
    constructor(reader) {
        this.x = reader.readFloatLE();
        this.y = reader.readFloatLE();
    }
}

class FLinearColor {
    constructor(reader) {
        this.R = reader.readFloatLE();
        this.G = reader.readFloatLE();
        this.B = reader.readFloatLE();
        this.A = reader.readFloatLE();
    }
}

class FGameplayTag {
    constructor(reader) {
        this.TagName = new FName(reader);
    }
}

class FGameplayTagContainer {
    constructor(reader) {
        this.GameplayTags = new TArray(FGameplayTag, reader);
    }
}

class FQuat {
    constructor(reader) {
        this.X = reader.readFloatLE();
        this.Y = reader.readFloatLE();
        this.Z = reader.readFloatLE();
        this.W = reader.readFloatLE();
    }
}

class FVector {
    constructor(reader) {
        this.X = reader.readFloatLE();
        this.Y = reader.readFloatLE();
        this.Z = reader.readFloatLE();
    }
}

const typeSerializers = {
    "Vector2D": (reader) => { return new FVector2D(reader); },
    "LinearColor": (reader) => { return new FLinearColor(reader); },
    "GameplayTagContainer": (reader) => { return new FGameplayTagContainer(reader); },
    "Quat": (reader) => { return new FQuat(reader); },
    "Vector": (reader) => { return new FVector(reader); }
}

class FText {
    constructor(reader) {
        this.Flags = reader.readUInt32LE();
        this.HistoryType = reader.readInt8();
        if (this.HistoryType == 0) {
            this.Namespace = new FString(reader);
            this.Key = new FString(reader);
            this.SourceString = new FString(reader);
        } else {
            console.log("Cannot handle FTextHistory for type", this.HistoryType);
        }
    }
    toString() {
        return this.SourceString.toString();
    }
}

function UScriptStruct_SerializeItem(reader, tag, obj, key) {
    const typeStr = tag.StructName.toString();
    if (typeStr in typeSerializers) {
        obj[key] = typeSerializers[typeStr](reader);
        return;
    }

    obj[key] = {};
    SerializeTaggedProperties(reader, obj[key]);
}

class FSoftObjectPath {
    constructor(reader) {
        this.AssetPathName = new FName(reader);
        this.SubPathString = new FString(reader);
    }

    toString() {
        return this.AssetPathName.toString();
    }
}

function SerializeTaggedProperty(reader, tag, obj) {
    const typeStr = tag.Type.toString();
    if (typeStr == "BoolProperty") {
        obj[tag.Name.toString()] = tag.BoolVal;
    } else if (typeStr == "StructProperty") {
        UScriptStruct_SerializeItem(reader, tag, obj, tag.Name.toString());
    } else if (typeStr == "ObjectProperty") {
        obj[tag.Name.toString()] = new FPackageIndex(reader);
    } else if (typeStr == "FloatProperty") {
        obj[tag.Name.toString()] = reader.readFloatLE();
    } else if (typeStr == "TextProperty") {
        obj[tag.Name.toString()] = new FText(reader);
    } else if (typeStr == "NameProperty") {
        obj[tag.Name.toString()] = new FName(reader);
    } else if (typeStr == "IntProperty") {
        obj[tag.Name.toString()] = reader.readInt32LE();
    } else if (typeStr == "ByteProperty" || typeStr == "EnumProperty") {
        if (tag.EnumName.toString() != "None") {
            obj[tag.Name.toString()] = new FName(reader);
        } else {
            obj[tag.Name.toString()] = reader.readUInt8();
        }
    } else if (typeStr == "SoftObjectProperty") {
        obj[tag.Name.toString()] = new FSoftObjectPath(reader);
    } else {
        console.log("Can't handle type:", typeStr, tag.Size, reader.tell(), tag.Name.toString());
    }
}

function SerializeTaggedProperties(reader, obj) {
    while (true) {
        const tag = new FPropertyTag(reader);
        if (tag.Name.toString() == "None") {
            break;
        }
        const pos = reader.tell();
        //console.log("<",tag.toString(),">");
        SerializeTaggedProperty(reader, tag, obj);
        //console.log("</",tag.toString(),">");
        if (reader.tell() != (pos + tag.Size)) {
            console.log("failed to parse it all", reader.tell(), pos + tag.Size);
            reader.seek(pos + tag.Size);
        }
    }
}

class UObject {
    constructor(reader) {
        SerializeTaggedProperties(reader, this);
    }
}

class Package {
    constructor(assetFile, exportFile) {
        // Read asset file data
        const uassetData = fs.readFileSync(assetFile);

        const reader = new DataReader(uassetData, this);
        this.Summary = new FPackageFileSummary(reader);

        reader.seek(this.Summary.NameOffset);
        this.NameMap = [];
        for (let i = 0; i < this.Summary.NameCount; i++) {
            this.NameMap.push(new FNameEntrySerialized(reader));
        }

        reader.seek(this.Summary.ImportOffset);
        this.ImportMap = [];
        for (let i = 0; i < this.Summary.ImportCount; i++) {
            this.ImportMap.push(new FObjectImport(reader));
        }

        reader.seek(this.Summary.ExportOffset);
        this.ExportMap = [];
        for (let i = 0; i < this.Summary.ExportCount; i++) {
            this.ExportMap.push(new FObjectExport(reader));
        }

        // Read export data
        const uexpData = fs.readFileSync(exportFile);
        const expReader = new DataReader(uexpData, this);
        this.Exports = [];
        this.Exports.push(new UObject(expReader));
    }
}

function ReadAsset(path) {
    var assetPath = path + '.uasset';
    var exportPath = path + '.uexp';
    if (!fs.existsSync(assetPath) || !fs.existsSync(exportPath)) {
        throw "No asset found";
    }
    var asset = new Package(path + '.uasset', path + '.uexp');
    return asset.Exports[0];
}

exports.ReadAsset = ReadAsset;
