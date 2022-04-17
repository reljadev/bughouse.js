/***********************************************************/
/*                    INITIALIZATION                       */
/***********************************************************/

///////////////////// RETREIVE DATA //////////////////////
// NOTE: data variable is included at renderization time (runtime)
let myUsername = $('#data_username').attr('data-value');
let data = JSON.parse($('#data_data').attr('data-value'));
let time_white = $('#data_white_time').attr('data-value');
let time_black = $('#data_black_time').attr('data-value');

// TODO: after right click, piece eaten shouldn't be animated
// TODO: landing_page should be in history

let game_id = data.id
console.log(game_id) //TODO: this should be displayed on page
let admin = data.admin
let fen = data.state.fen
let sparePieces = data.state.sparePieces

//// MISC UTIL ////
function get_cookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

let $status = $('#status');
let $fen = $('#fen');
let $pgn = $('#pgn');

//// INITIALIZE GAME ////
data.myUsername = myUsername;
data.move_executed = move_executed;
data.player_joined_board = player_joined_board;
data.player_left_board = player_left_board;
let game = new Game(data);

///////////////////// GAME FUNCTIONS ////////////////////

function move_executed(move, elapsed_time) {
  // send move to server
  server.emit('move', move, elapsed_time);
  updateStatus();
}

function player_joined_board(color, username) {
  server.emit('playerJoined', color, username);
}

function player_left_board(color) {
  server.emit('playerRemoved', color);
}

// when player joins midgame, update status immedietely
if(game.is_playing) {
  updateStatus();
}

//////////////////////// BUTTONS /////////////////////////

// forward and backward buttons
let $backward_button = $('#backward_button');
$backward_button.on('click', game.backward_move.bind(game));
let $forward_button = $('#forward_button');
$forward_button.on('click', game.forward_move.bind(game));
// hide buttons if not playing
if(game.is_pre_game()) {
  $backward_button.css('display', 'none');
  $forward_button.css('display', 'none');
} 

// resign button
let $resign_button = $('#resign_game');
if(!(game.am_i_at_board() && game.is_playing())) {
  $resign_button.css('display', 'none');
}
$resign_button.on('click', resign_game);

// start button
let $start_button = $('#start_game');
// reset button
let $reset_button = $('#reset_game');

if(myUsername !== admin || !game.is_pre_game()) {
  $start_button.css('display', 'none'); //TODO: should be hidden by default
  $reset_button.css('display', 'none');

//// init admin page ////
} else { 
  $start_button.attr('disabled', 'disabled');
  $start_button.on('click', (evt) => { start_game();

                                       // hide start button
                                       $start_button.css('display', 'none');

                                       // notify server of game started
                                       server.emit('game_has_started'); } );

  $reset_button.css('display', 'none');
  $reset_button.on('click', (evt) => { reset_game(fen, sparePieces);

                                       // hide reset button
                                       $reset_button.css('display', 'none');
                                       // show start button
                                       $start_button.css('display', '');
                                       $start_button.attr('disabled', 'disabled');
                                  
                                       // notify server
                                       server.emit('reset_game', fen, sparePieces); } );
}

///////////////////////// EVENTS /////////////////////////

function start_game() {
  game.start();
  
  // show resign button to players
  if(game.am_i_at_board()) {
    $resign_button.css('display', '');
  }
  // show forward, backward buttons
  $forward_button.css('display', '');
  $backward_button.css('display', '');

  // update status
  updateStatus();
}

function resign_game(evt) {
  gameIsOver('resignation');
  // hide resign button
  $resign_button.css('display', 'none');
}

function reset_game(fen, sparePieces) {
  game.reset(fen, sparePieces);

  // hide forward & backward buttons
  $forward_button.css('display', 'none');
  $backward_button.css('display', 'none');

  // status
  resetStatus();
}

function gameIsOver() {
  if(myUsername === admin) {
    $reset_button.css('display', '');
  }
  server.emit('game_is_over');
}

//////////////////// STATUS FUNCTIONS ////////////////////

function updateStatus () {
let status = ''

let moveColor = 'White'
if (game.turn() === 'b') {
  moveColor = 'Black'
}

// checkmate?
if (game.in_checkmate()) {
  status = 'Game over, ' + moveColor + ' is in checkmate.'
  gameIsOver('checkmate')
}

// draw?
else if (game.in_draw()) {
  status = 'Game over, drawn position'
}

// game still on
else {
  status = moveColor + ' to move'
  
  // check?
  if (game.in_check()) {
    status += ', ' + moveColor + ' is in check'
  }
}

$status.html(status)
$fen.html(game.fen())
$pgn.html(game.pgn())
}

function resetStatus() {
$status.html('')
$fen.html('')
$pgn.html('')
}

/***********************************************************/
/*                       SOCKET IO                         */
/***********************************************************/

// connect to server
// NOTE: io is imported in game.ejs
const server = io('/',  { query: "gameId=" + game_id + 
                                  "&user_id=" + get_cookie('user_id') + 
                                  "&username=" + myUsername })

// opponent moved
server.on('move', (move, whiteClock, blackClock) => {
  game.move(move);
  game.set_clocks(whiteClock, blackClock);

  updateStatus();
})

// some player joined
server.on('joined', (username) => {
  game.add_player(username);
})

// player added to chessboard
server.on('playerJoined', (color, username) => {
  game.add_player_to_board(color, username);
})

// removed player from chessboard
server.on('playerRemoved', (color) => {
  game.remove_player_from_board(color);
})

// admin can start a game
server.on('can_start_game', () => {
  // NOTE: this will never be sent to a client that's not an admin
  $start_button.removeAttr('disabled')
})

// admin can't start a game
server.on('cant_start_game', () => {
  // NOTE: this will never be sent to a client that's not an admin
  $start_button.attr('disabled', 'disabled')
})

// admin initiated new game
server.on('game_has_started', () => {
  start_game();
})

server.on('game_is_over', (message) => {
  game.game_over(); 
  
  // show reset button
  if(myUsername === admin) {
    $reset_button.css('display', '')
  }
  // hide resign button
  $resign_button.css('display', 'none')
  // TODO: show pop up dialog
  if(message) {
    console.log(message)
  }
})

server.on('reset_game', (fen, sparePieces) => {
  reset_game(fen, sparePieces);
})

// some player disconnected
server.on('disconnected', (username) => {
  game.remove_player(username);
})