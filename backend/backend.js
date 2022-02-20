const http = require('http')
const socket = require('socket.io')
const fs = require('fs')
const path = require('path')

const port = 3000
const dirpath = '../frontend'

// serve static files
// TODO: if you don't use, remove module
// with express library 
//const express = require('express')
//const app = express()
//const server = http.createServer(app)
//app.use(express.static('../frontend'))

// const server = http.createServer(function(request, response) {
    
//     fs.readFile('../frontend/index.html', function(error, data) {
//         if(error) {
//             response.writeHead(404)
//             response.write('Error: File Not Found')
//         } else {
//             response.writeHead(200, {'Content-Type': 'text/html'})
//             response.write(data)
//         }
//         response.end()
//     })
// })

function parse_url(url) {
    let file_name = url.substring(0, url.indexOf('?'))
    file_name = file_name === '' ? url : file_name
    let folder_name = file_name.substring(0, file_name.indexOf('.'))
    if(file_name === '/') {
        // var filePath = dirpath + '/game/game.html'
        var filePath = dirpath + '/landing_page/landing_page.html'
    } else if(folder_name === '/game' || folder_name === '/landing_page'){
        var filePath = dirpath + folder_name + file_name
    } else {
        var filePath = dirpath + file_name
    }
    return filePath
}

// without express library
const server = http.createServer(function (request, response) {
    console.log('requesting ' + request.url);

    //TOOD: this is an ugly hack
    var filePath = parse_url(request.url)

    var extname = path.extname(filePath);
    const ext_to_type = {'.html': 'text/html', '.js': 'text/javascript',
                         '.css': 'text/css', '.json': 'application/json',
                         '.png': 'image/png', '.jpg': 'image/jpg',
                         '.ico': 'image/x-icon'}
    var contentType = ext_to_type[extname]

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
                response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                response.end(); 
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });

})

let io = socket(server);

io.on('connection', (client) => {
    console.log('A user just connected.');

    client.on('disconnect', () => {
        console.log('A user has disconnected.');
    })
});

server.listen(port, function(error) {
    if(error) {
        console.log('Error occured while trying to set up a server ' + error)
    } else {
        console.log('Server is listening on port ' + port)
    }
})