const sanitize = require('sanitize-html');
const socket = require('socket.io');
const { gameCoordinator } = require('./games_coordinator');

/**********************************************************/
/*                  CLIENT COMMUNICATION                  */
/**********************************************************/

function initalizeClientIO(server) {
    let io = socket(server);

    io.on('connection', (client) => {
        console.log('A user just connected.');

        try {
            let { game_id, username } = getClientInfo(client);
            let { game, player } = getClientGameAndPlayer(client);
            updatePlayerInfo(player, client);

            client.join(game_id);
            client.broadcast.to(game_id).emit('joined', username);

            setClientEventHandlers(client, player, game);
        } catch(err) {
            //TODO: parse these exceptions on client side
            client.emit('exception_occured', err);
        }

    });
}

/**********************************************************/
/*                   EXCEPTION CLASSES                    */
/**********************************************************/

class NonExistentGameException extends Error {
    constructor(message, gameId) {
        super(message);
        this.name = this.constructor.name;
        this.gameId = gameId;
    }
}

class NonExistentPlayerException extends Error {
    constructor(message, userId, gameId) {
        super(message);
        this.name = this.constructor.name;
        this.userId = userId;
        this.gameId = gameId;
    }
}

class MissingUsernameException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

/**********************************************************/
/*                     HELPER METHODS                     */
/**********************************************************/

function getClientInfo(client) {
    let game_id = client.request._query['gameId'];
    let user_id = client.request._query['user_id'];
    let username = sanitize(client.request._query['username']);

    return { game_id, user_id, username };
}

function getClientGameAndPlayer(client) {
    let { game_id, user_id } = getClientInfo(client);

    let game = gameCoordinator.getGameById(game_id);
    if(game == null)
        throw new NonExistentGameException(`Game ${game_id} doesn't exist`, game_id);

    player = game.get_player(user_id);
    if(player == null)
        throw new NonExistentPlayerException(`Player with id ${user_id} doesn't exist in game ${game_id}`,
                                                user_id, game_id);

    return { game, player };
}

function updatePlayerInfo(player, client) {
    let { username } = getClientInfo(client);

    if(typeof username == "undefined" ||
        username == null || username.length == 0)
            throw new MissingUsernameException(`Username is required`);
        
    player.set_username(username);
    player.set_socket(client);
}

function setClientEventHandlers(client, player, game) {
    let { game_id, user_id } = getClientInfo(client);

    // player set at board
    client.on('playerJoined', (board, color, username) => {
        // sanitize client suplied data
        board = sanitize(board);
        color = sanitize(color);
        username = sanitize(username);

        if(game.is_admin(player)) {
            let player_set = game.set_player_at_board(board, color, username);
            if(player_set) {
                client.broadcast.to(game_id).emit('playerJoined', board, color, username);
                if(game.boards_are_set()) {
                    client.emit('can_start_game');
                }
            }
        }
    });

    // player removed from board
    client.on('playerRemoved', (board, color) => {
        // sanitize client suplied data
        board = sanitize(board);
        color = sanitize(color);

        if(game.is_admin(player)) {
            let player_removed = game.remove_player_from_board(board, color);
            if(player_removed) {
                client.broadcast.to(game_id).emit('playerRemoved', board, color);
                client.emit('cant_start_game');
            }
        }
    });

    // admin has initiated the game
    client.on('game_has_started', (times) => {
        if(game.is_admin(player)) {
            game.set_times(times);
            let game_started = game.start();
    
            if(game_started) {
                client.broadcast.to(game_id).emit('game_has_started', times);
            }
        }
    });

    // on player move
    client.on('move', (board, move, elapsedTime) => {
        let updated = game.move(board, player, move);

        if(updated) {
            game.update_timers(board, elapsedTime);
            // broadcast move & updated timers
            client.broadcast.to(game.get_id()).emit('move', board, move,
                                                            game.get_white_time(board),
                                                            game.get_black_time(board));
            game.check_status();
        }
    });

    client.on('resigned', () => {
        game.resigned(player);
    });

    client.on('reset_game', (fen, sparePieces) => {
        if(game.is_admin(player)) {
            let position_set = game.set_position(fen, sparePieces);
            if(position_set) {
                game.reset();
            
                client.broadcast.to(game_id).emit('reset_game', fen, sparePieces);
            }
        }
    });

    // player has disconnected
    client.on('disconnect', () => {
        console.log('A user has disconnected.');

        client.broadcast.to(game.get_id()).emit('disconnected', 
                                                player.get_username());
        game.remove_player(user_id);
    });
}

// EXPORTS
module.exports = {initalizeClientIO: initalizeClientIO};