const sanitize = require('sanitize-html');
const Ably = require("ably");
const { gameCoordinator } = require('./gameCoordinator');
const { MissingAdminFieldException } = require('../game/game');

/**********************************************************/
/*                  CLIENT COMMUNICATION                  */
/**********************************************************/

let instance;

class ClientIO {

    #restAblyClient;
    #realtimeAblyClient;

    constructor() {
        if(instance)
            //TODO: import this exception
            throw new MultipleInstantiationOfSingletonException("Cannot instantiate a singleton class multiple times");

        instance = this;
        this.#initializeAblyClients();
    }

    /**********************************************************/
    /*                     HELPER METHODS                     */
    /**********************************************************/

    #initializeAblyClients() {
        // TODO: I shouldn't use root key 
        // TODO: this needs to be removed before pushing to git
        let PRIVATE_ABLY_KEY = "ilD5sw.HLun8w:MgOsflmRflDn_5HvMw7E1z9gjzfWgwmyUMM-jBNZ3I0";
        this.#restAblyClient = new Ably.Rest({ key: PRIVATE_ABLY_KEY });
        this.#realtimeAblyClient = new Ably.Realtime({ key: PRIVATE_ABLY_KEY,
                                                        clientId: 'server',
                                                        transportParams: { heartbeatInterval: 5000 } });
    }

    getTokenRequest(userId, username, gameId) {
        try {
            let { game, player } = this.#getClientGameAndPlayer(gameId, userId);
        
            let capability = {};
            capability[`game:${gameId}:player:${userId}`] = ["publish", "subscribe", "presence"];
            //TODO: user shouldn't be able to subscribe to presence, only make his presence known !
            capability[`game:${gameId}:server`] = ["subscribe", "presence"];
            if(game.isAdmin(player))
                capability[`game:${gameId}:admin`] = ["subscribe", "publish", "presence"];

            let tokenParams = {
                "capability": capability,
                "clientId": `${userId}|${username}`,
            };
    
            //TODO: this should be async
            let token;
            this.#restAblyClient.auth.createTokenRequest(tokenParams, (err, tokenRequest) => {
                if(err)
                    throw new TokenRequestException("Error while creating token request", err);
                
                token = tokenRequest;
            });
    
            return token;

        } catch(err) {
            //TODO: remove log
            console.log(err)
            let msg;
            if(err instanceof NonExistentGameException)
                msg = `Game with id ${err.gameId} doesn't exist`;
            else if(err instanceof NonExistentPlayerException)
                msg = `Game ${err.gameId} doesn't have player ${err.userId}`;
            else
                msg = "Error while creating token request";
              
            return new TokenRequestException(msg, err);
        }
    }

    createGameCommunicationChannel(gameId) {
        // TODO: should I store this channel somewhere?
        let gameChannel = this.#realtimeAblyClient.channels.get(`game:${gameId}:server`);

        gameChannel.presence.subscribe(({ action, clientId }) => {
            console.log(`player ${clientId} has ${action} the game ${gameId}`);

            let [ userId, username ] = clientId.split("|");

            if(action == 'enter') {
                try {
                    let { game, player } = this.#getClientGameAndPlayer(gameId, userId);
                    gameChannel.publish("joined", { username });
                    this.#setPlayerEventHandlers(gameChannel, userId, gameId, player, game);
                    //TODO: don't need to store it here, i can just pass a callback function to game
                    player.setSocket(gameChannel);                    

                } catch(err) {
                    //TODO: parse these exceptions on client side
                    gameChannel.publish("EXCEPTION", err);
                }
            } else if(action == 'leave') {
                let game = gameCoordinator.getGameById(gameId);
                game.removePlayer(userId);
                gameChannel.publish("disconnected", { username });
            }
            // TODO: what to do with all the other actions?
        });
    }

    #getClientGameAndPlayer(gameId, userId) {
        let game = gameCoordinator.getGameById(gameId);
        if(game == null)
            throw new NonExistentGameException(`Game ${gameId} doesn't exist`, gameId);

        let player = game.getPlayer(userId);
        if(player == null)
            throw new NonExistentPlayerException(`Player with id ${userId} doesn't exist in game ${gameId}`,
                                                    userId, gameId);

        return { game, player };
    }

    #setPlayerEventHandlers(gameChannel, userId, gameId, player, game) {
        //TODO: should i store and remove these channels, or is it done automatically
        let playerChannel = this.#realtimeAblyClient.channels.get(`game:${gameId}:player:${userId}`);

        playerChannel.subscribe(({ name, data }) => {
            // messages not allowed for this channel are ignored
            switch(name) {
                case "move": {
                    let { board, move, elapsedTime } = data;

                    let updated = game.move(board, player, move);

                    if(updated) {
                        game.updateTimers(board, elapsedTime);
                        // broadcast move & updated timers
                        gameChannel.publish('move', { board, move,
                                                    whiteClock: game.getWhiteTime(board),
                                                    blackClock: game.getBlackTime(board),
                                                    initiator: userId });
                        game.checkStatus();
                    }

                    break;
                }
                case "resigned": {
                    game.resigned(player);

                    break;
                }
            }
        });

        if(game.isAdmin(player)) {
            let adminChannel = this.#realtimeAblyClient.channels.get(`game:${gameId}:admin`);

            adminChannel.subscribe(({ name, data }) => {
                // messages not allowed for this channel are ignored
                switch(name) {
                    case "playerJoined": {
                        let { board, color, username } = data;
    
                        // sanitize client suplied data
                        board = sanitize(board);
                        color = sanitize(color);
                        username = sanitize(username);
    
                        let playerSet = game.setPlayerAtBoard(board, color, username);
                        if(playerSet) {
                            gameChannel.publish('playerJoined', { board, color, username });
                            if(game.boardsAreSet()) {
                                adminChannel.publish("can_start_game", {});
                            }
                        }
    
                        break;
                    }
                    case "playerRemoved": {
                        let { board, color } = data;

                        // sanitize client suplied data
                        board = sanitize(board);
                        color = sanitize(color);

                        let playerRemoved = game.removePlayerFromBoard(board, color);
                        if(playerRemoved) {
                            gameChannel.publish('playerRemoved', { board, color });
                            adminChannel.publish('cant_start_game', {});
                        }

                        break;
                    }
                    case "game_has_started": {
                        let { times } = data;
                        
                        game.setTimes(times);
                        let gameStarted = game.start();
                
                        if(gameStarted) {
                            gameChannel.publish('game_has_started', { times });
                        }

                        break;
                    }
                    case "reset_game": {
                        let { fen, spares } = data;

                        let positionSet = game.setPosition(fen, spares);
                        if(positionSet) {
                            game.reset();
                            gameChannel.publish('reset_game', { fen, spares });
                        }

                        break;
                    }
                }
            });
        }
    }

}

// initialize singleton object & make it immutable
let clientIO = Object.freeze(new ClientIO());

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

class TokenRequestException extends Error {
    constructor(message, err) {
        super(message);
        this.name = this.constructor.name;
        this.err = err;
    }
}

// EXPORTS
module.exports = { clientIO, TokenRequestException };