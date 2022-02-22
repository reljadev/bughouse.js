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

    return {filePath: filePath, params: params}
}

// create server
const server = http.createServer(function (request, response) {
    console.log('requesting ' + request.url);

    // parse url
    var parsed_url = parse_url(request)
    var filePath = parsed_url.filePath
    var params = parsed_url.params

    //TODO: first session id should be checked
    // join existing game
    if(params.hasOwnProperty('gameId') && 
       games.hasOwnProperty(params['gameId'])) {
        
    // start new game
    } else {
        var game_id = uuid()
        // games[game_id] = ...
    }

    // infer correct content type
    var extname = path.extname(filePath);
    const ext_to_type = {'.html': 'text/html', '.js': 'text/javascript',
                         '.css': 'text/css', '.json': 'application/json',
                         '.png': 'image/png', '.jpg': 'image/jpg',
                         '.ico': 'image/x-icon'}
    var contentType = ext_to_type[extname]

    // read file & send it to client
    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT') {
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
            response.end(content, 'utf-8');
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