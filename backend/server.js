const ejs = require('ejs')
const http = require('http')
const socket = require('socket.io')
const fs = require('fs')
const utils = require('./utils')
const Game = require('./game')

// CONSTANTS
const PORT = process.env.PORT || 3000;

// create server
const server = http.createServer(function (request, response) {
    console.log('requesting ' + request.url);

    // parse url
    var parsed_url = utils.parse_url(request);
    var fileName = parsed_url.fileName;
    var filePath = parsed_url.filePath;
    var params = parsed_url.params;
    // parse cookies
    var cookies = utils.parse_cookies(request);
    var user_id = cookies.user_id;

    // if user wants game.ejs or landing page
    if(fileName === '' || fileName === 'landing_page.html' || fileName === 'game.ejs') {
        // & user id is valid
        if(utils.isValidId(user_id)) {
            // & user already playing in game
            var g = get_game_containing_user(user_id);
            if(g && g.get_id() !== params.gameId) {
                // redirect user to that game
                response.writeHead(302, { //TODO: change this to absolute path, because it causes problems
                        Location: `/game.ejs?gameId=${g.get_id()}&username=${g.get_player(user_id).get_username()}`
                    }).end();
                return
            }         
        }
    }
    
    var currentGame = null;

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
            var admin = params.username;
            currentGame = start_new_game(admin);
            user_id = currentGame.add_new_player();
        }
    }

    // infer correct content type 
    var contentType = utils.ext_to_type(filePath);
    //NOTE: undefined is actually variable window.undefined which can be defined, in that case, this would break!
    var encoding = contentType === 'image/png' ? undefined : 'utf-8';

    // read file & send it to client
    fs.readFile(filePath, encoding, function(error, content) { // TODO: you can use ejs.renderFile
        if (error) {
            if(error.code == 'ENOENT') { //TODO: why didn't this throw error, no such file?
                fs.readFile('./404.html', function(error, content) {
                    response.writeHead(200, { 'Content-Type': contentType });
                    response.end(content, 'utf-8');
                });
            }
            else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
                response.end(); 
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType,
                                      'Set-Cookie': 'user_id=' +  user_id});
            // renderize page
            if(fileName === 'game.ejs') {
                var renderizedPage = ejs.render(content, {username: params.username, 
                                                          data: currentGame.info(),
                                                          white_time: currentGame.get_white_time(),
                                                          black_time: currentGame.get_black_time()});
                response.end(renderizedPage, 'utf-8'); // nor here
            // plain html, js or css
            } else {
                response.end(content, 'utf-8'); //TODO: probably encoding not needed here
            }
        }
    });

})

///////////////// GAME LOGIC ///////////////////////
var games = {};

function start_new_game(admin) { //TODO: remove this function
    //TODO: fen, sparePieces and time should be set up by game admin
    var fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    var sparePieces = {'white': {'wP': 1, 'wN': 2, 'wB': 1, 'wR': 1, 'wQ': 1},
                       'black': {'bP': 1, 'bN': 1, 'bB': 1, 'bR': 1, 'bQ': 1}};
    
    let g = new Game({ admin: admin, fen: fen, spares: sparePieces });
    games[g.get_id()] = g;

    return g;
}

function get_game_containing_user(user_id) {
    if(typeof user_id === 'undefined') return false;

    for(var i in games) {
        if(games[i].has_player(user_id)) {
            return games[i];
        }
    }
    
    return false;
}

//////////////// set up websocket /////////////////////

let io = socket(server);

io.on('connection', (client) => {
    console.log('A user just connected.');

    var game_id = client.request._query['gameId'];
    var user_id = client.request._query['user_id'];
    var username = client.request._query['username'];
    if((typeof game_id !== 'undefined' && games.hasOwnProperty(game_id)) &&
       (typeof username !== 'undefined')) { //TODO: username should be checked on page serving

        client.join(game_id);
        client.data.game_id = game_id;
        client.data.user_id = user_id;

        // update player username & socket
        let p = games[game_id].get_player(user_id);
        p.set_username(username);
        p.set_socket(client);

        client.broadcast.to(game_id).emit('joined', username);
    }

    // player set at chessboard
    client.on('playerJoined', (color, username) => {
        client.broadcast.to(client.data.game_id).emit('playerJoined', color, username);

        let g = games[client.data.game_id];
        g.set_player_at_board(color, username);

        if(g.board_is_set()) {
            client.emit('can_start_game');
        }
    })

    // player removed from chessboard
    client.on('playerRemoved', (color) => {
        client.broadcast.to(client.data.game_id).emit('playerRemoved', color);

        var g = games[client.data.game_id];
        g.remove_player_from_board(color);

        // this informs admin that it can't start a game
        client.emit('cant_start_game');
    })

    // admin has initiated the game
    client.on('game_has_started', () => {
        var g = games[client.data.game_id];
        g.start();
        
        client.broadcast.to(client.data.game_id).emit('game_has_started');
    })

    // on player move
    client.on('move', (move, elapsedTime) => {
        let g = games[client.data.game_id];
        var updated = g.move(move);
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
    })

    client.on('game_is_over', () => {
        games[client.data.game_id].game_over(games[client.data.game_id]
                                                .get_player(client.data.user_id)
                                                .get_username());
    })

    client.on('reset_game', (fen, sparePieces) => {
        var g = games[client.data.game_id];
        g.set_position(fen, sparePieces);
        g.reset();
        
        client.broadcast.to(game_id).emit('reset_game', fen, sparePieces);
    })

    // player has disconnected
    client.on('disconnect', () => {
        console.log('A user has disconnected.');

        let g = games[client.data.game_id];
        if(typeof g !== 'undefined') {
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