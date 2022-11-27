const http = require('http');
const ejs = require('ejs');
const fs = require('fs');
const utils = require('./utils');
const sanitize = require('sanitize-html');
const socket = require('socket.io');
const Game = require('./game');

// games functions
let games = {};

function start_new_game(admin) {
    //NOTE: in next version of code there should be
    //  a possibility for admin to starting position and spares
    let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    let sparePieces = {'white': {'wP': 0, 'wN': 0, 'wB': 0, 'wR': 0, 'wQ': 0},
                       'black': {'bP': 0, 'bN': 0, 'bB': 0, 'bR': 0, 'bQ': 0}};
    
    let g = new Game({ admin: admin, fen: fen, spares: sparePieces });
    games[g.get_id()] = g;

    return g;
}

function get_game_containing_user(user_id) {
    if(typeof user_id === 'undefined') return false;

    for(let i in games) {
        if(games[i].has_player(user_id)) {
            return games[i];
        }
    }
    
    return false;
}

// CONSTANTS
const PORT = process.env.PORT || 3000;

// create server
const server = http.createServer(function (request, response) {
    console.log('requesting ' + request.url);

    let data = utils.extractDataFromRequest(request); 

    // TODO: try redirectUserWithDuplicateUsername(response, data.file.name, params)
    // TODO: try redirectPlayingUser(response, data.file.name, params, user_id)
    // if user wants main_page.ejs or landing page
    if(data.file.name === '' || data.file.name === 'landing_page.html' || data.file.name === 'main_page.ejs') {
        // multiple users with the same username are not allowed
        if(data.user.name) {
            for(let i in games) {
                if(games[i].has_username(data.user.name)) {
                    // redirect user to landing page
                    response.writeHead(302, {
                        // NOTE: it should either redirect to landing page with note 'username already in use'
                        // or redirect to game page with an alert that joining two games at once is not currently supported
                        Location: `/404.html`
                    }).end();
                    return;
                }
            }
        }

        // user id is valid
        if(utils.isValidId(data.user.id)) {
            // & user already playing in game
            let g = get_game_containing_user(data.user.id);
            if(g && g.get_id() !== data.game.id) {
                // redirect user to that game
                response.writeHead(302, {
                        Location: `/main_page.ejs?gameId=${g.get_id()}&username=${g.get_player(data.user.id).get_username()}`
                    }).end();
                return;
            }         
        }

    }
    
    let currentGame = null;

    // try joinExistingGame(data.file.name, params, currentGame)
    // catch does nothing
    if(data.file.name === 'main_page.ejs') {
        // join existing game
        if(data.game.id !== null && 
           games.hasOwnProperty(data.game.id)) {
            currentGame = games[data.game.id];

            if(!currentGame.has_player(data.user.id)) {
                data.user.id = currentGame.add_new_player();
            }
            
        // start new game
        } else {
            // set current game
            let admin = data.user.name;
            try {
                currentGame = start_new_game(admin);
            } catch(error) {
                response.writeHead(302, {
                    //NOTE: it should show a notation, that username was wrong
                    Location: `/landing_page.html`
                }).end();
                return;
            }
            
            data.user.id = currentGame.add_new_player();
        }
    }

    // infer correct content type 
    let contentType = utils.ext_to_type(data.file.path);
    //NOTE: undefined is actually variable window.undefined which can be defined, in that case this would break!
    let encoding = contentType.split('/')[0] === 'image' ? undefined : 'utf-8';

    // read file & send it to client
    fs.readFile(data.file.path, encoding, function(fs_error, content) {
        // error while reading the file
        if (fs_error) {
            // TODO: returnError(fs_error, response)
            if(fs_error.code == 'ENOENT') {
                fs.readFile('./404.html', function(fs_error, content) {
                    response.writeHead(200, { 'Content-Type': 'text/html' });
                    response.end(content, 'utf-8');
                });
            } else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: ' + fs_error.code + ' ..\n');
                response.end(); 
            }
        // file read succesfully
        } else {
            // TODO: returnFile(response, content, contentType, user_id, data.file.name, params, currentGame)
            response.writeHead(200, { 'Content-Type': contentType,
                                    'Set-Cookie': 'user_id=' +  data.user.id });
            // renderize ejs page
            if(data.file.name === 'main_page.ejs') {
                let renderizedPage = ejs.render(content, { username: data.user.name, 
                                                            data: currentGame.info() });
                response.end(renderizedPage, 'utf-8');

            // html, js or css file
            } else {
                response.end(content, 'utf-8');
            }
        }
        
    });

})

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