const http = require('http');
const ejs = require('ejs');
const fs = require('fs');
const { extractDataFromRequest } = require('./utils/requestParser');
const { fileExtensionToContentType } = require('./utils/fileHandler');
const { isValidId } = require('./utils/idHandler');
const { MissingAdminFieldException } = require('./game/game');
const { gameCoordinator } = require('./gameCoordinator');
const { initalizeClientIO } = require('./clientIO');

// CONSTANTS
const PORT = process.env.PORT || 3000;

const MAIN_PAGE = "main_page.ejs";
const LANDING_PAGES = ["", "landing_page.html"];
const PAGES = [MAIN_PAGE, ...LANDING_PAGES];
const ERROR_PAGE = "404.html";

/**********************************************************/
/*                         SERVER                         */
/**********************************************************/

// create server
const server = http.createServer(function (request, response) {
    console.log('requesting ' + request.url);

    try {
        let data = extractDataFromRequest(request);

        // request for a page
        if(PAGES.includes(data.file.name)) {
            assertUsernameUniqueness(data);
            assertUserIsNotAlreadyPlaying(data);

            // game page
            if(data.file.name == MAIN_PAGE) {
                let game = gameCoordinator.getGameOfJoiningUser(data);
                setResponseToRenderizedGamePage(response, data, game);
            // landing page
            } else {
                setResponseToRequestedResources(response, data);
            }
        // all other resources
        } else {
            setResponseToRequestedResources(response, data);
        }
        
    } catch(err) {
        if(err instanceof DuplicateUsernameException) {
            redirectTo(response, `/${ERROR_PAGE}`);
        } else if(err instanceof UserInMultipleGamesException) {
            let g = err.game, uId = err.userId;
            redirectTo(response, `/${MAIN_PAGE}?gameId=${g.get_id()}&username=${g.get_player(uId).get_username()}`);
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
        console.log('Error occured while trying to set up a server ' + error);
    } else {
        console.log('Server is listening on port ' + PORT);
    }
});

// set up SOCKET communication
initalizeClientIO(server);

/**********************************************************/
/*                   EXCEPTION CLASSES                    */
/**********************************************************/

class DuplicateUsernameException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

class UserInMultipleGamesException extends Error {
    constructor(message, userId, game) {
        super(message);
        this.name = this.constructor.name;
        this.userId = userId;
        this.game = game;
    }
}

/**********************************************************/
/*                     HELPER METHODS                     */
/**********************************************************/

function assertUsernameUniqueness(data) {
    // username is set
    if(data.user.name) {
        let game = gameCoordinator.getGameContainingUsername(data.user.name);

        // exists a game with this username
        if(game)
            throw new DuplicateUsernameException(`Username ${data.user.name} already in use`);
    }
}

function assertUserIsNotAlreadyPlaying(data) {
    // NOTE: this has a bug! If user has been in this game
    // as a watcher, his id was set. If he joins later
    // with a different name, possibly some players name
    // who is at that time disconnected, he will be able
    // to assume his position !
    // user id is valid
    if(isValidId(data.user.id)) {
        // & user already playing in game
        let game = gameCoordinator.getGameContainingUser(data.user.id);
        if(game && game.get_id() !== data.game.id)
            throw new UserInMultipleGamesException(`User ${data.user.id} is already playing in ${game.get_id()} game`, 
                                                    data.user.id, game);    
    }
}

function redirectTo(response, url) {
    response.writeHead(302, {
        Location: url
    }).end();
}

function setResponseToRenderizedGamePage(response, data, game) {
    fs.readFile(data.file.path, 'utf-8', function(fs_error, fileContent) {
        if(fs_error) {
            setResponseToErrorPage(fs_error, response);
        } else {
            let content = ejs.render(fileContent, { username: data.user.name, 
                                                    data: game.info() });
            setResponseToRequstedFile(response, content, 'text/html', data);
        }
    });
}

function setResponseToRequestedResources(response, data) {
    let contentType = fileExtensionToContentType(data.file.path);
    //NOTE: undefined is actually variable window.undefined which can be defined, in that case this would break!
    let encoding = contentType.split('/')[0] === 'image' ? undefined : 'utf-8';

    fs.readFile(data.file.path, encoding, function(fs_error, content) {
        if (fs_error)
            setResponseToErrorPage(fs_error, response);
        else
            setResponseToRequstedFile(response, content, contentType, data);
    });
}

function setResponseToErrorPage(fs_error, response) {
    if(fs_error.code == 'ENOENT') {
        fs.readFile(`./${ERROR_PAGE}`, function(fs_error, content) {
            setResponseToRequstedFile(response, content, 'text/html');
        });
    } else {
        response.writeHead(500);
        response.end('Sorry, check with the site admin for error: ' + fs_error.code + ' ..\n');
    }
}

function setResponseToRequstedFile(response, content, contentType, data) {
    // set header
    let headers = { 'Content-Type': contentType };
    if(data) headers['Set-Cookie'] = `user_id=${data.user.id}`;
    response.writeHead(200, headers);

    // set content
    response.end(content, 'utf-8');
}