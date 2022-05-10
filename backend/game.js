const Chess = require("./modules/chess.js/chess")
const Stopwatch = require("./stopwatch")
const utils = require("./utils")

// STAGE ENUM
const PRE_GAME = Symbol('pre-game');
const PLAYING = Symbol('playing');
const POST_GAME = Symbol('post-game');

class Game {
    // declare private variables
    #id;
    #stage;
    #chess1;
    #chess2;
    #players;
    #admin;
    #white_player1;
    #black_player1;
    #white_player2;
    #black_player2;
    #white_timer1;
    #black_timer1;
    #white_timer2;
    #black_timer2;

    constructor(options) {
        this.#id = utils.uuid(8);

        this.#chess1 = new Chess(options.fen, options.spares);
        this.#chess2 = new Chess(options.fen, options.spares);
        this.#stage = PRE_GAME;

        this.#players = {};
        this.#admin = options.admin;
        if(typeof this.#admin === 'undefined') {
            throw 'admin is a required parameter';
        }
        this.#white_player1 = options.white_player ?? null;
        this.#black_player1 = options.black_player ?? null;
        this.#white_player2 = options.white_player ?? null;
        this.#black_player2 = options.black_player ?? null;

        this.#white_timer1 = new Stopwatch({delay: 100, 
                                        clock: options.white_clock ?? 5 * 1000 * 60,
                                        onTimesUp: this.#game_over.bind(this) });
        this.#black_timer1 = new Stopwatch({delay: 100,
                                        clock: options.black_clock ?? 5 * 1000 * 60,
                                        onTimesUp: this.#game_over.bind(this) });
        this.#white_timer2 = new Stopwatch({delay: 100, 
                                        clock: options.white_clock ?? 5 * 1000 * 60,
                                        onTimesUp: this.#game_over.bind(this) });
        this.#black_timer2 = new Stopwatch({delay: 100,
                                        clock: options.black_clock ?? 5 * 1000 * 60,
                                        onTimesUp: this.#game_over.bind(this) });
    }

    #set_position(chess, fen, spares) {
        let loaded_fen = chess.load(fen);
        if(loaded_fen) {
            let loaded_spares = chess.loadSpares(spares);
            if(loaded_spares) {
                return true;
            }
        }
        
        return false;
    }

    #game_over(username) {
        this.#stage = POST_GAME;
        this.#white_timer1.stop();
        this.#black_timer1.stop();
        this.#white_timer2.stop();
        this.#black_timer2.stop();
        let messages = this.#get_pop_up_messages(username);

        for(let i in this.#players) {
            let p = this.#players[i];
            if(p) {
                let socket = p.get_socket();
                if(socket) {
                    // white player on first board
                    if(p.get_username() === this.#white_player1) {
                        socket.emit('game_is_over', messages.white1);
                    // black player on first board
                    } else if(p.get_username() === this.#black_player1) {
                        socket.emit('game_is_over', messages.black1);
                    // white player on second board 
                    } else if(p.get_username() === this.#white_player2) {
                        socket.emit('game_is_over', messages.white2)
                    // black player on second board
                    } else if(p.get_username() === this.#black_player2) {
                        socket.emit('game_is_over', messages.black2);
                    // watcher
                    } else {
                        socket.emit('game_is_over', messages.watcher);
                    }
                }
            }
        }
    }
        
    #get_pop_up_messages(player) {
        player = player ?? null;
        let msgForWatchers = '';
        let msgForWhite1 = '';
        let msgForBlack1 = '';
        let msgForWhite2 = '';
        let msgForBlack2 = '';
    
        // checkmate on first board
        if (this.#chess1.in_checkmate()) {
            if(this.#chess1.turn() === 'w') {
                msgForWatchers = 'Game over, ' + this.#white_player1 + ' is in checkmate';
                msgForWhite1 = 'You lost, by checkmate';
                msgForBlack1 = 'You won, by checkmate';
                msgForWhite2 = 'You won, ' + this.#black_player1 + ' checkmated ' + this.#white_player1;
                msgForBlack2 = 'You lost, ' + this.#white_player1 + ' was checkmated by ' + this.#black_player1;
            } else {
                msgForWatchers = 'Game over, ' + this.#black_player1 + ' is in checkmate';
                msgForWhite1 = 'You won, by checkmate';
                msgForBlack1 = 'You lost, by checkmate';
                msgForWhite2 = 'You lost, ' + this.#black_player1 + ' was checkmated by ' + this.#white_player1;
                msgForBlack2 = 'You won, ' + this.#white_player1 + ' checkmated ' + this.#black_player1;
            }
        // draw on first or second board
        } else if (this.#chess1.in_draw() || this.#chess2.in_draw()) {
            msgForWatchers = 'Draw';
            msgForWhite1 = 'Draw';
            msgForBlack1 = 'Draw'; //TODO: why is it a draw, insufficient material??
            msgForWhite2 = 'Draw';
            msgForBlack2 = 'Draw';
        // white player on first board ran out of time
        } else if(this.#white_timer1.time() === 0) {
            msgForWatchers = 'Game over, ' + this.#white_player1 + ' ran out of time';
            msgForWhite1 = 'You lost, on time';
            msgForBlack1 = 'You won, ' + this.#white_player1 + ' ran out of time';
            msgForWhite2 = 'You won, ' + this.#white_player1 + ' ran out of time';
            msgForBlack2 = 'You lost, ' + this.#white_player1 + ' ran out of time';
        // black player on first board ran out of time
        } else if(this.#black_timer1.time() === 0) {
            msgForWatchers = 'Game over, ' + this.#black_player1 + ' ran out of time';
            msgForWhite1 = 'You won, ' + this.#black_player1 + ' ran out of time';
            msgForBlack1 = 'You lost, on time';
            msgForWhite2 = 'You lost, ' + this.#black_player1 + ' ran out of time';
            msgForBlack2 = 'You won, ' + this.#black_player1 + ' ran out of time';
        // resignation on first board
        } else if(player === this.#white_player1 || player === this.#black_player1) {
            if(player === this.#white_player1) {
                msgForWatchers = 'Game over, ' + this.#white_player1 + ' resigned';
                msgForWhite1 = 'You lost, by resignation';
                msgForBlack1 = 'You won, ' + this.#white_player1 + ' resigned';
                msgForWhite2 = 'You won, ' + this.#white_player1 + ' resigned';
                msgForBlack2 = 'You lost, ' + this.#white_player1 + ' resigned';
            } else {
                msgForWatchers = 'Game over, ' + this.#black_player1 + ' resigned';
                msgForWhite1 = 'You won, ' + this.#black_player1 + ' resigned';
                msgForBlack1 = 'You lost, by resignation';
                msgForWhite2 = 'You lost, ' + this.#black_player1 + ' resigned';
                msgForBlack2 = 'You won, ' + this.#black_player1 + ' resigned';
            }
        // checkmate on second board
        } else if(this.#chess2.in_checkmate()) {
            if(this.#chess2.turn() === 'w') {
                msgForWatchers = 'Game over, ' + this.#white_player2 + ' is in checkmate';
                msgForWhite1 = 'You won, ' + this.#black_player2 + ' checkmated ' + this.#white_player2;
                msgForBlack1 = 'You lost, ' + this.#white_player2 + ' was checkmated by ' + this.#black_player2;
                msgForWhite2 = 'You lost, by checkmate';
                msgForBlack2 = 'You won, by checkmate';
            } else {
                msgForWatchers = 'Game over, ' + this.#black_player2 + 'is in checkmate';
                msgForWhite1 = 'You lost, ' + this.#black_player2 + ' was checkmated by ' + this.#white_player2;
                msgForBlack1 = 'You won, ' + this.#white_player2 + ' checkmated ' + this.#black_player2;
                msgForWhite2 = 'You won, by checkmate';
                msgForBlack2 = 'You lost, by checkmate';
            }
        // white player on second board ran out of time
        } else if(this.#white_timer2.time() === 0) {
            msgForWatchers = 'Game over, ' + this.#white_player2 + ' ran out of time';
            msgForWhite1 = 'You won, ' + this.#white_player2 + ' ran out of time';
            msgForBlack1 = 'You lost, ' + this.#white_player2 + ' ran out of time';
            msgForWhite2 = 'You lost, on time';
            msgForBlack2 = 'You won, ' + this.#white_player2 + ' ran out of time';
        // black player on second board ran out of time
        } else if(this.#black_timer2.time() === 0) {
            msgForWatchers = 'Game over, ' + this.#black_player2 + ' ran out of time';
            msgForWhite1 = 'You lost, ' + this.#black_player2 + ' ran out of time';
            msgForBlack1 = 'You won, ' + this.#black_player2 + ' ran out of time';
            msgForWhite2 = 'You won,' + this.#black_player2 + ' ran out of time';
            msgForBlack2 = 'You lost, on time';
        // resignation on second board
        } else {
            if(player === this.#white_player2) {
                msgForWatchers = 'Game over, ' + this.#white_player2 + ' resigned';
                msgForWhite1 = 'You won, ' + this.#white_player2 + ' resigned';
                msgForBlack1 = 'You lost, ' + this.#white_player2 + ' resigned';
                msgForWhite2 = 'You lost, by resignation';
                msgForBlack2 = 'You won, ' + this.#white_player2 + ' resigned';
            } else {
                msgForWatchers = 'Game over, ' + this.#black_player2 + ' resigned';
                msgForWhite1 = 'You lost, ' + this.#white_player2 + ' resigned';
                msgForBlack1 = 'You won, ' + this.#white_player2 + ' resigned';
                msgForWhite2 = 'You won, ' + this.#white_player2 + ' resigned';
                msgForBlack2 = 'You lost, by resignation';
            }
        }
    
        return {white1: msgForWhite1, black1: msgForBlack1, 
                white2: msgForWhite2, black2: msgForBlack2, watcher: msgForWatchers}        
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
                first_board: {
                    fen: this.#chess1.fen(),
                    sparePieces: this.#chess1.sparePieces(),
                    addedSpares: this.#chess1.addedSpares(),
                    start_fen: this.#chess1.start_fen(),
                    start_spares: this.#chess1.start_spares(),
                    pgn: this.#chess1.pgn(),
                    white_time: this.#white_timer1.time(),
                    black_time: this.#black_timer1.time(),
                },
                second_board: {
                    fen: this.#chess2.fen(),
                    sparePieces: this.#chess2.sparePieces(),
                    addedSpares: this.#chess2.addedSpares(),
                    start_fen: this.#chess2.start_fen(),
                    start_spares: this.#chess2.start_spares(),
                    pgn: this.#chess2.pgn(),
                    white_time: this.#white_timer2.time(),
                    black_time: this.#black_timer2.time(),
                },
                admin: this.#admin,
                white_player1: this.#white_player1,
                black_player1: this.#black_player1,
                white_player2: this.#white_player2,
                black_player2: this.#black_player2,
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

    has_player(user_id) { //TODO: rename this
        return this.#players.hasOwnProperty(user_id);
    }

    has_username(username) {
        for(let i in this.#players) {
            let p = this.#players[i];
            if(p.get_username() === username &&
                p.get_socket() !== null) {
                    return true;
                } 
        }
        
        return false;
    }

    is_player(player) {
        return player.get_username() === this.#white_player1 ||
                player.get_username() === this.#black_player1 ||
                player.get_username() === this.#white_player2 ||
                player.get_username() === this.#black_player2;
    }

    is_admin(player) {
        return player.get_username() === this.#admin;
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
            (this.#white_player1 === p.get_username() ||
             this.#black_player1 === p.get_username() ||
             this.#white_player2 === p.get_username() ||
             this.#black_player2 === p.get_username())) {
                p.set_socket(null);
        } else {
            delete this.#players[user_id];
        }
    }

    set_player_at_board(board, color, username) {
        if(board === 'first') {
            if(color === 'white') {
                if(this.#white_player1 === null) {
                    this.#white_player1 = username;
                } else {
                    return false;
                }
            } else {
                if(this.#black_player1 === null) {
                    this.#black_player1 = username;
                } else {
                    return false;
                }
            }
        } else {
            if(color === 'white') {
                if(this.#white_player2 === null) {
                    this.#white_player2 = username;
                } else {
                    return false;
                }
            } else {
                if(this.#black_player2 === null) {
                    this.#black_player2 = username;
                } else {
                    return false;
                }
            }
        }
        
        return true;
    }

    remove_player_from_board(board, color) {
        if(board === 'first') {
            if(color === 'white') {
                this.#white_player1 = null;
            } else {
                this.#black_player1 = null;
            }
        } else {
            if(color === 'white') {
                this.#white_player2 = null;
            } else {
                this.#black_player2 = null;
            }
        }
        
        // TODO: should be return true, false
        return true;
    }

    boards_are_set() {
        return this.#white_player1 !== null && 
                this.#black_player1 !== null &&
                this.#white_player2 !== null &&
                this.#black_player2 !== null;
    }

    start() {
        if(this.boards_are_set()) {
            this.#stage = PLAYING;
            this.#white_timer1.reset();
            this.#black_timer1.reset();
            this.#white_timer2.reset();
            this.#black_timer2.reset();

            this.#white_timer1.start();
            this.#white_timer2.start();

            return true;
        }

        return false;
    }

    check_status() {
        if(this.#chess1.game_over() || this.#chess2.game_over()) {
            this.#game_over();
        }
    }

    resigned(player) {
        if(this.is_player(player)) {
            this.#game_over(player.get_username());
        }
    }

    set_position(fen, spares) {
        let position_set = this.#set_position(this.#chess1, fen, spares);
        if(position_set) {
            position_set &&= this.#set_position(this.#chess2, fen, spares);
        }
        
        return position_set;
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
        this.#white_player1 = null;
        this.#black_player1 = null;
        this.#white_player2 = null;
        this.#black_player2 = null;
    }

    move(board, player, move) {
        let chess = board === 'first' ? this.#chess1 : this.#chess2;
        let w_player = board === 'first' ? this.#white_player1 :
                                            this.#white_player2;
        let b_player = board === 'first' ? this.#black_player1 :
                                            this.#black_player2;
        if((chess.turn() === 'w' && player.get_username() === w_player) ||
            (chess.turn() === 'b' && player.get_username() === b_player)) {
                let m = chess.move(move);
                if(m !== null) {
                    if(m.hasOwnProperty('captured')) {
                        let capturedColor = m.color === 'w' ? 'b' : 'w';
                        let piece = capturedColor + m.captured.toUpperCase();
                        if(board === 'first') {
                            this.#chess2.addSpare(piece);
                        } else {
                            this.#chess1.addSpare(piece);
                        }
                    } 

                    return true;
                }
        }
        return false;
    }

    get_white_time(board) {
        return board === 'first' ? this.#white_timer1.time() :
                                    this.#white_timer2.time();
    }

    get_black_time(board) {
        return board === 'first' ? this.#black_timer1.time() :
                                    this.#black_timer2.time();
    }

    update_timers(board, elapsed_time) {
        if(board === 'first') {
            if(this.#chess1.turn() === 'w') {
                this.#black_timer1.stop();
                this.#white_timer1.start();
                this.#refundLagTime(this.#black_timer1, elapsed_time);
            } else {
                this.#white_timer1.stop();
                this.#black_timer1.start();
                this.#refundLagTime(this.#white_timer1, elapsed_time);
            }
        } else {
            if(this.#chess2.turn() === 'w') {
                this.#black_timer2.stop();
                this.#white_timer2.start();
                this.#refundLagTime(this.#black_timer2, elapsed_time);
            } else {
                this.#white_timer2.stop();
                this.#black_timer2.start();
                this.#refundLagTime(this.#white_timer2, elapsed_time);
            }
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