const path = require('path')
const sanitize = require('sanitize-html');

const DIRPATH = './frontend'
const DEFAULT_PAGE = '/landing_page/landing_page.html'

/***************** REQUEST *****************/

function extractDataFromRequest(request) {
    let data = {file: {}, user: {}, game: {}};

    // parse request
    let parsed_url = parse_url(request);
    let params = parsed_url.params;
    let cookies = parse_cookies(request);

    // set data
    data.file.path = parsed_url.filePath;
    data.file.name = parsed_url.fileName;
    data.user.id = cookies.user_id;
    data.user.name = sanitize(params.username);
    data.game.id = params.gameId ?? null;

    return data;
}

function parse_url(request) {
    // form URL
    let baseURL = 'http://' + request.headers.host + '/';
    let parser = new URL(request.url, baseURL);

    // get protocol
    let protocol = parser.protocol.split(':')[0];
    // get file path & name
    let {filePath, fileName} = convertRequestURLToFilePath(parser);
    // get request parameters
    let params = Object.fromEntries(parser.searchParams)

    return {protocol, filePath, fileName, params}
}

function parse_cookies (request) {
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

/***************** FILE *****************/

function convertRequestURLToFilePath(parser) {
    let filePath = null, fileName = null;
    let folder_name = parser.pathname.substring(0, parser.pathname.indexOf('.'))

    if(folder_name === '') {
        filePath = DIRPATH + DEFAULT_PAGE
    } else if(folder_name === '/landing_page') {
        filePath = DIRPATH + '/landing_page' + parser.pathname
    } else if(['/client', '/path', '/stopwatch',
               '/players', '/game', '/main_page'].includes(folder_name)) {
        filePath = DIRPATH + '/main_page' + parser.pathname
    } else {
        filePath = DIRPATH + parser.pathname
    }

    fileName = parser.pathname.substring(1);

    return {filePath, fileName};
}

function fileExtensionToContentType(filePath) {
    let extname = path.extname(filePath);
    const extToType = {'.html': 'text/html', '.js': 'text/javascript',
                         '.css': 'text/css', '.ejs': 'text/html',
                         '.json': 'application/json', '.ttf': 'font/ttf',
                         '.png': 'image/png', '.jpg': 'image/jpg',
                         '.svg': 'image/svg+xml', '.ico': 'image/x-icon'};

    return extToType[extname];
}

/***************** ID *****************/

function uuid (length) {
    return ('xxxx-'.repeat(length / 4 - 1).concat('xxxx')).replace(/x/g, function (c) {
      let r = (Math.random() * 16) | 0
      return r.toString(16)
    })
}

function isValidId(id) {
    return typeof id === 'string' &&
                    id.match(/^[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}$/)
}

/***************** MISC *****************/

function remove_item(arr, value) {
    let index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
}

function deepCopy(obj) {
    let copy = {}

    for (let property in obj) {
      if (typeof obj[property] === 'object') {
        copy[property] = deepCopy(obj[property])
      } else {
        copy[property] = obj[property]
      }
    }

    return copy
}

/***************** EXPORTS *****************/

// export all functions
module.exports = {extractDataFromRequest: extractDataFromRequest,
                  fileExtensionToContentType: fileExtensionToContentType,
                  uuid,
                  isValidId,
                  remove_item: remove_item,
                  deepCopy,
                  }