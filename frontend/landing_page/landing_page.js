const http = require('http')

var $ = window['jQuery']

// set default username
var $username = $('#username_input')
var min = 1000
var max = 9999
var username = 'Guest' + getRandomInt(min, max) // TODO: should be randomly generated
$username.attr("placeholder", username)

// TODO: remove
console.log(window.location)

// start new game
$('#start_button').click(startGame())

function startGame() {
    var game_id = uuid()
    username = $username.val()
    var hostname = window.location.hostname //TODO: add params to GET request

    let requestUrl = url.parse(url.format({
        protocol: 'http',
        hostname: hostname,
        pathname: '/game.html',
        query: {
            gameId: game_id,
            username: username,
        }
    }))

    http.get({
        hostname: requestUrl.hostname,
        path: requestUrl.path,
    }, (res) => {}
    )
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

function uuid () {
    return 'xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/x/g, function (c) {
      var r = (Math.random() * 16) | 0
      return r.toString(16)
    })
}