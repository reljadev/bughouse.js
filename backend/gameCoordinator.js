const { Game } = require('./game/game');

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

    getGameById(id) {
        let game = null;

        if(typeof id !== "undefined" &&
            games.hasOwnProperty(id))
                game = games[id];

        return game;
    }

    getGameOfJoiningUser(data) {
        let game = null;

        // join existing game
        if(data.game.id !== null && 
            games.hasOwnProperty(data.game.id)) {
            game = games[data.game.id];

            if(!game.has_player(data.user.id))
                //TODO: I don't like that this changes user id
                data.user.id = game.add_new_player();
            
        // start new game
        } else {
            let admin = data.user.name;
            game = this.#startNewGame(admin);
            //TODO: I don't like that this changes user id
            data.user.id = game.add_new_player();
        }

        return game;
    }
    
    getGameContainingUser(userId) {
        if(typeof userId === 'undefined') return null;
    
        for(let i in games) {
            if(games[i].has_player(userId))
                return games[i];
        }
        
        return null;
    }

    getGameContainingUsername(username) {
        if(typeof username === 'undefined') return null;

        for(let i in games) {
            if(games[i].has_username(username))
                return games[i];
        }
        
        return null;
    }

    #startNewGame(admin) {
        //NOTE: in next version of code there should be
        //  a possibility for admin to set starting position and spares
        let game = new Game({ admin: admin, fen: START_FEN, spares: START_SPARES });
        games[game.get_id()] = game;
    
        return game;
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

// EXPORTS
module.exports = {gameCoordinator: gameCoordinator};