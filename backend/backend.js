const ejs = require('ejs')
const http = require('http')
const socket = require('socket.io')
const fs = require('fs')
const utils = require('./utils')
const Chess = require('./modules/chess.js/chess.js')

// CONSTANTS
const PORT = 3000

// create server
const server = http.createServer(function (request, response) {
    console.log('requesting ' + request.url);

    // parse url
    var parsed_url = utils.parse_url(request)
    var fileName = parsed_url.fileName
    var filePath = parsed_url.filePath
    var params = parsed_url.params
    var currentGame = {}

    //TODO: first session id should be checked
    // join existing game
    if(fileName === 'game.ejs') {
        if(params.hasOwnProperty('gameId') && 
           games.hasOwnProperty(params['gameId'])) {
            // TODO: retrieve game information
            // this info should be vetted because it's coming form client side (fen & sparePieces)
            // and user can temper with it, i.e. insert executable code
            currentGame = games[params['gameId']]
            
        // start new game
        } else {
            // set current game
            var admin = params.username
            currentGame = start_new_game(admin)
        }
    }

    // infer correct content type 
    var contentType = utils.ext_to_type(filePath)
    //NOTE: undefined is actually window.undefined which can actually be defined, in that case, this would break!
    var encoding = contentType === 'image/png' ? undefined : 'utf-8'

    // read file & send it to client
    fs.readFile(filePath, encoding, function(error, content) { // TODO: you can use ejs.renderFile
        if (error) {
            if(error.code == 'ENOENT') { //why didn't this throw error, no such file?
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
            response.writeHead(200, { 'Content-Type': contentType });
            // renderize page
            if(fileName === 'game.ejs') {
                var renderizedPage = ejs.render(content, {username: params.username, data: currentGame.info});
                response.end(renderizedPage, 'utf-8'); // nor here
            // plain html, js or css
            } else {
                response.end(content, 'utf-8'); //TODO: probably encoding not needed here
            }
        }
    });

})

///////////////// GAME LOGIC ///////////////////////
var games = {}

function uuid () {
    return 'xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/x/g, function (c) {
      var r = (Math.random() * 16) | 0
      return r.toString(16)
    })
}

function start_new_game(admin) {
    var game_id = uuid()
    //TODO: fen, sparePieces and time should be set up by game creator
    var fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    var sparePieces = {'white': {'wP': 1, 'wN': 2, 'wB': 1, 'wR': 1, 'wQ': 1},
                       'black': {'bP': 1, 'bN': 1, 'bB': 1, 'bR': 1, 'bQ': 1}}
    // initialize game server side
    var game = new Chess(fen, sparePieces)
    //TODO: this should really be a prototype
    var new_game = {game: game,
                    players: [],
                    info: {id: game_id,
                           playing: false,
                           state: {fen: game.fen(),
                                   sparePieces: game.sparePieces()},
                           admin: admin,
                           usernames: [],
                           }
                    }
    games[game_id] = new_game

    return new_game
}

function updateGame(game_id, move) {
    var game = games[game_id]
    // update game
    var executed_move = game.game.move(move)

    // not a valid move
    if(executed_move === null) return false

    // valid move (update game info)
    game.info.state.fen = game.game.fen()
    game.info.state.sparePieces = game.game.sparePieces()

    return true
}

////////////////////////////////////////////////////

// set up websocket
let io = socket(server);

io.on('connection', (client) => {
    console.log('A user just connected.');

    // join game
    var game_id = client.request._query['gameId']
    var username = client.request._query['username']
    if((typeof game_id !== 'undefined' && games.hasOwnProperty(game_id)) &&
       (typeof username !== 'undefined')) {
        client.join(game_id)
        client.data.game_id = game_id
        games[game_id].players.unshift(client)

        client.data.username = username
        games[game_id].info.usernames.unshift(username)
        client.broadcast.to(game_id).emit('joined', username)
    } else {
        //TODO: user should be redirected to landing page
    }

    // on player move
    client.on('move', (move) => {
        var updated = updateGame(client.data.game_id, move)
        if(updated) {
            client.broadcast.to(client.data.game_id).emit('move', move)
        } else {
            client.emit('invalid_move') //TODO: figure out if this is needed for premove
        }
    })

    // on player disconnect
    client.on('disconnect', () => {
        console.log('A user has disconnected.');
        var game_id = client.data.game_id
        var username = client.data.username
        if(typeof games[game_id] !== 'undefined') {
            client.broadcast.to(game_id).emit('disconnected', username)
            utils.remove_item(games[game_id].players, client)
            utils.remove_item(games[game_id].info.usernames, username)
        }
    })
});

// listen for upcomming connection
server.listen(PORT, function(error) {
    if(error) {
        console.log('Error occured while trying to set up a server ' + error)
    } else {
        console.log('Server is listening on port ' + PORT)
    }
})