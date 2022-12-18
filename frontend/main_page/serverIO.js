// connect to server
// NOTE: io is imported in main_game.html
const server = io('/',  { transports: ['websocket'], upgrade: false,
            query: `gameId=${game_id}&user_id=${get_cookie('user_id')}&username=${myUsername}` });

// server sent game info upon connection
server.on("upon_connection", (game_options) => {
    initialize(game_options);
});

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
server.on('game_has_started', (times) => {
    start_game(times);
})

server.on('game_is_over', (message) => {
    game.game_over(); 
    on_game_state_change();

    if(message) {
        $msg.text(message);
        $modal.css('display', 'block');
    }
});

server.on('reset_game', (fen, sparePieces) => {
    reset_game(fen, sparePieces);
})

// some player disconnected
server.on('disconnected', (username) => {
    game.remove_player(username);
})

server.on('disconnect', (reason) => {
    console.log('Server connection lost, because of ' + reason);
}) 