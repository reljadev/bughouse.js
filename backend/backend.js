const ejs = require('ejs')
const http = require('http')
const socket = require('socket.io')
const fs = require('fs')
const utils = require('./utils')

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
            
        // start new game
        } else {
            // set current game
            currentGame = start_new_game()
        }
    }

    // infer correct content type 
    var contentType = utils.ext_to_type(filePath)
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
                var renderizedPage = ejs.render(content, {fen: currentGame.state.fen, sparePieces: currentGame.state.sparePieces});
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

function start_new_game() {
    var game_id = uuid()
    //TODO: this should really be a prototype
    var new_game = {playing: false,
                    state: {fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                            sparePieces: {'white': {'wP': 1, 'wN': 2, 'wB': 1, 'wR': 1, 'wQ': 1},
                                          'black': {'bP': 1, 'bN': 1, 'bB': 1, 'bR': 1, 'bQ': 1}}},
                    players: []}
    games[game_id] = new_game

    return new_game
}

////////////////////////////////////////////////////

// set up websocket
let io = socket(server);

io.on('connection', (client) => {
    console.log('A user just connected.');

    client.on('disconnect', () => {
        console.log('A user has disconnected.');
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