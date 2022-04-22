
// STAGE ENUM
const PRE_GAME = Symbol('pre-game');
const PLAYING = Symbol('playing');
const POST_GAME = Symbol('post-game');

// COLOR
const WHITE = 'w';
const BLACK = 'b';

class Game {
    /***********************************************************/
    /*                    INITIALIZATION                       */
    /***********************************************************/

    // declare private variables
    #options;
    #stage;
    #chess;
    #white_clock;
    #black_clock;
    #board;
    #players;

    constructor(options) {
        this.#parse_arguments(options);

        this.#initialize_stage();
        this.#initialize_chess();
        this.#initialize_clocks();
        this.#initialize_board();
        this.#initialize_players();

        this.#sanity_check();
    }

    #parse_arguments(options) {
        options = options || {};
        if(!options.id) {
            throw 'game id must be specified';
        }
        if(!options.admin) {
            throw 'admin must be specified';
        }

        this.#options = options;

        function clone(obj) {
            return JSON.parse(JSON.stringify(obj));
        }

        this.#options.state.fen = clone(options.state.fen);
        this.#options.state.sparePieces = clone(options.state.sparePieces);
        this.#options.state.start_fen = clone(options.state.start_fen);
        this.#options.state.start_spares = clone(options.state.start_spares);
        this.#options.state.pgn = clone(options.state.pgn);
    }

    #initialize_stage() {
        switch(this.#options.stage) {
            case 'pre-game':
                this.#stage = PRE_GAME;
                break;
            case 'playing':
                this.#stage = PLAYING;
                break;
            case 'post-game':
                this.#stage = POST_GAME;
                break;
        }
    }

    #initialize_chess() {
        // player joins while game is being set up
        if(this.#stage === PRE_GAME) {
            this.#chess = new Chess(this.#options.state.fen, this.#options.state.sparePieces);
        // player joins midgame or post-game
        } else {
            this.#chess = new Chess(this.#options.state.start_fen, this.#options.state.start_spares);
            this.#chess.load_pgn(this.#options.state.pgn);
        }
    }

    #initialize_clocks() {
        this.#white_clock = new Stopwatch($('#white_clock').get(0), {
                                                clock: time_white, // injected in game.ejs
                                                delay: 100,
                                            });
        this.#black_clock = new Stopwatch($('#black_clock').get(0), {
                                                clock: time_black, // injected in game.ejs
                                                delay: 100,
                                            });

        // player joins while game is being set up
        if(this.#stage === PRE_GAME) {
            this.#white_clock.hide()
            this.#black_clock.hide()
        // player joins midgame
        } else if(this.#stage === PLAYING) {
            if(this.#chess.turn() === WHITE) {
                this.#white_clock.start()
            } else {
                this.#black_clock.start()
            }
        }
    }

    #initialize_board() {
        let board_config = {
                draggable: true,
                position: this.#options.state.fen,
                sparePieces: this.#options.state.sparePieces,
                onDragStart: this.#onDragStart.bind(this),
                onDrop: this.#onDrop.bind(this),
                onSnapEnd: this.#onSnapEnd.bind(this),
                onRightClick: this.#onRightClick.bind(this),
                onPiecePromotion: this.#onPiecePromotion.bind(this),
            }
        this.#board = Chessboard('myBoard', board_config);

        this.#board.move_count(this.#chess.move_count());
    }

    #initialize_players() {
        this.#players = new Players({ element: 'mySidebar',
                                        admin: this.#options.admin, myUsername: this.#options.myUsername,
                                        $username_top: this.#board.getTopUsername(),
                                        $username_bottom: this.#board.getBottomUsername(),
                                        player_added_to_board: this.#player_added_to_board.bind(this),
                                        player_removed_from_board: this.#player_removed_from_board.bind(this),
                                        is_playing: this.#is_playing.bind(this) });

        // add players
        let added_myself = false;
        this.#options.usernames.forEach((arr) => {
            this.#players.add_player(arr[0], arr[1]);
            if(arr[0] === this.#options.myUsername) {
                added_myself = true;
            }
        });
        if(!added_myself) {
            this.#players.add_player(this.#options.myUsername, true);
        }
        if(this.#options.white_player !== null) {
            let position = this.#color_to_board_position('white');
            this.#players.add_player_to_board(position, this.#options.white_player);
        }
        if(this.#options.black_player !== null) {
            let position = this.#color_to_board_position('black');
            this.#players.add_player_to_board(position, this.#options.black_player);
        }
    }

    //////////////////// CHESSBOARD FUNCTIONS ///////////////////

    #onRightClick() {
        // do nothing if the player is viewing history
        if(this.#viewingHistory()) return;
        
        // remove premoves
        let state = this.#chess.get_state(this.#chess.move_count());
        this.#update_board_to_state(state);
        this.#board.clearPremoves();
    }
      
    #onDragStart(source, piece, position, orientation) {
        // do not pick up pieces if the game hasn't started or is over
        if(this.#stage !== PLAYING) return false;
        // do not pick up pieces if the game is over
        if(this.#chess.game_over()) return false;
        // do not pick up pieces if user is checking history
        if(this.#viewingHistory()) return false;
        // do not pick up pieces, if user is not a player
        if(this.#options.myUsername !== this.#options.white_player &&
            this.#options.myUsername !== this.#options.black_player) {
                return false;
            }
        
        // only pick up your pieces
        if((piece.search(/^b/) !== -1 && this.#options.white_player === this.#options.myUsername) ||
            (piece.search(/^w/) !== -1 && this.#options.black_player === this.#options.myUsername)) {
            return false;
        }
    }
      
    #onDrop(source, target, draggedPiece, newPosition, oldPosition, currentOrientation) {
        // promotion move
        if(source !== 'offboard' &&
            draggedPiece.charAt(1).toLowerCase() === 'p' &&
            (target.charAt(1) === '1' || target.charAt(1) === '8')) {
            return 'promotion';
        }
        
        // regular move
        // create move
        let m = {from: source,
                 to: target,
                 color: draggedPiece.charAt(0),
                 piece: draggedPiece.charAt(1).toLowerCase()
                };
        // do it
        return this.#executeMove(m);
    }
      
    #onPiecePromotion(source, target, color, piece, promotionPiece) {
        // create move
        let m = {from: source,
                 to: target,
                 color: color,
                 promotion: promotionPiece,
                 piece: piece
                };
        // do it
        this.#executeMove(m);
    }
      
    #executeMove(move) {
        // if it's not our turn, then premove
        if ((this.#chess.turn() === WHITE && move.color === BLACK) ||
            (this.#chess.turn() === BLACK && move.color === WHITE)) {
                // nothing happend
                if(move.to === move.from) {
                    return 'snapback';
                }

                this.#board.addPremove(move);
                let state = this.#chess.premove_state(this.#board.getPremoves());
                if(state === null || !state.allExecuted) {
                    this.#board.popPremove();
                    return 'snapback';
                } else {
                    this.#update_board_to_state(state, false);
                    this.#highlight_premove_squares();

                    return 'premove';
                }
        }

        // make a move
        let m = this.#chess.move(move);
        // illegal move
        if (m === null) return 'snapback';

        // update clocks
        let elapsed_time = this.#update_clocks();

        // notify server
        this.#options.move_executed(m, elapsed_time)
        
        this.#sanity_check();

        return 'drop';
    }
      
    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    #onSnapEnd () {
        if(!this.#board.arePremoves()) {
            this.#board.position(this.#chess.fen());
        }
    }

    /////////////////// CHESSBOARD CONTROLLERS //////////////////

    #update_board_to_state(state, animation = true) {
        this.#board.position(state.fen, animation);
        this.#board.sparePieces(state.sparePieces);
        this.#board.move_count(state.move_count);
    }

    #highlight_premove_squares() {
        var chess_pos = this.#chess.position();
        var brd_pos = this.#board.position();
        // delete sqares that are the same
        for(let i in chess_pos) {
          if(!chess_pos.hasOwnProperty(i)) continue;
      
          if(brd_pos.hasOwnProperty(i) && brd_pos[i] === chess_pos[i]) {
            delete brd_pos[i];
            delete chess_pos[i];
          }
        }
      
        // add squares that need to be highlighted
        let squares = [];
        for(let i in chess_pos) {
          squares.push(i);
        }
        for(let i in brd_pos) {
          squares.push(i);
        }
      
        this.#board.highlightSquaresRed(squares);
    }

    #update_board_orientation() {
        if((this.#board.orientation() === 'white' && this.#options.black_player === this.#options.myUsername) ||
            (this.#board.orientation() === 'black' && this.#options.white_player === this.#options.myUsername)) {
              this.#board.flip()
              this.#players.swap_usernames_at_board()
        }
    }

    #reset_board(fen, sparePieces) {
        this.#board.orientation('white')
        this.#board.move_count(0)
        this.#board.position(fen)
        this.#board.sparePieces(sparePieces)
    }

    ///////////////////// PLAYERS FUNCTIONS /////////////////////

    #player_added_to_board(position, username) {
        let color = this.#board_position_to_color(position);
        this.#options.player_joined_board(color, username);
        this.#update_players('add', color, username);
    }
  
    #player_removed_from_board(position) {
        let color = this.#board_position_to_color(position);
        this.#options.player_left_board(color);
        this.#update_players('remove', color);
    }

    #is_playing() {
        return this.#stage === PLAYING;
    }

    /////////////////////// PLAYERS UTIL ////////////////////////
  
    #board_position_to_color(position) {
        if((this.#board.orientation() === 'white' &&  position === 'top') ||
            (this.#board.orientation() === 'black' && position === 'bottom')) {
            return 'black';
        } else {
            return 'white';
        }
    }
  
    #color_to_board_position(color) {
        if((this.#board.orientation() === 'white' && color === 'black') || 
            (this.#board.orientation() === 'black' && color === 'white')) {
            return 'top';
        } else {
            return 'bottom';
        }
    }

    //////////////////// CLOCKS CONTROLLERS /////////////////////

    #update_clocks() {
        if(this.#chess.turn() === WHITE) {
            this.#white_clock.start();
            this.#black_clock.stop();
            return this.#black_clock.elapsedTime();
        } else {
            this.#black_clock.start();
            this.#white_clock.stop();
            return this.#white_clock.elapsedTime();
        }
    }

    ///////////////////////// MISC UTIL /////////////////////////

    // update white and black player variables
    #update_players(action, color, username) {
        if(action === 'add') {
            if(color === 'white') {
                this.#options.white_player = username;
            } else {
                this.#options.black_player = username;
            }
        } else {
            if(color === 'white') {
                this.#options.white_player = null;
            } else {
                this.#options.black_player = null;
            }
        }
    }

    /////////////////////////// INFO ////////////////////////////

    #viewingHistory() {
        return this.#board.move_count() !== this.#chess.move_count();
    }

    #sanity_check() {
        setTimeout(() => {console.log(this.#chess.ascii() + '\n')}, 50)
        setTimeout(() => {console.log(this.#board.ascii() + '\n\n')}, 100)
    }

    /***********************************************************/
    /*                      PUBLIC API                         */
    /***********************************************************/

    ///////////////////// GAME INFORMATION //////////////////////

    am_i_at_board() {
        return this.#options.myUsername === this.#options.white_player || 
                this.#options.myUsername === this.#options.black_player;
    }

    is_viewing_history() {
        return this.#viewingHistory();
    }

    is_playing() {
        return this.#stage === PLAYING;
    }

    is_pre_game() {
        return this.#stage === PRE_GAME;
    }

    is_post_game() {
        return this.#stage === POST_GAME;
    }

    turn() {
        return this.#chess.turn();
    }

    in_checkmate() {
        return this.#chess.in_checkmate();
    }

    in_draw() {
        return this.#chess.in_draw();
    }

    in_check() {
        return this.#chess.in_check();
    }

    fen() {
        return this.#chess.fen();
    }

    pgn() {
        return this.#chess.pgn();
    }

    ///////////////////// META CONTROLLERS //////////////////////
    
    set_clocks(whiteClock, blackClock) {
        // correct the clocks
        this.#white_clock.time(whiteClock);
        this.#black_clock.time(blackClock);
    }

    add_player(username) {
        this.#players.add_player(username, true);
    }

    remove_player(username) {
        this.#players.remove_player(username);
    }

    add_player_to_board(color, username) {
        this.#update_players('add', color, username);
        let position = this.#color_to_board_position(color);
        this.#players.add_player_to_board(position, username);
    }

    remove_player_from_board(color) {
        this.#update_players('remove', color);
        let position = this.#color_to_board_position(color);
        this.#players.remove_player_from_board(position);
    }

    ///////////////////// GAME CONTROLLERS //////////////////////

    backward_move() {
        this.#board.clearPremoves();
        let state = this.#chess.get_state(this.#board.move_count() - 1);
        this.#update_board_to_state(state);
    }

    forward_move() {
        let state = this.#chess.get_state(this.#board.move_count() + 1);
        this.#update_board_to_state(state);
    }

    start() {
        // update playing status
        this.#stage = PLAYING;

        //update board orientation
        this.#update_board_orientation();
        
        // reset clocks
        this.#white_clock.reset();
        this.#black_clock.reset();
        // show clocks
        this.#white_clock.show();
        this.#black_clock.show();
        // start clocks
        this.#white_clock.start();
    }

    game_over() {
        if(this.#stage === PLAYING) {
            // update playing status
            this.#stage = POST_GAME;
            // stop clocks
            this.#white_clock.stop();
            this.#black_clock.stop();
        }
    }

    reset(fen, spares) {
        // chess
        this.#chess.reset(fen, spares);

        // board
        this.#reset_board(this.#options.state.fen, this.#options.state.sparePieces);

        // reset usernames
        this.#players.clear_board_usernames();
        
        // hide clocks
        this.#white_clock.hide();
        this.#black_clock.hide();

        // reset console
        console.clear();
        this.#sanity_check();
    }

    move(move) {
        this.#chess.move(move);

        // if not vewing history
        if(this.#board.move_count() === this.#chess.move_count() - 1) {
            // update board to move
            let state = this.#chess.get_state(this.#chess.move_count());
            let opponentColor = this.#chess.turn() === WHITE ? BLACK : WHITE;
            this.#update_board_to_state(state, opponentColor);

            let m = this.#board.getPremove();
            let pm = this.#chess.move(m);
            // execute premove
            if(pm) {
                this.#board.move(pm, false);
                state = this.#chess.premove_state(this.#board.getPremoves());
                this.#update_board_to_state(state, false);
                this.#highlight_premove_squares();

                this.#options.move_executed(pm, 0)

            // premove not valid
            } else {
                this.#board.clearPremoves();
            }
        }
  
        this.#update_clocks();

        this.#sanity_check();
    }

}