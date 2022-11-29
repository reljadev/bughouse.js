const path = require('path');

// CONSTANTS
const DIRPATH = './frontend';
const DEFAULT_PAGE = '/landing_page/landing_page.html';

function convertURLToFilePath(parser) {
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

    return { filePath, fileName };
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

module.exports = {convertURLToFilePath: convertURLToFilePath,
                  fileExtensionToContentType: fileExtensionToContentType};