const Chess = require("./modules/chess.js/chess")
const Stopwatch = require("./stopwatch") //TODO: why is stopwatch different color?
const utils = require("./utils")

// STAGE ENUM
const PRE_GAME = Symbol('pre-game');
const PLAYING = Symbol('playing');
const POST_GAME = Symbol('post-game');

class Game {
    // declare private variables
    #id = utils.uuid(8);
    #game;
    #stage;
    #players;
    #admin;
    #white_player;
    #black_player;
    #white_timer;
    #black_timer;

    constructor(options) {
        this.#id = utils.uuid(8);

        this.#game = new Chess(options.fen, options.spares);
        this.#stage = PRE_GAME;

        this.#players = {};
        this.#admin = options.admin;
        if(typeof this.#admin === 'undefined') {
            throw 'admin is a required parameter';
        }
        this.#white_player = options.white_player ?? null;
        this.#black_player = options.black_player ?? null;

        this.#white_timer = new Stopwatch({delay: 100, 
                                        clock: options.white_clock ?? 5 * 1000 * 60,
                                        onTimesUp: this.#game_over.bind(this) });
        this.#black_timer = new Stopwatch({delay: 100,
                                        clock: options.black_clock ?? 5 * 1000 * 60,
                                        onTimesUp: this.#game_over.bind(this) });
    }

    #game_over(username) { //TODO: you don't need this username
        this.#stage = POST_GAME;
        this.#white_timer.stop();
        this.#black_timer.stop();
        let messages = this.#get_pop_up_messages(username);

        for(let i in this.#players) {
            let p = this.#players[i];
            // white player
            if(p.get_username() === this.#white_player) {
                p.get_socket().emit('game_is_over', messages.white);
            // black player
            } else if(p.get_username() === this.#black_player) {
                p.get_socket().emit('game_is_over', messages.black);
            // watcher    
            } else {
                p.get_socket().emit('game_is_over', messages.watcher);
            }
        }
    }
        
    #get_pop_up_messages(player) {
        let msgForWatchers = '';
        let msgForWhite = '';
        let msgForBlack = '';
    
        // checkmate
        if (this.#game.in_checkmate()) {
            if(this.#game.turn() === 'w') {
                msgForWatchers = 'Game over, ' + this.#white_player + ' is in checkmate';
                msgForWhite = 'You lost, by checkmate';
                msgForBlack = 'You won, by checkmate';
            } else {
                msgForWatchers = 'Game over, ' + this.#black_player + ' is in checkmate';
                msgForWhite = 'You won, by checkmate';
                msgForBlack = 'You lost, by checkmate';
            }
        // draw
        } else if (this.#game.in_draw()) {
            msgForWatchers = 'Draw';
            msgForWhite = 'Draw';
            msgForBlack = 'Draw'; //TODO: why is it a draw, insufficient material??
        // white ran out of time
        } else if(this.#white_timer.time() === 0) {
            msgForWatchers = 'Game over, ' + this.#white_player + ' ran out of time';
            msgForWhite = 'You lost, on time';
            msgForBlack = 'You won, on time';
        // black ran out of time
        } else if(this.#black_timer.time() === 0) {
            msgForWatchers = 'Game over, ' + this.#black_player + ' ran out of time';
            msgForWhite = 'You won, on time';
            msgForBlack = 'You lost, on time';
        // resignation
        } else {
            if(player === this.#white_player) {
                msgForWatchers = 'Game over, ' + this.#white_player + ' resigned';
                msgForWhite = 'You lost, by resignation';
                msgForBlack = 'You won, by resignation';
            } else {
                msgForWatchers = 'Game over, ' + this.#black_player + ' resigned';
                msgForWhite = 'You won, by resignation';
                msgForBlack = 'You lost, by resignation';
            }
        }
    
        return {white: msgForWhite, black: msgForBlack, watcher: msgForWatchers}        
    }

    #refundLagTime(timer, elapsed_time) {
        let offset = timer.elapsed_time() - elapsed_time;
        let clamped_offset = Math.min(Math.max(-1000, offset), 1000);
        timer.add(clamped_offset);
    }

    ///////////////// PUBLIC API /////////////////

    get_id() {
        return this.#id;
    }

    info() {
        return {id: this.#id,
                stage: this.#stage.description,
                state: {fen: this.#game.fen(), //TODO: do i need all of this?
                        sparePieces: this.#game.sparePieces(),
                        start_fen: this.#game.start_fen(),
                        start_spares: this.#game.start_spares(),
                        pgn: this.#game.pgn(),
                        },
                admin: this.#admin,
                white_player: this.#white_player,
                black_player: this.#black_player,
                usernames: this.get_usernames(),
            };
    }

    get_usernames() {
        let users = [];
        for(let i in this.#players) {
            let p = this.#players[i];
            if(p.get_username()) {
                users.unshift([ p.get_username(),
                                p.get_socket() ? 'connected' : 'disconnected' ]);
            }
        }

        return users;
    }

    has_player(user_id) {
        return this.#players.hasOwnProperty(user_id);
    }

    get_player(user_id) {
        return this.#players[user_id];
    }

    add_new_player() {
        let p = new Game.Player();
        this.#players[p.get_id()] = p;
        return p.get_id();
    }

    remove_player(user_id) {
        let p = this.#players[user_id];
        // player disconnects mid-game, don't remove him completely
        if(this.#stage === PLAYING && 
            (this.#white_player === p.get_username() ||
             this.#black_player === p.get_username())) {
                p.set_socket(null);
        } else {
            delete this.#players[user_id];
        }
    }

    set_player_at_board(color, username) {
        if(color === 'white') {
            this.#white_player = username;
        } else {
            this.#black_player = username;
        }
    }

    remove_player_from_board(color) {
        if(color === 'white') {
            this.#white_player = null;
        } else {
            this.#black_player = null;
        }
    }

    board_is_set() {
        return this.#white_player !== null && this.#black_player !== null
    }

    start() {
        this.#stage = PLAYING;
        this.#white_timer.reset();
        this.#black_timer.reset();
        this.#white_timer.start();
    }

    game_over(username) {
        this.#game_over(username);
    }

    set_position(fen, spares) {
        this.#game.load(fen);
        this.#game.loadSpares(spares);
    }

    reset() {
        this.#stage = PRE_GAME;
        // remove players that disconnected mid-game
        for(let i in this.#players) {
            let p = this.#players[i];
            if(!p.get_socket()) {
                delete this.#players[i];
            }
        }
        this.#white_player = null;
        this.#black_player = null;
    }

    move(move) {
        let m = this.#game.move(move);
        return m !== null ? true : false;
    }

    get_white_time() {
        return this.#white_timer.time();
    }

    get_black_time() {
        return this.#black_timer.time();
    }

    update_timers(elapsed_time) {
        if(this.#game.turn() === 'w') {
            this.#black_timer.stop();
            this.#white_timer.start();
            this.#refundLagTime(this.#black_timer, elapsed_time);
        } else {
            this.#white_timer.stop();
            this.#black_timer.start();
            this.#refundLagTime(this.#white_timer, elapsed_time);
        }
    }

}

Game.Player = class Player {
    #user_id = utils.uuid(16);
    #username = null;
    #socket = null;

    constructor(username, socket) {
        this.#username = username;
        this.#socket = socket;
    }

    get_id() {
        return this.#user_id;
    }

    set_username(username) {
        this.#username = username;
    }

    get_username() {
        return this.#username;
    }

    set_socket(socket) {
        this.#socket = socket;
    }

    get_socket() {
        return this.#socket;
    }
}

module.exports = Game;