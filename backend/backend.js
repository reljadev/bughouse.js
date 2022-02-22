const ejs = require('ejs')
const http = require('http')
const socket = require('socket.io')
const fs = require('fs')
const path = require('path')

// CONSTANTS
const PORT = 3000
const DIRPATH = '../frontend'
const DEFAULT_PAGE = '/landing_page/landing_page.html'

//TODO: this is an ugly hack
function parse_url(request) {
    // form URL
    var baseURL = 'http://' + request.headers.host + '/';
    var parser = new URL(request.url, baseURL);

    // convert request url to file path
    var folder_name = parser.pathname.substring(0, parser.pathname.indexOf('.'))
    if(folder_name === '') {
        // var filePath = DIRPATH + '/game/game.html'
        var filePath = DIRPATH + DEFAULT_PAGE
    } else if(folder_name === '/game' || folder_name === '/landing_page') {
        var filePath = DIRPATH + folder_name + parser.pathname
    } else {
        var filePath = DIRPATH + parser.pathname
    }
    
    // get request parameters
    var params = parser.searchParams

    return {fileName: parser.pathname.substring(1), filePath: filePath, params: params}
}

function ext_to_type(filePath) {
    var extname = path.extname(filePath);
    const ext_to_type = {'.html': 'text/html', '.js': 'text/javascript',
                         '.css': 'text/css', '.json': 'application/json',
                         '.png': 'image/png', '.jpg': 'image/jpg',
                         '.ico': 'image/x-icon', '.ejs': 'text/html'}
    return ext_to_type[extname]
}

// create server
const server = http.createServer(function (request, response) {
    console.log('requesting ' + request.url);

    // parse url
    var parsed_url = parse_url(request)
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
            var game_id = uuid()
            //TODO: this should really be a prototype
            var new_game = {playing: false,
                            state: {fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                                    sparePieces: {'white': {'wP': 1, 'wN': 2, 'wB': 1, 'wR': 1, 'wQ': 1},
                                                'black': {'bP': 1, 'bN': 1, 'bB': 1, 'bR': 1, 'bQ': 1}}},
                            players: []}
            games[game_id] = new_game

            // set current game
            currentGame = new_game

            //TODO: send this game id to client with the generated files
        }
    }

    // infer correct content type 
    var contentType = ext_to_type(filePath)
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