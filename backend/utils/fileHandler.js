const path = require('path');

// CONSTANTS
const DIRPATH = './frontend';
const DEFAULT_PAGE = '/landing_page/landing_page.html';
const LANDING_PAGE = '/landing_page';
const MAIN_PAGE = '/main_page';
const CLIENT_FILE = '/client';
const PATH_FILE = '/path';
const STOPWATCH_FILE = '/stopwatch';
const PLAYERS_FILE = '/players';
const GAME_FILE = '/game';

function convertURLToFilePath(parser) {
    let filePath = null, fileName = null;
    let folderName = parser.pathname.substring(0, parser.pathname.indexOf('.'));

    if(folderName === '') {
        filePath = DIRPATH + DEFAULT_PAGE;
    } else if(folderName === LANDING_PAGE) {
        filePath = DIRPATH + LANDING_PAGE + parser.pathname;
    } else if([CLIENT_FILE, PATH_FILE, STOPWATCH_FILE,
                PLAYERS_FILE, GAME_FILE, MAIN_PAGE].includes(folderName)) {
        filePath = DIRPATH + MAIN_PAGE + parser.pathname;
    } else {
        filePath = DIRPATH + parser.pathname;
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