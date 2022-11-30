const { Game } = require('../game/game');
const { isValidId } = require('../utils/idHandler');

// CONSTANTS
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const START_SPARES = {'white': {'wP': 0, 'wN': 0, 'wB': 0, 'wR': 0, 'wQ': 0},
                      'black': {'bP': 0, 'bN': 0, 'bB': 0, 'bR': 0, 'bQ': 0}};

/**********************************************************/
/*                    GAME COORDINATOR                    */
/**********************************************************/

let instance;
let games = {};

class GameCoordinator {

    constructor() {
        if(instance)
            throw new MultipleInstantiationOfSingletonException("Cannot instantiate a singleton class multiple times");

        instance = this;
    }

    #startNewGame(admin) {
        //NOTE: in next version of code there should be
        //  a possibility for admin to set starting position and spares
        let game = new Game({ admin: admin, fen: START_FEN, spares: START_SPARES });
        games[game.getId()] = game;
    
        return game;
    }

    #getGameContainingUser(userId) {
        if(typeof userId === 'undefined') return null;
    
        for(let i in games) {
            if(games[i].hasPlayer(userId))
                return games[i];
        }
        
        return null;
    }

    #getGameContainingUsername(username) {
        if(typeof username === 'undefined') return null;

        for(let i in games) {
            if(games[i].hasUsername(username))
                return games[i];
        }
        
        return null;
    }

    /**********************************************************/
    /*                       PUBLIC API                       */
    /**********************************************************/

    getGameById(gameId) {
        let game = null;

        if(typeof gameId !== "undefined" &&
            games.hasOwnProperty(gameId))
                game = games[gameId];

        return game;
    }

    getGameOfJoiningUser(userId, username, gameId, uponCreatingNewPlayer) {
        let game = null;

        // join existing game
        if(gameId !== null && 
            games.hasOwnProperty(gameId)) {
            game = games[gameId];

            if(!game.hasPlayer(userId)) {
                let newUserId = game.addNewPlayer();
                uponCreatingNewPlayer(newUserId);
            }
                
        // start new game
        } else {
            game = this.#startNewGame(username);
            let newUserId = game.addNewPlayer();
            uponCreatingNewPlayer(newUserId);
        }

        return game;
    }

    assertUsernameUniqueness(username) {
        // username is set
        if(username) {
            let game = this.#getGameContainingUsername(username);

            // exists a game with this username
            if(game)
                throw new DuplicateUsernameException(`Username ${username} already in use`);
        }
    }

    // NOTE: this has a bug! If user has been in this game
    // as a watcher, his id was set. If he joins later
    // with a different name, possibly some players name
    // who is at that time disconnected, he will be able
    // to assume his position !
    assertUserIsNotAlreadyPlaying(userId, gameId) {
        // user id is valid
        if(isValidId(userId)) {
            // & user already playing in game
            let game = this.#getGameContainingUser(userId);
            if(game && game.getId() !== gameId)
                throw new UserInMultipleGamesException(`User ${userId} is already playing in ${game.getId()} game`, 
                                                        userId, game);    
        }
    }

}

// initialize singleton object & make it immutable
let gameCoordinator = Object.freeze(new GameCoordinator());

/**********************************************************/
/*                   EXCEPTION CLASSES                    */
/**********************************************************/

class MultipleInstantiationOfSingletonException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

class DuplicateUsernameException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

class UserInMultipleGamesException extends Error {
    constructor(message, userId, game) {
        super(message);
        this.name = this.constructor.name;
        this.userId = userId;
        this.game = game;
    }
}

// EXPORTS
module.exports = { gameCoordinator, MultipleInstantiationOfSingletonException,
                    DuplicateUsernameException, UserInMultipleGamesException };