const http = require('http');
const Cookies = require('cookies');
const fs = require('fs');
const sanitize = require('sanitize-html');
const { convertURLToFilePath, 
        fileExtensionToContentType } = require('../utils/fileHandler');
const { MissingAdminFieldException } = require('../game/game');
const { gameCoordinator, 
        DuplicateUsernameException,
        UserInMultipleGamesException } = require('./gameCoordinator');

// CONSTANTS
const PORT = process.env.PORT || 3000;

const MAIN_PAGE = "main_page.html";
const LANDING_PAGES = ["", "landing_page.html"];
const PAGES = [MAIN_PAGE, ...LANDING_PAGES];
const ERROR_PAGE = "404.html";

/**********************************************************/
/*                         SERVER                         */
/**********************************************************/

function initalizeServer() {
    // create server
    const server = http.createServer(function (request, response) {
        console.log('requesting ' + request.url);

        try {
            let cookies = new Cookies(request, response);
            let data = extractDataFromRequest(request, cookies);

            // request for a page
            if(PAGES.includes(data.file.name)) {
                gameCoordinator.assertUsernameUniqueness(data.user.name);
                gameCoordinator.assertUserIsNotAlreadyPlaying(data.user.id, data.game.id);

                // game page
                if(data.file.name == MAIN_PAGE) {
                    let game = gameCoordinator.getGameOfJoiningUser(data.user.id, data.user.name, data.game.id,
                                                                    (newGameId) => data.game.id = newGameId,
                                                                    (newUserId) => data.user.id = newUserId);
                    setCookies(cookies, data);
                    setResponseToRequestedResources(response, data);
                // landing page
                } else {
                    setResponseToRequestedResources(response, data);
                }
            // all other resources
            } else {
                setResponseToRequestedResources(response, data);
            }
            
        } catch(err) {
            //TODO: remove log
            console.log(err);
            if(err instanceof DuplicateUsernameException) {
                redirectTo(response, `/${ERROR_PAGE}`);
            } else if(err instanceof UserInMultipleGamesException) {
                let g = err.game, uId = err.userId;
                redirectTo(response, `/${MAIN_PAGE}?gameId=${g.getId()}&username=${g.getPlayer(uId).getUsername()}`);
            } else if(err instanceof MissingAdminFieldException) {
                redirectTo(response, `/${LANDING_PAGES[1]}`);
            } else {
                redirectTo(response, `/${ERROR_PAGE}`);
            }
        }

    });

    // listen for upcomming connection
    server.listen(PORT, function(error) {
        if(error) {
            console.error('Error occured while trying to set up a server ' + error);
        } else {
            console.log('Server is listening on port ' + PORT);
        }
    });

    return server;
}

/**********************************************************/
/*                       URL PARSING                      */
/**********************************************************/

function extractDataFromRequest(request, cookies) {
    let data = {file: {}, user: {}, game: {}};

    // parse request
    let parsedURL = parseURL(request);
    let params = parsedURL.params;

    // set data
    data.file.path = parsedURL.filePath;
    data.file.name = parsedURL.fileName;
    data.user.id = cookies.get('user_id');
    data.user.name = sanitize(params.username);
    data.game.id = params.gameId ?? cookies.get('game_id');

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
    let params = Object.fromEntries(parser.searchParams);

    return { protocol, filePath, fileName, params };
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

/**********************************************************/
/*                    RESPONSE HANDLING                   */
/**********************************************************/

function redirectTo(response, url) {
    response.writeHead(302, {
        Location: url
    }).end();
}

function setCookies(cookies, data) {
    if(data.user.id) cookies.set('user_id', data.user.id, { overwrite: true, httpOnly: false });
    if(data.user.name) cookies.set('username', data.user.name, { overwrite: true, httpOnly: false });
    if(data.game.id) cookies.set('game_id', data.game.id, { overwrite: true, httpOnly: false });
}

function setResponseToRequestedResources(response, data) {
    let contentType = fileExtensionToContentType(data.file.path);
    //NOTE: undefined is actually variable window.undefined which can be defined, in that case this would break!
    let encoding = contentType.split('/')[0] === 'image' ? undefined : 'utf-8';

    fs.readFile(data.file.path, encoding, function(fsError, content) {
        if (fsError)
            setResponseToErrorPage(fsError, response);
        else
            setResponseToRequstedFile(response, content, contentType, data);
    });
}

function setResponseToErrorPage(fsError, response) {
    if(fsError.code == 'ENOENT') {
        fs.readFile(`./${ERROR_PAGE}`, function(fsError, content) {
            setResponseToRequstedFile(response, content, 'text/html');
        });
    } else {
        response.writeHead(500);
        response.end('Sorry, check with the site admin for error: ' + fsError.code + ' ..\n');
    }
}

function setResponseToRequstedFile(response, content, contentType, data) {
    // set header
    let headers = { 'Content-Type': contentType };
    response.writeHead(200, headers);

    // set content
    response.end(content, 'utf-8');
}

// EXPORTS
module.exports = { initalizeServer };