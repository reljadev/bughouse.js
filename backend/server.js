const http = require('http');
const ejs = require('ejs');
const fs = require('fs');
const utils = require('./utils');
const sanitize = require('sanitize-html');
const socket = require('socket.io');
const { gameCoordinator } = require('./games_coordinator');

// CONSTANTS
const PORT = process.env.PORT || 3000;

const MAIN_PAGE = "main_page.ejs";
const LANDING_PAGES = ["", "landing_page.html"];
const PAGES = [MAIN_PAGE, ...LANDING_PAGES];
const ERROR_PAGE = "404.html";

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
    if(utils.isValidId(data.user.id)) {
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

function renderizePageAndReturn(response, data, game) {
    fs.readFile(data.file.path, 'utf-8', function(fs_error, fileContent) {
        if(fs_error) {
            returnErrorPage(fs_error, response);
        } else {
            let content = ejs.render(fileContent, { username: data.user.name, 
                                                    data: game.info() });
            returnFile(response, content, 'text/html', data);
        }
    });
}

function returnResources(response, data) {
    let contentType = utils.fileExtensionToContentType(data.file.path);
    //NOTE: undefined is actually variable window.undefined which can be defined, in that case this would break!
    let encoding = contentType.split('/')[0] === 'image' ? undefined : 'utf-8';

    fs.readFile(data.file.path, encoding, function(fs_error, content) {
        if (fs_error)
            // TODO: all return should be renamed to setResponse
            returnErrorPage(fs_error, response);
        else
            returnFile(response, content, contentType, data);
    });
}

function returnFile(response, content, contentType, data) {
    // set header
    let headers = { 'Content-Type': contentType };
    if(data) headers['Set-Cookie'] = `user_id=${data.user.id}`;
    response.writeHead(200, headers);

    // set content
    response.end(content, 'utf-8');
}

function returnErrorPage(fs_error, response) {
    if(fs_error.code == 'ENOENT') {
        fs.readFile(`./${ERROR_PAGE}`, function(fs_error, content) {
            returnFile(response, content, 'text/html');
        });
    } else {
        response.writeHead(500);
        response.end('Sorry, check with the site admin for error: ' + fs_error.code + ' ..\n');
    }
}

// create server
const server = http.createServer(function (request, response) {
    console.log('requesting ' + request.url);

    try {
        let data = utils.extractDataFromRequest(request);

        // request for a page
        if(PAGES.includes(data.file.name)) {
            assertUsernameUniqueness(data);
            assertUserIsNotAlreadyPlaying(data);

            // game page
            if(data.file.name == MAIN_PAGE) {
                let game = gameCoordinator.getGameOfJoiningUser(data);
                renderizePageAndReturn(response, data, game);
            // landing page
            } else {
                returnResources(response, data);
            }
        // all other resources
        } else {
            returnResources(response, data);
        }
        
    } catch(err) {
        if(err instanceof DuplicateUsernameException) {
            redirectTo(response, `/${ERROR_PAGE}`);
        } else if(err instanceof UserInMultipleGamesException) {
            let g = err.game, uId = err.userId;
            redirectTo(response, `/${MAIN_PAGE}?gameId=${g.get_id()}&username=${g.get_player(uId).get_username()}`);
        } else if(err instanceof MissingAdminFieldException) { //TODO: should i import this exception?
            redirectTo(response, `/${LANDING_PAGES[1]}`);
        } else {
            redirectTo(response, `/${ERROR_PAGE}`);
        }
    }

});

//TODO: use game coordinator here
// set up websocket
let io = socket(server);

io.on('connection', (client) => {
    console.log('A user just connected.');

    //TODO: should i get the game here?
    let game_id = client.request._query['gameId'];
    let user_id = client.request._query['user_id'];
    let username = sanitize(client.request._query['username']);
    
    let game = gameCoordinator.getGameById(game_id);
    if(game && typeof username !== 'undefined') {
        // update player username & socket
        let p = game.get_player(user_id);
        if(p) {
            client.join(game_id);

            p.set_username(username);
            p.set_socket(client);

            client.broadcast.to(game_id).emit('joined', username);
        }
    }

    // player set at board
    client.on('playerJoined', (board, color, username) => {
        // sanitize client suplied data
        board = sanitize(board);
        color = sanitize(color);
        username = sanitize(username);

        let game = gameCoordinator.getGameById(game_id);
        if(game) {
            let p = game.get_player(user_id);
            if(p && game.is_admin(p)) {
                let player_set = game.set_player_at_board(board, color, username);
                if(player_set) {
                    client.broadcast.to(game_id).emit('playerJoined', board, color, username);
                    if(game.boards_are_set()) {
                        client.emit('can_start_game');
                    }
                }
            }
        }
    });

    // player removed from board
    client.on('playerRemoved', (board, color) => {
        // sanitize client suplied data
        board = sanitize(board);
        color = sanitize(color);

        let game = gameCoordinator.getGameById(game_id);
        if(game) {
            let p = game.get_player(user_id);
            if(p && game.is_admin(p)) {
                let player_removed = game.remove_player_from_board(board, color);
                if(player_removed) {
                    client.broadcast.to(game_id).emit('playerRemoved', board, color);
                    client.emit('cant_start_game');
                }
            }
        }
    });

    // admin has initiated the game
    client.on('game_has_started', (times) => {
        let game = gameCoordinator.getGameById(game_id);
        if(game) {
            let p = game.get_player(user_id);
            if(p && game.is_admin(p)) {
                game.set_times(times);
                let game_started = game.start();
        
                if(game_started) {
                    client.broadcast.to(game_id).emit('game_has_started', times);
                }
            }
        }
    });

    // on player move
    client.on('move', (board, move, elapsedTime) => {
        let game = gameCoordinator.getGameById(game_id);
        if(game) {
            let p = game.get_player(user_id);
            if(p) {
                let updated = game.move(board, p, move);
                if(updated) {
                    game.update_timers(board, elapsedTime);
                    // broadcast move & updated timers
                    client.broadcast.to(game.get_id()).emit('move', board, move,
                                                                    game.get_white_time(board),
                                                                    game.get_black_time(board));
                    game.check_status();
                }
            }
        }
    });

    client.on('resigned', () => {
        let game = gameCoordinator.getGameById(game_id);

        if(game) {
            let player = game.get_player(user_id);
            if(player) {
                game.resigned(player);
            }
        }
    });

    client.on('reset_game', (fen, sparePieces) => {
        let game = gameCoordinator.getGameById(game_id);

        if(game) {
            let p = game.get_player(user_id);
            if(p && game.is_admin(p)) {
                let position_set = game.set_position(fen, sparePieces);
                if(position_set) {
                    game.reset();
                
                    client.broadcast.to(game_id).emit('reset_game', fen, sparePieces);
                }
            }
        }
    });

    // player has disconnected
    client.on('disconnect', () => {
        console.log('A user has disconnected.');

        let game = gameCoordinator.getGameById(game_id);

        if(game) {
            let p = game.get_player(user_id);
            if(p) {
                client.broadcast.to(game.get_id()).emit('disconnected', 
                                                    p.get_username());
                game.remove_player(user_id);
            }
        }
    });
});

// listen for upcomming connection
server.listen(PORT, function(error) {
    if(error) {
        console.log('Error occured while trying to set up a server ' + error);
    } else {
        console.log('Server is listening on port ' + PORT);
    }
});