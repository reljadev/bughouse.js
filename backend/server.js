const http = require('http');
const ejs = require('ejs');
const fs = require('fs');
const utils = require('./utils');
const sanitize = require('sanitize-html');
const socket = require('socket.io');
const Game = require('./game');

// CONSTANTS
const PORT = process.env.PORT || 3000;

const MAIN_PAGE = "main_page.ejs";
const LANDING_PAGES = ["", "landing_page.html"];
const PAGES = [MAIN_PAGE, ...LANDING_PAGES];
const ERROR_PAGE = "404.html";

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const START_SPARES = {'white': {'wP': 0, 'wN': 0, 'wB': 0, 'wR': 0, 'wQ': 0},
                      'black': {'bP': 0, 'bN': 0, 'bB': 0, 'bR': 0, 'bQ': 0}};

//TODO: abstract out in GameCoordinator Singleton class
// contains all current games
let games = {};

function startNewGame(admin) {
    //NOTE: in next version of code there should be
    //  a possibility for admin to set starting position and spares
    let g = new Game({ admin: admin, fen: START_FEN, spares: START_SPARES });
    games[g.get_id()] = g;

    return g;
}

function getGameContainingUser(user_id) {
    if(typeof user_id === 'undefined') return null;

    for(let i in games) {
        if(games[i].has_player(user_id)) {
            return games[i];
        }
    }
    
    return null;
}

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
        for(let i in games) {
            // & exists a game already with that username
            if(games[i].has_username(data.user.name))
                throw new DuplicateUsernameException(`Username ${data.user.name} already in use`);
        }
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
        let g = getGameContainingUser(data.user.id);
        if(g && g.get_id() !== data.game.id)
            throw new UserInMultipleGamesException(`User ${data.user.id} is already playing in ${g.get_id()} game`, 
                                                    data.user.id, g);    
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

        if(PAGES.includes(data.file.name)) {
            assertUsernameUniqueness(data);
            assertUserIsNotAlreadyPlaying(data);

            if(data.file.name == MAIN_PAGE) {
                // get game from coordinator
                let currentGame = null;

                // TODO: joinExistingGame
                if(data.file.name === MAIN_PAGE) {
                    // join existing game
                    if(data.game.id !== null && 
                    games.hasOwnProperty(data.game.id)) {
                        currentGame = games[data.game.id];

                        if(!currentGame.has_player(data.user.id)) {
                            data.user.id = currentGame.add_new_player();
                        }
                        
                    // TODO: try startNewGame
                    //       catch errorWhileStartingGame 
                    //       redirect to landing page
                    // start new game
                    } else {
                        // set current game
                        let admin = data.user.name;
                        try {
                            currentGame = startNewGame(admin);
                        } catch(error) {
                            //NOTE: it should show a notation, that username was wrong
                            redirectTo(response, `/${LANDING_PAGES[1]}`);
                            return; //TODO: remove this after
                        }
                        
                        data.user.id = currentGame.add_new_player();
                    }
                }

                // render main page and return it
                renderizePageAndReturn(response, data, currentGame);
            } else {
                returnResources(response, data);
            }
        } else {
            returnResources(response, data);
        }
        
    } catch(err) {
        if(err instanceof DuplicateUsernameException) {
            redirectTo(response, `/${ERROR_PAGE}`);
        } else if(err instanceof UserInMultipleGamesException) {
            let g = err.game, uId = err.userId;
            redirectTo(response, `/${MAIN_PAGE}?gameId=${g.get_id()}&username=${g.get_player(uId).get_username()}`);
        } else {
            redirectTo(response, `/${ERROR_PAGE}`);
        }
        //TODO: missing catch for admin exception on game start
    }

});

// set up websocket
let io = socket(server);

io.on('connection', (client) => {
    console.log('A user just connected.');

    let game_id = client.request._query['gameId'];
    let user_id = client.request._query['user_id'];
    let username = sanitize(client.request._query['username']);
    
    if((typeof game_id !== 'undefined' && games.hasOwnProperty(game_id)) &&
       (typeof username !== 'undefined')) {
        // update player username & socket
        let p = games[game_id].get_player(user_id);
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

        let g = games[game_id];
        if(g) {
            let p = g.get_player(user_id);
            if(p && g.is_admin(p)) {
                let player_set = g.set_player_at_board(board, color, username);
                if(player_set) {
                    client.broadcast.to(game_id).emit('playerJoined', board, color, username);
                    if(g.boards_are_set()) {
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

        let g = games[game_id];
        if(g) {
            let p = g.get_player(user_id);
            if(p && g.is_admin(p)) {
                let player_removed = g.remove_player_from_board(board, color);
                if(player_removed) {
                    client.broadcast.to(game_id).emit('playerRemoved', board, color);
                    client.emit('cant_start_game');
                }
            }
        }
    });

    // admin has initiated the game
    client.on('game_has_started', (times) => {
        let g = games[game_id];
        if(g) {
            let p = g.get_player(user_id);
            if(p && g.is_admin(p)) {
                g.set_times(times);
                let game_started = g.start();
        
                if(game_started) {
                    client.broadcast.to(game_id).emit('game_has_started', times);
                }
            }
        }
    });

    // on player move
    client.on('move', (board, move, elapsedTime) => {
        let g = games[game_id];
        if(g) {
            let p = g.get_player(user_id);
            if(p) {
                let updated = g.move(board, p, move);
                if(updated) {
                    g.update_timers(board, elapsedTime);
                    // broadcast move & updated timers
                    client.broadcast.to(g.get_id()).emit('move', board, move,
                                                                g.get_white_time(board),
                                                                g.get_black_time(board));
                    g.check_status();
                }
            }
        }
    });

    client.on('resigned', () => {
        let g = games[game_id];
        if(g) {
            let p = g.get_player(user_id);
            if(p) {
                games[game_id].resigned(p);
            }
        }
    });

    client.on('reset_game', (fen, sparePieces) => {
        let g = games[game_id];
        if(g) {
            let p = g.get_player(user_id);
            if(p && g.is_admin(p)) {
                let position_set = g.set_position(fen, sparePieces);
                if(position_set) {
                    g.reset();
                
                    client.broadcast.to(game_id).emit('reset_game', fen, sparePieces);
                }
            }
        }
    });

    // player has disconnected
    client.on('disconnect', () => {
        console.log('A user has disconnected.');

        let g = games[game_id];
        if(g) {
            let p = g.get_player(user_id);
            if(p) {
                client.broadcast.to(g.get_id()).emit('disconnected', 
                                                    p.get_username());
                g.remove_player(user_id);
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