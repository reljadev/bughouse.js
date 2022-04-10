const path = require('path')

const DIRPATH = './frontend'
const DEFAULT_PAGE = '/landing_page/landing_page.html'

function parse_url(request) {
    // form URL
    var baseURL = 'http://' + request.headers.host + '/';
    var parser = new URL(request.url, baseURL);

    // convert request url to file path
    var folder_name = parser.pathname.substring(0, parser.pathname.indexOf('.'))
    if(folder_name === '') {
        var filePath = DIRPATH + DEFAULT_PAGE
    } else if(folder_name === '/game' || folder_name === '/landing_page') {
        var filePath = DIRPATH + folder_name + parser.pathname
    } else if(['/path', '/stopwatch', '/sidebar', '/sport'].includes(folder_name)) {
        var filePath = DIRPATH + '/game' + parser.pathname
    } else {
        var filePath = DIRPATH + parser.pathname
    }
    
    // get request parameters
    var params = Object.fromEntries(parser.searchParams)

    return {fileName: parser.pathname.substring(1), filePath: filePath, params: params}
}

function ext_to_type(filePath) {
    var extname = path.extname(filePath);
    const ext_to_type = {'.html': 'text/html', '.js': 'text/javascript',
                         '.css': 'text/css', '.json': 'application/json',
                         '.png': 'image/png', '.jpg': 'image/jpg',
                         '.ico': 'image/x-icon', '.ejs': 'text/html'}
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
    var index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
}

function deepCopy(obj) {
    var copy = {}

    for (var property in obj) {
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
      var r = (Math.random() * 16) | 0
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