const http = require('http');
const ejs = require('ejs');
const fs = require('fs');
const utils = require('./utils');
const sanitize = require('sanitize-html');
const helmet = require('helmet');
const socket = require('socket.io');
const Game = require('./game');

// games functions
let games = {};

function start_new_game(admin) {
    //TODO: fen, sparePieces and time should be set up by game admin
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

// initialize helmet
//TODO: delete style-src 'unsafe-inline'
//TODO: missing require-sri-for script
// const run_helmet = helmet({ contentSecurityPolicy: { 
//                                 directives: {"script-src": ["'self'", "https://code.jquery.com/jquery-1.12.4.min.js"], 
//                                             "style-src": ["'self'", "'unsafe-inline'"], 
//                                             "frame-ancestors": ["'none'"],} },
//                             frameguard: {action: "deny"},
//                         });

// create server
const server = http.createServer(function (request, response) {
    console.log('requesting ' + request.url);

    // parse url
    let parsed_url = utils.parse_url(request);
    let protocol = parsed_url.protocol;
    let fileName = parsed_url.fileName;
    let filePath = parsed_url.filePath;
    let params = parsed_url.params;
    // parse cookies
    let cookies = utils.parse_cookies(request);
    let user_id = cookies.user_id;
    // sanitize client suplied data
    params.username = sanitize(params.username);

    // NOTE: can't set up SSL certificate with heroku free tier
    // redirect to https
    // if(protocol !== 'https') {
    //     response.writeHead(301, {
    //         Location: 'https://' + request.headers.host + request.url
    //     }).end();
    //     return
    // }

    // if user wants main_page.ejs or landing page
    if(fileName === '' || fileName === 'landing_page.html' || fileName === 'main_page.ejs') {
        // multiple users with the same username are not allowed
        if(params.username) {
            for(let i in games) {
                if(games[i].has_username(params.username)) {
                    // redirect user to landing page
                    response.writeHead(302, {
                        // TODO: it should either redirect to landing page with note 'username already in use'
                        // or redirect to page with an alert that joining two games at once is not currently supported
                        Location: `/404.html`
                    }).end();
                    return;
                }
            }
        }

        // user id is valid
        if(utils.isValidId(user_id)) {
            // & user already playing in game
            let g = get_game_containing_user(user_id);
            if(g && g.get_id() !== params.gameId) {
                // redirect user to that game
                response.writeHead(302, {
                        Location: `/main_page.ejs?gameId=${g.get_id()}&username=${g.get_player(user_id).get_username()}`
                    }).end();
                return;
            }         
        }

    }
    
    let currentGame = null;

    if(fileName === 'main_page.ejs') {
        // join existing game
        if(params.hasOwnProperty('gameId') && 
           games.hasOwnProperty(params['gameId'])) {
            currentGame = games[params['gameId']];

            if(!currentGame.has_player(user_id)) {
                user_id = currentGame.add_new_player();
            }
            
        // start new game
        } else {
            // set current game
            let admin = params.username;
            try {
                currentGame = start_new_game(admin);
            } catch(error) {
                response.writeHead(302, {
                    //TODO: it should show a notation, that username was wrong
                    Location: `/landing_page.html`
                }).end();
                return;
            }
            
            user_id = currentGame.add_new_player();
        }
    }

    // infer correct content type 
    let contentType = utils.ext_to_type(filePath);
    //NOTE: undefined is actually variable window.undefined which can be defined, in that case this would break!
    let encoding = contentType.split('/')[0] === 'image' ? undefined : 'utf-8';

    // read file & send it to client
    fs.readFile(filePath, encoding, function(fs_error, content) {

        // run_helmet(request, response, (h_error) => {
        //     // helmet error
        //     if (h_error) {
        //       response.writeHead(500);
        //       response.end(
        //         "Helmet failed for some unexpected reason. Was it configured correctly?"
        //       );

        //     // helmet set up
        //     } else {
                
        //     }
        // });

        // error while reading the file
        if (fs_error) {
            if(fs_error.code == 'ENOENT') { //TODO: why didn't this throw error, no such file?
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
            // TODO: fix the cors error
            // https://code.jquery.com/jquery-1.12.4.min.js
            // response.setHeader('Access-Control-Allow-Origin', '*');
            // response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
            // response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type'); // If needed
            // response.setHeader('Access-Control-Allow-Credentials', true); // If needed
            
            response.writeHead(200, { 'Content-Type': contentType,
                                    'Set-Cookie': 'user_id=' +  user_id });
            // renderize ejs page
            if(fileName === 'main_page.ejs') {
                let renderizedPage = ejs.render(content, { username: params.username, 
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
            client.data.game_id = game_id;
            client.data.user_id = user_id;

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

        let g = games[client.data.game_id];
        if(g) {
            let p = g.get_player(client.data.user_id);
            if(p && g.is_admin(p)) {
                let player_set = g.set_player_at_board(board, color, username);
                if(player_set) {
                    client.broadcast.to(client.data.game_id).emit('playerJoined', board, color, username);
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

        let g = games[client.data.game_id];
        if(g) {
            let p = g.get_player(client.data.user_id);
            if(p && g.is_admin(p)) {
                let player_removed = g.remove_player_from_board(board, color);
                if(player_removed) {
                    client.broadcast.to(client.data.game_id).emit('playerRemoved', board, color);
                    client.emit('cant_start_game');
                }
            }
        }
    });

    // admin has initiated the game
    client.on('game_has_started', (times) => {
        let g = games[client.data.game_id];
        if(g) {
            let p = g.get_player(client.data.user_id);
            if(p && g.is_admin(p)) {
                g.set_times(times);
                let game_started = g.start();
        
                if(game_started) {
                    client.broadcast.to(client.data.game_id).emit('game_has_started', times);
                }
            }
        }
    });

    // on player move
    client.on('move', (board, move, elapsedTime) => {
        let g = games[client.data.game_id];
        if(g) {
            let p = g.get_player(client.data.user_id);
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
        let g = games[client.data.game_id];
        if(g) {
            let p = g.get_player(client.data.user_id);
            if(p) {
                games[client.data.game_id].resigned(p);
            }
        }
    });

    client.on('reset_game', (fen, sparePieces) => {
        let g = games[client.data.game_id];
        if(g) {
            let p = g.get_player(client.data.user_id);
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

        let g = games[client.data.game_id];
        if(g) {
            let p = g.get_player(client.data.user_id);
            if(p) {
                client.broadcast.to(g.get_id()).emit('disconnected', 
                                                    p.get_username());
                g.remove_player(client.data.user_id);
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