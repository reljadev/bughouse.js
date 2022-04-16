var $ = window['jQuery']

// set default username
var $username = $('#username_input')
var username = setRandomUsername($username)

// start new game
$('#start_button').click(() => {startGame()})
// join game
$('#join_button').click(() => {joinGame()})

function setRandomUsername($username) {
    var min = 1000
    var max = 10000
    var username = 'guest' + getRandomInt(min, max)
    $username.attr("placeholder", username) 
    
    return username
}

function getRandomInt(min, max) {
    //The maximum is exclusive and the minimum is inclusive
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

function startGame() {
    username = $username.val() === '' ? username : $username.val()
    var url = window.location.href + 'main_page.ejs?'
    url += 'username=' + username
    window.location.replace(url)
}

function joinGame() {
    $('#gameId_input').css('display', 'block')
    $go_button = $('#go_button')
    $go_button.css('display', 'block')
    // go game
    $go_button.click(() => {goGame()})
    $('#join_button').css('display', 'none')
}

function goGame() {
    username = $username.val() === '' ? username : $username.val()
    var game_id = $('#gameId_input').val()
    var url = window.location.href + 'main_page.ejs?'
    url += 'username=' + username
    url += '&'
    url += 'gameId=' + game_id
    window.location.replace(url)
}