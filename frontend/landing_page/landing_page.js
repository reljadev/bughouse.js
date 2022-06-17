
/***********************************************************/
/*                    INITIALIZATION                       */
/***********************************************************/

let $username = $('#username_input')
let $join_button = $('#join_button');
let $join_container = $('#join_container');
let $id_input = $('#game_id_input');
let $go_button = $('#go_button');
let goButtonClicked = false;

// set default username
let username = setRandomUsername($username)

function setRandomUsername($username) {
    let min = 1000;
    let max = 10000;
    let username = 'user' + getRandomInt(min, max);
    $username.attr("placeholder", username);
    
    return username;
}

function getRandomInt(min, max) {
    //The maximum is exclusive and the minimum is inclusive
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

// add events
$('#start_button').click(startGame);
$join_button.click(onJoinClick);
$id_input.on('blur', onInputBlur);
$go_button.click(goGame);
$(document).on('keypress', onKeyPressed);

/***********************************************************/
/*                         EVENTS                          */
/***********************************************************/

function startGame() {
    username = $username.val() === '' ? username : $username.val();
    let url = '/main_page.ejs?';
    url += 'username=' + username;
    window.location.href = url;
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
    if(goButtonClicked) return; //TODO: really ugly & doesn't truly work
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

function onKeyPressed(evt) {
    // enter pressed
    if(evt.which == 13) {
        if($id_input.css('display') === 'block' &&
            $id_input.is(":focus")) {
            goGame();
        }
    }
}