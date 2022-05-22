const path = require('path')

const DIRPATH = './frontend'
const DEFAULT_PAGE = '/landing_page/landing_page.html'

function parse_url(request) {
    // form URL
    let baseURL = 'http://' + request.headers.host + '/';
    let parser = new URL(request.url, baseURL);

    // get protocol
    let protocol = parser.protocol.split(':')[0];

    // convert request url to file path
    let filePath = null;
    let folder_name = parser.pathname.substring(0, parser.pathname.indexOf('.'))
    if(folder_name === '') {
        filePath = DIRPATH + DEFAULT_PAGE
    } else if(folder_name === '/landing_page') {
        filePath = DIRPATH + '/landing_page' + parser.pathname
    } else if(['/path', '/stopwatch', '/players', '/game', '/main_page'].includes(folder_name)) {
        filePath = DIRPATH + '/main_page' + parser.pathname
    } else {
        filePath = DIRPATH + parser.pathname
    }
    let fileName = parser.pathname.substring(1);
    
    // get request parameters
    let params = Object.fromEntries(parser.searchParams)

    return {protocol, fileName, filePath, params}
}

function ext_to_type(filePath) {
    let extname = path.extname(filePath);
    const ext_to_type = {'.html': 'text/html', '.js': 'text/javascript',
                         '.css': 'text/css', '.ejs': 'text/html',
                         '.json': 'application/json', '.ttf': 'font/ttf',
                         '.png': 'image/png', '.jpg': 'image/jpg',
                         '.svg': 'image/svg+xml', '.ico': 'image/x-icon'}
    return ext_to_type[extname]
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

// export all functions
module.exports = {parse_url: parse_url, 
                  ext_to_type: ext_to_type,
                  parse_cookies: parse_cookies,
                  remove_item: remove_item,
                  deepCopy,
                  uuid,
                  isValidId,}