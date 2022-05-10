let $ = window['jQuery']

// set default username
let $username = $('#username_input')
let username = setRandomUsername($username)

// start new game
$('#start_button').click(startGame);
// join game
$join_button = $('#join_button');
$join_container = $('#join_container');
$id_input = $('#game_id_input');
$go_button = $('#go_button');
let goButtonClicked = false;

$join_button.click(onJoinClick);
$id_input.on('blur', onInputBlur);
$go_button.click(goGame);

function setRandomUsername($username) {
    let min = 1000;
    let max = 10000;
    let username = 'guest' + getRandomInt(min, max);
    $username.attr("placeholder", username);
    
    return username;
}

function getRandomInt(min, max) {
    //The maximum is exclusive and the minimum is inclusive
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

function startGame() {
    username = $username.val() === '' ? username : $username.val();
    let url = window.location.href + 'main_page.ejs?';
    url += 'username=' + username;
    window.location.replace(url);
}

function onJoinClick() {
    $join_button.addClass('hide');
    $join_container.removeClass('hide');
    setTimeout(() => { $join_button.css('display', 'none'); 
                        $join_container.css('display', '');
                        $id_input.focus(); 
                     }, 
                        200);
}

function onInputBlur(evt) {
    if(goButtonClicked) return; //TODO: really ugly
    $join_container.addClass('hide');
    $join_button.removeClass('hide');
    setTimeout(() => { if(goButtonClicked) return;
                        $join_container.css('display', 'none');
                        $join_button.css('display', '');
                     },
                        200);
}

function goGame() {
    goButtonClicked = true;
    $join_container.removeClass('hide');
    $join_button.addClass('hide');

    username = $username.val() === '' ? username : $username.val();
    let game_id = $id_input.val();
    let url = '/main_page.ejs?';
    url += 'username=' + username;
    url += '&';
    url += 'gameId=' + game_id;
    window.location.href = url;
}