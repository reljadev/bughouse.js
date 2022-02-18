const http = require('http')
const socket = require('socket.io')
const fs = require('fs')
const path = require('path')

const port = 3000

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

// without express library
const server = http.createServer(function (request, response) {
    console.log('requesting ' + request.url);

    const dirpath = '../frontend';
    if(request.url === '/') {
        var filePath = dirpath + '/login/login.html'
    } else {
        var filePath = dirpath + request.url;
    }

    var extname = path.extname(filePath);
    const ext_to_type = {'.html': 'text/html', '.js': 'text/javascript',
                         '.css': 'text/css', '.json': 'application/json',
                         '.png': 'image/png', '.jpg': 'image/jpg',
                         '.wav': 'audio/wav'}
    var contentType = ext_to_type[extname]

    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT'){
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

io.on('connection', (socket) => {
    console.log('A user just connected.');

    socket.on('disconnect', () => {
        console.log('A user has disconnected.');
    })

    socket.on('buttonClicked', () => {
        console.log('Button clicked arrived to server')
    });
});

server.listen(port, function(error) {
    if(error) {
        console.log('Error occured while trying to set up a server ' + error)
    } else {
        console.log('Server is listening on port ' + port)
    }
})