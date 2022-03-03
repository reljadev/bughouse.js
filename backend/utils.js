const path = require('path')

const DIRPATH = '../frontend'
const DEFAULT_PAGE = '/landing_page/landing_page.html'

//TODO: this is an ugly hack
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
    } else if(folder_name === '/sidebar') {
        var filePath = DIRPATH + '/game/sidebar.js'
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

function remove_item(arr, value) {
    var index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
}

// export all functions
module.exports = {parse_url: parse_url, 
                  ext_to_type: ext_to_type,
                  remove_item: remove_item,}