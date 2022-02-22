var $ = window['jQuery']

// set default username
var $username = $('#username_input')
var min = 1000
var max = 10000
var username = 'Guest' + getRandomInt(min, max) // TODO: should be randomly generated
$username.attr("placeholder", username) 

// start new game
$('#start_button').click(() => {startGame()})

function startGame() {
    // var game_id = uuid()
    username = $username.val() === '' ? username : $username.val()
    var url = window.location.href + 'game.html?'
    // url += 'gameId=' + game_id + '&'
    url += 'username=' + username
    window.location.replace(url)
}

function getRandomInt(min, max) {
    //The maximum is exclusive and the minimum is inclusive
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}