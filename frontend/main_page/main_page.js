/***********************************************************/
/*                    INITIALIZATION                       */
/***********************************************************/

///////////////////// RETREIVE DATA //////////////////////
// NOTE: data variable is included at renderization time (runtime)
let myUsername = $('#data_username').attr('data-value');
let data = JSON.parse($('#data_data').attr('data-value'));

let game_id = data.id;
let admin = data.admin;
let fen = data.first_board.fen;
let sparePieces = data.first_board.sparePieces;
//TODO: only game id need to retrieve from cookie

//// INITIALIZE GAME ////
//TODO: myUsername not needed, and then I don't need to hack
// & parse separetely my username and all the rest

// placeholder game, while client waits for websocket
// connection to server, which will retrieve game info
let game = new Game({ 
  id: game_id,
  admin: 'placeholder',
  first_board: {
      fen: "8/8/8/8/8/8/8/8",
  },
  second_board: {
      fen: "8/8/8/8/8/8/8/8",
  },
});

//TODO: players text not shown

function initialize(game_options) {
  //TODO: clear console
  game.unmount();

  game_options.myUsername = myUsername;
  game_options.move_executed = move_executed;
  game_options.player_joined_board = player_joined_board;
  game_options.player_left_board = player_left_board;
  game = new Game(game_options);

  on_game_state_change();
}

//// GAME FUNCTIONS ////
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

//// INITIALIZE ELEMENTS ////
//TODO: These buttons are defined here,
// but showed / hidden / updated after socket connects
let $backward_button1 = $('#backward_button_1');
let $forward_button1 = $('#forward_button_1');
let $backward_button2 = $('#backward_button_2');
let $forward_button2 = $('#forward_button_2');
let $resign_button = null;
let $start_button = $('#start_game');
let $reset_button = $('#reset_game');
let $modal = $("#myModal");
let $text_id = $('#text_game_id');
let $pgn1 = $('#pgn_1');
let $pgn2 = $('#pgn_2');
let $pgn_button1 = $('#pgn_button_1');
let $pgn_button2 = $('#pgn_button_2');
let $msg = $('#game_over_msg');

// if player joins midgame, update status immedietely
//TODO: this won't be needed, because it will be updated when socket connects
// if(game.is_playing()) {
//   updateStatus();
// }
// display invite link
$text_id.val(game_id);

// add events
$backward_button1.on('click', ()=> {
  game.backward_move('first');
});
$forward_button1.on('click', () => {
  game.forward_move('first');
});
$backward_button2.on('click', () => {
  game.backward_move('second');
});
$forward_button2.on('click', ()=> {
  game.forward_move('second');
});

$start_button.on('click', function(evt) {
    let times = game.get_times();
    start_game(times);

    // hide start button
    $start_button.css('display', 'none');

    // notify server of game started
    server.emit('game_has_started', times); 
  } );

//TODO: fen & sparePieces aren't known untill socket connects
// so it should retrieve start fen and spares from game
$reset_button.on('click', function(evt) {
    let [fen, spares] = game.getStartPosition('first');
    
    reset_game(fen, spares);
    on_game_state_change();

    // notify server
    server.emit('reset_game', fen, spares);
  } );

// copy game id
$('#copy_button').on('click', copy_id);

//TODO: this will be done when client connects
// show & hide appropriate buttons
// on_game_state_change();

//// EVENTS ////
function start_game(times) {
  game.set_times(times);
  game.start();

  on_game_state_change();
  updateStatus();
}

function reset_game(fen, sparePieces) {
  game.reset(fen, sparePieces);
  on_game_state_change();
  
  resetStatus();
}

function copy_id() {
  navigator.clipboard.writeText(game_id).then(
    function() { 
      $text_id.val('Copied!');
      $text_id.css({'color': 'white',
                    'background-color': 'gray'});
      setTimeout(() => { $text_id.val(game_id);
                          $text_id.css({'color': 'black', 
                                        'background-color': 'white'}); },
                  500);
    }
  );
}

// clicking 'x' on modal content
$('#modal_close').on('click', 
                    () => { $modal.css('display', 'none') });

// when the user clicks anywhere outside of the modal, close it
$(window).on('click', (evt) => {
    if ($(evt.target).attr('id') === 'myModal') {
      $modal.css('display', 'none');
    }
  }
);

// on window resize
$( window ).resize(game.resize.bind(game));

/***********************************************************/
/*                  CONTROLLER FUNCTIONS                   */
/***********************************************************/

//// STATUS FUNCTIONS ////
function updateStatus() {
  update_stats('first');
  update_stats('second');
}

function update_stats (board) {
  if(board === 'first') {
    $pgn1.text(game.pgn(board));
  } else {
    $pgn2.html(game.pgn(board));
  }
}

function resetStatus() {
  $pgn1.text('');
  $pgn2.html('');
}

//// BUTTONS VISIBILITY ////
function on_game_state_change() {
  // PRE GAME //
  if(game.is_pre_game()) {
    hide_controllers();

    if(myUsername === admin) {
      // hide reset button
      if($reset_button) {
        $reset_button.css('display', 'none');
      }
      // show start button
      if($start_button) {
        $start_button.css('display', '');
        $start_button.attr('disabled', 'disabled');
      }
    }

  // PLAYING //
  } else if(game.is_playing()) {
    // close modal
    $modal.css('display', 'none');

    if(game.am_i_at_board()) {
      initialize_resign_button();
      // show resign button
      $resign_button.css('display', '');
    }

    show_controllers();

  // POST GAME //
  } else if(game.is_post_game()) {
    // show reset button
    if(myUsername === admin) {
      $reset_button.css('display', '');
    }
    // hide resign button
    if($resign_button) {
      $resign_button.css('display', 'none');
    }

  } else {
    console.error('unknown game state');
  }
}

function initialize_resign_button() {
  // i'm at first board
  if(myUsername === game.getBoardPlayer('first', 'white') ||
    myUsername === game.getBoardPlayer('first', 'black')) {
      $resign_button = $('#resign_game1');
  // i'm at second board
  } else {
      $resign_button = $('#resign_game2');
  }

  // on click
  $resign_button.on('click', () => {
    // notify server
    server.emit('resigned');
  });

}

function hide_controllers() {
  set_controllers_visibility('none');
}

function show_controllers() {
  set_controllers_visibility('');
}

function set_controllers_visibility(visibility) {
  $forward_button1.css('display', visibility);
  $backward_button1.css('display', visibility);

  $forward_button2.css('display', visibility);
  $backward_button2.css('display', visibility);

  $pgn_button1.css('display', visibility);
  $pgn_button2.css('display', visibility);
}