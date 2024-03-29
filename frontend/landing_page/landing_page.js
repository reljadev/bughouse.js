
function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
  }

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
    setCookie('username', username);
    window.location.href = '/main_page.html';
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
    if(goButtonClicked) return;
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
    setCookie('username', username);
    setCookie('game_id', game_id);

    window.location.href = '/main_page.html';
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