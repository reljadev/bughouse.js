/***********************************************************/
/*                    INITIALIZATION                       */
/***********************************************************/

///////////////////// RETREIVE DATA //////////////////////
// NOTE: data variable is included at renderization time (runtime)
let myUsername = $('#data_username').attr('data-value');
let data = JSON.parse($('#data_data').attr('data-value'));

// TODO: after right click, piece eaten shouldn't be animated

let game_id = data.id;
let admin = data.admin;
let fen = data.first_board.fen;
let sparePieces = data.first_board.sparePieces;

//// MISC UTIL ////
function get_cookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

// display invite link
let $text_id = $('#text_game_id');
$text_id.val(game_id);
$text_id.prop("readonly", true);

let $status1 = $('#status_1');
let $pgn1 = $('#pgn_1');
let $status2 = $('#status_2');
let $pgn2 = $('#pgn_2');

let $msg = $('#game_over_msg');

//// INITIALIZE GAME ////
data.myUsername = myUsername;
data.move_executed = move_executed;
data.player_joined_board = player_joined_board;
data.player_left_board = player_left_board;
let game = new Game(data);

///////////////////// GAME FUNCTIONS ////////////////////

function move_executed(board, move, elapsed_time) {
  // send move to server
  server.emit('move', board, move, elapsed_time);
  updateStatus();
}

function player_joined_board(board, color, username) {
  server.emit('playerJoined', board, color, username);
}

function player_left_board(board, color) {
  server.emit('playerRemoved', board, color);
}

// when player joins midgame, update status immedietely
if(game.is_playing) {
  updateStatus();
}

//////////////////////// BUTTONS /////////////////////////

// forward and backward buttons on first board
let $backward_button1 = $('#backward_button_1');
$backward_button1.on('click', game.backward_move.bind(game, 'first'));
let $forward_button1 = $('#forward_button_1');
$forward_button1.on('click', game.forward_move.bind(game, 'first'));
// on second
let $backward_button2 = $('#backward_button_2');
$backward_button2.on('click', game.backward_move.bind(game, 'second'));
let $forward_button2 = $('#forward_button_2');
$forward_button2.on('click', game.forward_move.bind(game, 'second'));
// hide buttons if not playing
if(game.is_pre_game()) {
  $backward_button1.css('display', 'none');
  $forward_button1.css('display', 'none');
  $backward_button2.css('display', 'none');
  $forward_button2.css('display', 'none');
} 

// resign button
$('#resign_game1').css('display', 'none');
$('#resign_game2').css('display', 'none');
let $resign_button = null;
if(game.am_i_at_board() && game.is_playing()) {
  // i'm at first board
  if(myUsername === data.white_player1 ||
    myUsername === data.black_player1) {
      $resign_button = $('#resign_game1');
  // i'm at second board
  } else {
      $resign_button = $('#resign_game2');
  }

  $resign_button.on('click', resign_game);
  $resign_button.css('display', '');
}

// start button
let $start_button = $('#start_game');
$start_button.on('click', function(evt) { 
    start_game();
    // hide start button
    $start_button.css('display', 'none');
    // notify server of game started
    server.emit('game_has_started'); 
  } );

// reset button
let $reset_button = $('#reset_game');
$reset_button.on('click', function(evt) { 
    reset_game(fen, sparePieces);
    // hide reset button
    $reset_button.css('display', 'none');
    // show start button
    $start_button.css('display', '');
    $start_button.attr('disabled', 'disabled');
    // delete game over message
    $msg.text('');
    // notify server
    server.emit('reset_game', fen, sparePieces); 
  } );

if(myUsername !== admin || !game.is_pre_game()) {
  $start_button.css('display', 'none'); //TODO: should be hidden by default
  $reset_button.css('display', 'none');

//// init admin page ////
} else { 
  $start_button.attr('disabled', 'disabled');
  $reset_button.css('display', 'none');
}

///////////////////////// EVENTS /////////////////////////

function start_game() {
  game.start();
  
  // show resign button to players
  if(game.am_i_at_board()) {
    if(myUsername === data.white_player1 ||
      myUsername === data.black_player1) {
        $resign_button = $('#resign_game1');
      } else {
        $resign_button = $('#resign_game2');
    }
    $resign_button.on('click', resign_game);
    $resign_button.css('display', '');
  }
  // show forward, backward buttons
  $forward_button1.css('display', '');
  $backward_button1.css('display', '');
  $forward_button2.css('display', '');
  $backward_button2.css('display', '');

  // update status
  updateStatus();
}

function resign_game(evt) {
  if(myUsername === admin) {
    $reset_button.css('display', '');
  }
  // hide resign button
  $resign_button.css('display', 'none');

  server.emit('resigned');
}

function reset_game(fen, sparePieces) {
  game.reset(fen, sparePieces);

  // hide forward & backward buttons
  $forward_button1.css('display', 'none');
  $backward_button1.css('display', 'none');
  $forward_button2.css('display', 'none');
  $backward_button2.css('display', 'none');

  // status
  resetStatus();
}

//////////////////// STATUS FUNCTIONS ////////////////////

function updateStatus() {
  updateStats('first');
  updateStats('second');
}

function updateStats (board) {
  let status = '';

  let moveColor = 'White';
  if (game.turn(board) === 'b') {
    moveColor = 'Black';
  }

  // checkmate?
  if (game.in_checkmate(board)) {
    status = 'Game over, ' + moveColor + ' is in checkmate.';
  }
  // draw?
  else if (game.in_draw(board)) {
    status = 'Game over, drawn position';
  } 
  // game still on
  else {
    status = moveColor + ' to move';
    
    // check?
    if (game.in_check(board)) {
      status += ', ' + moveColor + ' is in check';
    }
  }

  if(board === 'first') {
    $status1.html(status);
    $pgn1.html(game.pgn(board));
  } else {
    $status2.html(status);
    $pgn2.html(game.pgn(board));
  }
  
}

function resetStatus() {
  $status1.html('');
  $pgn1.html('');
  $status2.html('');
  $pgn2.html('');
}

/***********************************************************/
/*                       SOCKET IO                         */
/***********************************************************/

// connect to server
// NOTE: io is imported in game.ejs
const server = io('/',  { query: "gameId=" + game_id + 
                                  "&user_id=" + get_cookie('user_id') + 
                                  "&username=" + myUsername });

// opponent moved
server.on('move', (board, move, whiteClock, blackClock) => {
  game.move(board, move);
  game.set_clocks(board, whiteClock, blackClock);

  updateStatus();
})

// some player joined
server.on('joined', (username) => {
  game.add_player(username);
})

// player added to chessboard
server.on('playerJoined', (board, color, username) => {
  game.add_player_to_board(board, color, username);
})

// removed player from chessboard
server.on('playerRemoved', (board, color) => {
  game.remove_player_from_board(board, color);
})

// admin can start a game
server.on('can_start_game', () => {
  // NOTE: this will never be sent to a client that's not an admin
  $start_button.removeAttr('disabled');
})

// admin can't start a game
server.on('cant_start_game', () => {
  // NOTE: this will never be sent to a client that's not an admin
  $start_button.attr('disabled', 'disabled');
})

// admin initiated new game
server.on('game_has_started', () => {
  start_game();
})

server.on('game_is_over', (message) => {
  game.game_over(); 
  
  // show reset button
  if(myUsername === admin) {
    $reset_button.css('display', '');
  }
  // hide resign button
  $resign_button.css('display', 'none');

  if(message) {
    // TODO: this should be pop up dialog
    $msg.text(message);
  }
})

server.on('reset_game', (fen, sparePieces) => {
  reset_game(fen, sparePieces);
  $msg.text('');
})

// some player disconnected
server.on('disconnected', (username) => {
  game.remove_player(username);
})