const http = require('http')
const fs = require('fs')
const port = 3200

const server = http.createServer(function(request, response) {
    response.writeHead(200, {'Content-Type': 'text/html'})
    fs.readFile('/home/relja/src/bughouse.js/index.html', function(error, data) {
        if(error) {
            response.writeHead(404)
            response.write('Error: File Not Found')
        } else {
            response.write(data)
        }
        response.end()
    })
})

server.listen(port, function(error) {
    if(error) {
        console.log('Error occured while trying to set up a server ' + error)
    } else {
        console.log('Server is listening on port ' + port)
    }
})