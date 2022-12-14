const sanitize = require('sanitize-html');
const socket = require('socket.io');
const { gameCoordinator } = require('./gameCoordinator');

/**********************************************************/
/*                  CLIENT COMMUNICATION                  */
/**********************************************************/

function initializeClientIO(server) {
    let io = socket(server, {transports: ['websocket']});

    io.on('connection', (client) => {
        console.log('A user just connected.');

        try {
            let { gameId, username } = getClientInfo(client);
            let { game, player } = getClientGameAndPlayer(client);
            updatePlayerInfo(player, client);

            client.join(gameId);
            client.broadcast.to(gameId).emit('joined', username);

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
    let gameId = client.request._query['gameId'];
    let userId = client.request._query['user_id'];
    let username = sanitize(client.request._query['username']);

    return { gameId, userId, username };
}

function getClientGameAndPlayer(client) {
    let { gameId, userId } = getClientInfo(client);

    let game = gameCoordinator.getGameById(gameId);
    if(game == null)
        throw new NonExistentGameException(`Game ${gameId} doesn't exist`, gameId);

    let player = game.getPlayer(userId);
    if(player == null)
        throw new NonExistentPlayerException(`Player with id ${userId} doesn't exist in game ${gameId}`,
                                                userId, gameId);

    return { game, player };
}

function updatePlayerInfo(player, client) {
    let { username } = getClientInfo(client);

    if(typeof username == "undefined" ||
        username == null || username.length == 0)
            throw new MissingUsernameException(`Username is required`);
        
    player.setUsername(username);
    player.setSocket(client);
}

function setClientEventHandlers(client, player, game) {
    let { gameId, userId } = getClientInfo(client);

    // player set at board
    client.on('playerJoined', (board, color, username) => {
        // sanitize client suplied data
        board = sanitize(board);
        color = sanitize(color);
        username = sanitize(username);

        if(game.isAdmin(player)) {
            let playerSet = game.setPlayerAtBoard(board, color, username);
            if(playerSet) {
                client.broadcast.to(gameId).emit('playerJoined', board, color, username);
                if(game.boardsAreSet()) {
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

        if(game.isAdmin(player)) {
            let playerRemoved = game.removePlayerFromBoard(board, color);
            if(playerRemoved) {
                client.broadcast.to(gameId).emit('playerRemoved', board, color);
                client.emit('cant_start_game');
            }
        }
    });

    // admin has initiated the game
    client.on('game_has_started', (times) => {
        if(game.isAdmin(player)) {
            game.setTimes(times);
            let gameStarted = game.start();
    
            if(gameStarted) {
                client.broadcast.to(gameId).emit('game_has_started', times);
            }
        }
    });

    // on player move
    client.on('move', (board, move, elapsedTime) => {
        let updated = game.move(board, player, move);

        if(updated) {
            game.updateTimers(board, elapsedTime);
            // broadcast move & updated timers
            client.broadcast.to(game.getId()).emit('move', board, move,
                                                            game.getWhiteTime(board),
                                                            game.getBlackTime(board));
            game.checkStatus();
        }
    });

    client.on('resigned', () => {
        game.resigned(player);
    });

    client.on('reset_game', (fen, sparePieces) => {
        if(game.isAdmin(player)) {
            let positionSet = game.setPosition(fen, sparePieces);
            if(positionSet) {
                game.reset();
            
                client.broadcast.to(gameId).emit('reset_game', fen, sparePieces);
            }
        }
    });

    // player has disconnected
    client.on('disconnect', (reason) => {
        console.log('A user has disconnected, because of ' + reason);

        client.broadcast.to(game.getId()).emit('disconnected', 
                                                player.getUsername());
        game.removePlayer(userId);
    });
}

// EXPORTS
module.exports = { initializeClientIO };