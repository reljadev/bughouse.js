const ejs = require('ejs')
const http = require('http')
const socket = require('socket.io')
const fs = require('fs')
const utils = require('./utils')
const Chess = require('./modules/chess.js/chess.js')
const Stopwatch = require('./stopwatch')

// CONSTANTS
const PORT = process.env.PORT || 3000

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
                var renderizedPage = ejs.render(content, {username: params.username, data: currentGame.info,
                                                          white_time: currentGame.white_timer.time(),
                                                          black_time: currentGame.black_timer.time()});
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
                    players: [], //TODO: this is probably not needed
                    white_timer: new Stopwatch({delay: 100, 
                                                clock: 1 * 1100 * 60,
                                                onTimesUp: gameOver}), //TODO: pass the game that it is attached to
                    black_timer: new Stopwatch({delay: 100,
                                                clock: 1 * 1100 * 60,
                                                onTimesUp: gameOver}),
                    info: {id: game_id, //don't need this
                           playing: false,
                           state: {fen: game.fen(), //do i need fen, spares if i have start and pgn?
                                   sparePieces: game.sparePieces(),
                                   start_fen: game.fen(),
                                   start_spares: deepCopy(game.sparePieces()),
                                   pgn: '',
                                   },
                           white_player: null,
                           black_player: null,
                           turn: 'w',
                           admin: admin,
                           usernames: [],
                           }
                    }
    games[game_id] = new_game

    return new_game
}

function deepCopy(obj) { //TODO: replace this or move it somewhere
    var copy = {}

    for (var property in obj) {
      if (typeof obj[property] === 'object') {
        copy[property] = deepCopy(obj[property])
      } else {
        copy[property] = obj[property]
      }
    }

    return copy
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
    game.info.state.pgn = game.game.pgn()
    game.info.turn = game.game.turn()

    return true
}

function gameOver(game, username) {
    game.info.playing = false
    game.white_timer.stop()
    game.black_timer.stop()
    var messages = getPopUpMessages(game,
                                    game.info.white_player, game.info.black_player,
                                    username)
    for(var i in game.players) {
        var player = game.players[i]
        // white player
        if(player.data.username === game.info.white_player) {
            player.emit('game_is_over', messages.white)
        // black player
        } else if(player.data.username === game.info.black_player) {
            player.emit('game_is_over', messages.black)
        // watcher    
        } else {
            player.emit('game_is_over', messages.watcher)
        }
    }
}

function getPopUpMessages(g, white_player, black_player, player) {
    var game = g.game
    var msgForWatchers = ''
    var msgForWhite = ''
    var msgForBlack = ''

    // checkmate
    if (game.in_checkmate()) {
        if(game.turn() === 'w') {
            msgForWatchers = 'Game over, ' + white_player + ' is in checkmate'
            msgForWhite = 'You lost, by checkmate'
            msgForBlack = 'You won, by checkmate'
        } else {
            msgForWatchers = 'Game over, ' + black_player + ' is in checkmate'
            msgForWhite = 'You won, by checkmate'
            msgForBlack = 'You lost, by checkmate'
        }
    // draw
    } else if (game.in_draw()) {
        msgForWatchers = 'Draw'
        msgForWhite = 'Draw'
        msgForBlack = 'Draw' //TODO: why is it a draw, insufficient material??
    // white ran out of time
    } else if(g.white_timer.time() === 0) {
        msgForWatchers = 'Game over, ' + white_player + ' ran out of time'
        msgForWhite = 'You lost, on time'
        msgForBlack = 'You won, on time'
    // black ran out of time
    } else if(g.black_timer.time() === 0) {
        msgForWatchers = 'Game over, ' + black_player + ' ran out of time'
        msgForWhite = 'You won, on time'
        msgForBlack = 'You lost, on time'
    // resignation
    } else {
        if(player === white_player) {
            msgForWatchers = 'Game over, ' + white_player + ' resigned'
            msgForWhite = 'You lost, by resignation'
            msgForBlack = 'You won, by resignation'
        } else {
            msgForWatchers = 'Game over, ' + black_player + ' resigned'
            msgForWhite = 'You won, by resignation'
            msgForBlack = 'You lost, by resignation'
        }
    }

    return {white: msgForWhite, black: msgForBlack, watcher: msgForWatchers}        
}

function updateTimers(game, elapsedTime) {
    if(game.info.turn === 'w') {
        game.black_timer.stop()
        game.white_timer.start()
        refundLagTime(game.black_timer, elapsedTime)
    } else {
        game.white_timer.stop()
        game.black_timer.start()
        refundLagTime(game.white_timer, elapsedTime)
    }
}

function refundLagTime(timer, elapsedTime) {
    var offset = timer.elapsedTime() - elapsedTime
    var clampedOffset = Math.min(Math.max(-1000, offset), 1000)
    timer.add(clampedOffset)
}

//////////////// set up websocket /////////////////////

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

    // player set at chessboard
    client.on('playerJoined', (color, username) => {
        client.broadcast.to(client.data.game_id).emit('playerJoined', color, username)

        var info = games[client.data.game_id].info
        // update players
        if(color === 'white') {
            info.white_player = username
        } else {
            info.black_player = username
        }

        // this checks if all conditions for starting a game are fullfiled
        if(info.white_player !== null && info.black_player !== null) {
            client.emit('can_start_game')
        }
    })

    // TODO: i don;t think you need username
    // player removed from chessboard
    client.on('playerRemoved', (color) => {
        client.broadcast.to(client.data.game_id).emit('playerRemoved', color)

        var info = games[client.data.game_id].info
        // update players
        if(color === 'white') {
            info.white_player = null
        } else {
            info.black_player = null
        }

        // this informs admin that it can't start a game
        client.emit('cant_start_game')
    })

    // game has started
    client.on('game_has_started', () => {
        var game = games[client.data.game_id]
        game.info.playing = true
        game.white_timer.reset()
        game.black_timer.reset()
        game.white_timer.start()
        client.broadcast.to(client.data.game_id).emit('game_has_started')
    })

    // on player move
    client.on('move', (move, elapsedTime) => {
        var updated = updateGame(client.data.game_id, move)
        if(updated) {
            var game = games[client.data.game_id]
            
            updateTimers(game, elapsedTime)
            // broadcast move & updated timers
            client.broadcast.to(client.data.game_id).emit('move', move,
                                                                  game.white_timer.time(),
                                                                  game.black_timer.time())
        } else {
            client.emit('invalid_move') //TODO: figure out if this is needed for premove
        }
    })

    client.on('game_is_over', () => {
        var game = games[client.data.game_id]
        gameOver(game, client.data.username)
    })

    client.on('reset_game', (fen, sparePieces) => {
        var game_id = client.data.game_id
        // update game
        games[game_id].game.load(fen)
        games[game_id].game.loadSpares(sparePieces)
        // update game info
        games[game_id].info.state.fen = fen
        games[game_id].info.state.sparePieces = sparePieces
        games[game_id].info.state.pgn = ''
        games[game_id].info.white_player = null
        games[game_id].info.black_player = null
        // broadcast changes
        client.broadcast.to(client.data.game_id).emit('reset_game', fen, sparePieces)
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