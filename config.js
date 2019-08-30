// I couldn't think of a better way to do this
// Please don't laugh at me

function TokenizeConfig(data) {
    let currentToken = "";
    let finalData = [];
    let parseKey = false;
    let quoting = false;
    while (data.str.length > 0) {
        let char = data.str[0];
        data.str = data.str.slice(1);
        if (char == "\"" && !quoting) {
            quoting = true;
            continue;
        }
        if (char == "\"" && quoting) {
            if (currentToken.length <= 0) {
                currentToken = false;
            }
            quoting = false;
            continue;
        }
        if (quoting) {
            currentToken += char;
            continue;
        }
        if (char == '(') {
            if (parseKey) {
                finalData.push({
                    key: parseKey,
                    value: TokenizeConfig(data),
                });
                parseKey = false;
            } else {
                finalData.push(TokenizeConfig(data));
            }
            continue;
        }
        if (char == ')') {
            if (currentToken.length > 0) {
                finalData.push(currentToken);
            }
            return finalData;
        }
        if (char == ',') {
            if (currentToken.length <= 0) continue;
            if (parseKey) {
                finalData.push({
                    key: parseKey,
                    value: currentToken,
                });
                parseKey = null;
            } else {
                finalData.push(currentToken);
            }
            currentToken = '';
            continue;
        }
        if (char == '=') {
            parseKey = currentToken;
            currentToken = '';
            continue;
        }
        if (char == ' ') {
            continue;
        }
        currentToken += char;
    }

    return finalData;
}

function NormalizeConfig(vals) {
    let normalized = {};
    for (let i = 0; i < vals.length; i++) {
        if (Array.isArray(vals[i])) {
            return NormalizeConfig(vals[i]);
        } else {
            normalized[vals[i].key] = vals[i].value;
        }
    }
    return normalized;
}

function ReadConfig(data) {
    let config = TokenizeConfig(data);
    return NormalizeConfig(config);
}

exports.ReadConfig = ReadConfig;
