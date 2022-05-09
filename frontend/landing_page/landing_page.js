let $ = window['jQuery']

// set default username
let $username = $('#username_input')
let username = setRandomUsername($username)

// start new game
$('#start_button').click(() => {startGame()})
// join game
$join_button = $('#join_button');
$join_container = $('#join_container');
$id_input = $('#game_id_input');

function setRandomUsername($username) {
    let min = 1000
    let max = 10000
    let username = 'guest' + getRandomInt(min, max)
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
    let url = window.location.href + 'main_page.ejs?'
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
    let game_id = $('#gameId_input').val()
    let url = window.location.href + 'main_page.ejs?'
    url += 'username=' + username
    url += '&'
    url += 'gameId=' + game_id
    window.location.replace(url)
}

$join_button.click((evt) => {   $join_button.addClass('hide');
                                $join_container.removeClass('hide');
                                setTimeout(() => { $join_button.css('display', 'none'); 
                                                    $join_container.css('display', '');
                                                    $id_input.focus(); 
                                                 }, 
                                                    200); 
                            });
$id_input.on('blur', (evt) => { $join_container.addClass('hide');
                                $join_button.removeClass('hide');
                                setTimeout(() => { $join_container.css('display', 'none');
                                                    $join_button.css('display', '');
                                                 },
                                                    200);
                            });