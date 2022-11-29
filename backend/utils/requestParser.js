const sanitize = require('sanitize-html');
const { convertURLToFilePath } = require('./fileHandler');

function extractDataFromRequest(request) {
    let data = {file: {}, user: {}, game: {}};

    // parse request
    let parsed_url = parseURL(request);
    let params = parsed_url.params;
    let cookies = parseCookies(request);

    // set data
    data.file.path = parsed_url.filePath;
    data.file.name = parsed_url.fileName;
    data.user.id = cookies.user_id;
    data.user.name = sanitize(params.username);
    data.game.id = params.gameId ?? null;

    return data;
}

function parseURL(request) {
    // form URL
    let baseURL = 'http://' + request.headers.host + '/';
    let parser = new URL(request.url, baseURL);

    // get protocol
    let protocol = parser.protocol.split(':')[0];
    // get file path & name
    let {filePath, fileName} = convertURLToFilePath(parser);
    // get request parameters
    let params = Object.fromEntries(parser.searchParams)

    return { protocol, filePath, fileName, params }
}

function parseCookies(request) {
    const list = {};
    const cookieHeader = request.headers?.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(`;`).forEach(function(cookie) {
        let [ name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        const value = rest.join(`=`).trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });

    return list;
}

module.exports = {extractDataFromRequest: extractDataFromRequest};