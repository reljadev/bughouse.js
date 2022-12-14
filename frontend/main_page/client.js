function get_cookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

const userId = get_cookie('user_id');

// get signed tokenRequest from auth server & use to get auth token from ably
const realtimeAblyClient = new Ably.Realtime({
                            // authentication path relative to domain
                            authUrl: "/auth", 
                            // TODO: it's recommended to get userId & gameId from cookies
                            // instead of placing them as authParams
                            authParams: {
                                username: myUsername,
                                userId: userId,
                                gameId: game_id
                            },
                            // check if connection was lost every 5s
                            transportParams: { heartbeatInterval: 5000 } }
                        );

let serverChannel = realtimeAblyClient.channels.get(`game:${game_id}:server`);
let playerChannel = realtimeAblyClient.channels.get(`game:${game_id}:player:${userId}`);
let adminChannel;
if(myUsername === admin) {
    adminChannel = realtimeAblyClient.channels.get(`game:${game_id}:admin`);

    adminChannel.subscribe(({ name, data }) => {
        //TODO: only admin actions
        ACTIONS[name](data);
    });
}

serverChannel.presence.enter();

//TODO: change this constants to upper case
const ACTIONS = { 'move': move,
                  'joined': playerJoined,
                  'playerJoined': playerOnBoard,
                  'playerRemoved': playerOffBoard,
                  'can_start_game': gameReady,
                  'cant_start_game': gameNotReady,
                  'game_has_started': gameStarted,
                  'game_is_over': gameOver,
                  'reset_game': resetGame,
                  'disconnected': playerLeft };

serverChannel.subscribe(({ name, data }) => {
    ACTIONS[name](data);
});

function move({ board, move, whiteClock, blackClock, initiator }) {
    if(initiator == userId) return;

    game.move(board, move);
    game.set_clocks(board, whiteClock, blackClock);

    updateStatus();
}

function playerJoined({ username }) {
    if(myUsername == username) return;

    game.add_player(username);
}

function playerOnBoard({ board, color, username }) {
    if(myUsername == admin) return;

    game.add_player_to_board(board, color, username);
}

function playerOffBoard({ board, color }) {
    if(myUsername == admin) return;

    game.remove_player_from_board(board, color);
}

function gameReady() {
    $start_button.removeAttr('disabled');
}

function gameNotReady() {
    $start_button.attr('disabled', 'disabled');
}

function gameStarted({ times }) {
    if(myUsername == admin) return;

    start_game(times);
}

function gameOver({ message }) {
    game.game_over(); 
    on_game_state_change();

    if(message) {
        $msg.text(message);
        $modal.css('display', 'block');
    }
}

function resetGame({ fen, spares }) {
    if(myUsername == admin) return;

    reset_game(fen, spares);
}

function playerLeft({ username }) {
    game.remove_player(username);
}