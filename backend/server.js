const ejs = require('ejs')
const http = require('http')
const helmet = require('helmet')
const socket = require('socket.io')
const fs = require('fs')
const utils = require('./utils')
const sanitize = require('sanitize-html')
const Game = require('./game')

// TODO: testing

// games functions
let games = {};

function start_new_game(admin) {
    //TODO: fen, sparePieces and time should be set up by game admin
    let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    let sparePieces = {'white': {'wP': 1, 'wN': 2, 'wB': 1, 'wR': 1, 'wQ': 1},
                       'black': {'bP': 1, 'bN': 1, 'bB': 1, 'bR': 1, 'bQ': 1}};
    
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
const run_helmet = helmet({ contentSecurityPolicy: { 
                                directives: {"script-src": ["'self'", "https://code.jquery.com/jquery-1.12.4.min.js"], 
                                            "style-src": ["'self'", "'unsafe-inline'"], 
                                            "frame-ancestors": ["'none'"],} },
                            frameguard: {action: "deny"},
                            crossOriginResourcePolicy: { policy: "cross-origin" },
                        });

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

    // if user wants game.ejs or landing page
    if(fileName === '' || fileName === 'landing_page.html' || fileName === 'game.ejs') {
        // & user id is valid
        if(utils.isValidId(user_id)) {
            // & user already playing in game
            let g = get_game_containing_user(user_id);
            if(g && g.get_id() !== params.gameId) {
                // redirect user to that game
                response.writeHead(302, {
                        Location: `/game.ejs?gameId=${g.get_id()}&username=${g.get_player(user_id).get_username()}`
                    }).end();
                return
            }         
        }
    }
    
    let currentGame = null;

    if(fileName === 'game.ejs') {
        // join existing game
        if(params.hasOwnProperty('gameId') && 
           games.hasOwnProperty(params['gameId'])) {
            // TODO: this info should be vetted because it's coming from client side (fen & sparePieces)
            // and user can temper with it, i.e. insert executable code
            currentGame = games[params['gameId']];

            if(!currentGame.has_player(user_id)) {
                user_id = currentGame.add_new_player();
            }
            
        // start new game
        } else {
            // set current game
            let admin = params.username;
            currentGame = start_new_game(admin);
            user_id = currentGame.add_new_player();
        }
    }

    // infer correct content type 
    let contentType = utils.ext_to_type(filePath);
    //NOTE: undefined is actually variable window.undefined which can be defined, in that case, this would break!
    let encoding = contentType === 'image/png' ? undefined : 'utf-8';

    // read file & send it to client
    fs.readFile(filePath, encoding, function(fs_error, content) { // TODO: you can use ejs.renderFile

        run_helmet(request, response, (h_error) => {
            // helmet error
            if (h_error) {
              response.writeHead(500);
              response.end(
                "Helmet failed for some unexpected reason. Was it configured correctly?"
              );

            // helmet set up
            } else {
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
                    response.writeHead(200, { 'Content-Type': contentType,
                                              'Set-Cookie': 'user_id=' +  user_id });
                    // renderize ejs page
                    if(fileName === 'game.ejs') {
                        let renderizedPage = ejs.render(content, {username: params.username, 
                                                                  data: currentGame.info(),
                                                                  white_time: currentGame.get_white_time(),
                                                                  black_time: currentGame.get_black_time()});
                        response.end(renderizedPage, 'utf-8');
        
                    // html, js or css file
                    } else {
                        response.end(content, 'utf-8');
                    }
                }
            }
        });
        
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
       (typeof username !== 'undefined')) { //TODO: username should be checked on page serving
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

    // player set at chessboard
    client.on('playerJoined', (color, username) => {
        // sanitize client suplied data
        color = sanitize(color);
        username = sanitize(username);

        let g = games[client.data.game_id];
        if(g) {
            let player_set = g.set_player_at_board(color, username);

            if(player_set) {
                client.broadcast.to(client.data.game_id).emit('playerJoined', color, username);
                if(g.board_is_set()) {
                    client.emit('can_start_game');
                }
            }
        }
    })

    // player removed from chessboard
    client.on('playerRemoved', (color) => {
        // sanitize client suplied data
        color = sanitize(color);

        let g = games[client.data.game_id];
        if(g) {
            let player_removed = g.remove_player_from_board(color);

            if(player_removed) {
                client.broadcast.to(client.data.game_id).emit('playerRemoved', color);
                client.emit('cant_start_game');
            }
        }
    })

    // admin has initiated the game
    client.on('game_has_started', () => {
        let g = games[client.data.game_id];
        if(g) {
            let game_started = g.start();
        
            if(game_started) {
                client.broadcast.to(client.data.game_id).emit('game_has_started');
            }
        }
    })

    // on player move
    client.on('move', (move, elapsedTime) => {
        let g = games[client.data.game_id];
        if(g) {
            let updated = g.move(move);
            if(updated) {
                g.update_timers(elapsedTime);
                // broadcast move & updated timers
                client.broadcast.to(g.get_id()).emit('move', move,
                                                            g.get_white_time(),
                                                            g.get_black_time());
            } else {
                // NOTE: this should never happen
                client.emit('invalid_move', move);
            }
        }
    })

    client.on('game_is_over', () => {
        games[client.data.game_id].game_over(games[client.data.game_id]
                                                .get_player(client.data.user_id)
                                                .get_username());
    })

    client.on('reset_game', (fen, sparePieces) => {
        let g = games[client.data.game_id];
        if(g) {
            let position_set = g.set_position(fen, sparePieces);
            if(position_set) {
                g.reset();
            
                client.broadcast.to(game_id).emit('reset_game', fen, sparePieces);
            }
        }
    })

    // player has disconnected
    client.on('disconnect', () => {
        console.log('A user has disconnected.');

        let g = games[client.data.game_id];
        if(g) {
            client.broadcast.to(g.get_id()).emit('disconnected', 
                                                    g.get_player(client.data.user_id).get_username());
            g.remove_player(client.data.user_id);
        }
    })
});

// listen for upcomming connection
server.listen(PORT, function(error) {
    if(error) {
        console.log('Error occured while trying to set up a server ' + error);
    } else {
        console.log('Server is listening on port ' + PORT);
    }
})