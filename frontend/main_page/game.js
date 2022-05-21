
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
    #chess1;
    #chess2;
    #white_clock1;
    #black_clock1;
    #white_clock2;
    #black_clock2;
    #board1;
    #board2;
    #players;
    #dragging;

    constructor(options) {
        this.#parse_arguments(options);

        this.#initialize_stage();

        // first board
        this.#chess1 = this.#initialize_chess(this.#options.first_board);
        this.#initialize_first_clocks();
        this.#board1 = this.#initialize_board('myBoard_1', this.#chess1, 
                            this.#options.first_board, 'first',
                            this.#options.white_player1, this.#options.black_player1);
        this.#board1.move_count(this.#chess1.move_count());

        // second board
        this.#chess2 = this.#initialize_chess(this.#options.second_board);
        this.#initialize_second_clocks();
        this.#board2 = this.#initialize_board('myBoard_2', this.#chess2, 
                            this.#options.second_board, 'second',
                            this.#options.white_player2, this.#options.black_player2);
        this.#board2.move_count(this.#chess2.move_count());

        this.#initialize_players();

        if(this.#stage === PLAYING) {
            this.#update_boards_orientation();
            this.#update_clocks_position();
            this.#start_clocks();
        }

        // initial dragging value
        this.#dragging = null;

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

        this.#options.first_board.fen = clone(options.first_board.fen);
        this.#options.first_board.sparePieces = clone(options.first_board.sparePieces);
        this.#options.first_board.start_fen = clone(options.first_board.start_fen);
        this.#options.first_board.start_spares = clone(options.first_board.start_spares);
        this.#options.first_board.pgn = clone(options.first_board.pgn);
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

    #initialize_chess(chess_info) {
        let chess = null;
        // player joins while game is being set up
        if(this.#stage === PRE_GAME) {
            chess = new Chess(chess_info.fen, chess_info.sparePieces);
        // player joins midgame or post-game
        } else {
            chess = new Chess(chess_info.start_fen, chess_info.start_spares);
            chess.set_added_spares(chess_info.addedSpares);
            chess.load_pgn(chess_info.pgn);
        }
        return chess;
    }

    #initialize_first_clocks() {
        let clocks = this.#initialize_clocks('time1_bottom', 'time1_top',
                                            this.#options.first_board.white_time,
                                            this.#options.first_board.black_time);
        this.#white_clock1 = clocks[0];
        this.#black_clock1 = clocks[1];
    }

    #initialize_second_clocks() {
        let clocks = this.#initialize_clocks('time2_top', 'time2_bottom',
                                            this.#options.second_board.white_time,
                                            this.#options.second_board.black_time);
        this.#white_clock2 = clocks[0];
        this.#black_clock2 = clocks[1];
    }

    #initialize_clocks(element_white, element_black, time_white, time_black) {
        let w_clock = new Stopwatch(element_white, {
                                        clock: time_white, 
                                        delay: 100,
                                    });
        let b_clock = new Stopwatch(element_black, {
                                        clock: time_black, 
                                        delay: 100,
                                    });

        // player joins while game is being set up
        if(this.#stage === PRE_GAME) {
            w_clock.hide();
            b_clock.hide();
        } 

        return [w_clock, b_clock];
    }

    #start_clocks() {
        // start clock on first board
        if(this.#chess1.turn() === WHITE) {
            this.#white_clock1.start();
        } else {
            this.#black_clock1.start();
        }

        // start clock on second board
        if(this.#chess2.turn() === WHITE) {
            this.#white_clock2.start();
        } else {
            this.#black_clock2.start();
        }
    }

    #initialize_board(element, chess, chess_info, board) {
        let board_config = {
                draggable: true,
                position: chess_info.fen,
                sparePieces: chess_info.sparePieces,
                onDragStart: this.#onDragStart.bind(this, chess, board),
                onDrop: this.#onDrop.bind(this, chess, board),
                onSnapEnd: this.#onSnapEnd.bind(this, chess, board),
                onRightClick: this.#onRightClick.bind(this, chess, board),
                onPiecePromotion: this.#onPiecePromotion.bind(this, chess, board),
            }
        return Chessboard(element, board_config);
    }

    #initialize_players() {
        this.#players = new Players({ element: 'mySidebar',
                                        admin: this.#options.admin, myUsername: this.#options.myUsername,
                                        $username_top1: this.#board1.getTopUsername(),
                                        $username_bottom1: this.#board1.getBottomUsername(),
                                        $username_top2: this.#board2.getTopUsername(),
                                        $username_bottom2: this.#board2.getBottomUsername(),
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
        if(this.#options.white_player1 !== null) {
            let position = this.#color_to_board_position('first', 'white');
            this.#players.add_player_to_board('first', position, this.#options.white_player1);
        }
        if(this.#options.black_player1 !== null) {
            let position = this.#color_to_board_position('first', 'black');
            this.#players.add_player_to_board('first', position, this.#options.black_player1);
        }
        if(this.#options.white_player2 !== null) {
            let position = this.#color_to_board_position('second', 'white');
            this.#players.add_player_to_board('second', position, this.#options.white_player2);
        }
        if(this.#options.black_player2 !== null) {
            let position = this.#color_to_board_position('second', 'black');
            this.#players.add_player_to_board('second', position, this.#options.black_player2);
        }
    }

    //////////////////// CHESS FUNCTIONS ////////////////////

    #update_spares_after_move(board, m) {
        if(m !== null) {
            if(m.hasOwnProperty('captured')) {
                let capturedColor = m.color === WHITE ? BLACK : WHITE;
                let piece = capturedColor + m.captured.toUpperCase();
                if(board === 'first') {
                    this.#chess2.addSpare(piece);
                    this.#board2.addSpare(piece);
                } else {
                    this.#chess1.addSpare(piece);
                    this.#board1.addSpare(piece);
                }
            } 

            return true;
        }
    }

    //////////////////// CHESSBOARD FUNCTIONS ////////////////////

    #onRightClick(chess, board) {
        let b = board === 'first' ? this.#board1 :
                                    this.#board2;
        // do nothing if the player is viewing history
        if(this.#viewingHistory()) return;
        
        // remove premoves
        let state = chess.get_state(chess.move_count());
        this.#update_board_to_state(b, state);
        b.clearPremoves();
    }
      
    #onDragStart(chess, board,
         source, piece, position, orientation) {

        let white_player = board === 'first' ? 
                        this.#options.white_player1 :
                        this.#options.white_player2;
        let black_player = board === 'first' ?
                        this.#options.black_player1 :
                        this.#options.black_player2;
        // do not pick up pieces if the game hasn't started or is over
        if(this.#stage !== PLAYING) return false;
        // do not pick up pieces if the game is over
        if(chess.game_over()) return false;
        // do not pick up pieces if user is checking history
        if(this.#viewingHistory()) return false;
        // do not pick up pieces, if user is not a player
        if(this.#options.myUsername !== white_player &&
            this.#options.myUsername !== black_player) {
                return false;
            }
        
        // only pick up your pieces
        if((piece.search(/^b/) !== -1 && white_player === this.#options.myUsername) ||
            (piece.search(/^w/) !== -1 && black_player === this.#options.myUsername)) {
            return false;
        }

        // record which piece is being dragged
        // so mid-dragging updates of board
        // won't cause doubling of piece being dragged 
        this.#dragging = {source, piece};
    }
      
    #onDrop(chess, board,
        source, target, draggedPiece, newPosition, oldPosition, currentOrientation) {

        // no piece is being dragged anymore
        this.#dragging = null;
        
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
        return this.#executeMove(chess, board, m);
    }
      
    #onPiecePromotion(chess, board, 
            source, target, color, piece, promotionPiece) {
        // create move
        let m = {from: source,
                 to: target,
                 color: color,
                 promotion: promotionPiece,
                 piece: piece
                };
        // do it
        this.#executeMove(chess, board, m);
    }
      
    #executeMove(chess, board, move) {
        let b = board === 'first' ? this.#board1 :
                                    this.#board2;
        // if it's not our turn, then premove
        if ((chess.turn() === WHITE && move.color === BLACK) ||
            (chess.turn() === BLACK && move.color === WHITE)) {
                // nothing happend
                if(move.to === move.from) {
                    return 'snapback';
                }

                b.addPremove(move);
                let state = chess.premove_state(b.getPremoves());
                if(state === null || !state.allExecuted) {
                    b.popPremove();
                    return 'snapback';
                } else {
                    this.#update_board_to_state(b, state, false);
                    this.#highlight_premove_squares(chess, b);

                    return 'premove';
                }
        }

        // make a move
        let m = chess.move(move);
        // illegal move
        if (m === null) return 'snapback';

        // if promotion move, update board
        if(m.hasOwnProperty('promotion')) {
            let state = chess.get_state(chess.move_count());
            this.#update_board_to_state(b, state, false);
        }
        this.#update_spares_after_move(board, m);

        // update clocks
        let elapsed_time = this.#update_clocks(board);

        // notify server
        this.#options.move_executed(board, m, elapsed_time)
        
        this.#sanity_check();

        return 'drop';
    }
      
    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    #onSnapEnd (chess, board) {
        let b = board === 'first' ? this.#board1 :
                                    this.#board2;
        if(!b.arePremoves()) {
            b.position(chess.fen());
        }
    }

    /////////////////// CHESSBOARD CONTROLLERS //////////////////

    #update_board_to_state(board, state, animation = true) {
        board.position(state.fen, animation);
        board.sparePieces(state.sparePieces);
        board.move_count(state.move_count);
    }

    #highlight_premove_squares(chess, board) {
        let chess_pos = chess.position();
        let brd_pos = board.position();
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
      
        board.highlightSquaresRed(squares);
    }

    #update_boards_orientation() {
        // i'm white player at first board
        if(this.#options.myUsername === this.#options.white_player1) {
            // my board
            if(this.#board1.orientation() === 'black') {
                this.#board1.flip();
                this.#players.swap_usernames_at_board('first');
            }
            // teammate's board
            if(this.#board2.orientation() === 'white') {
                this.#board2.flip();
                this.#players.swap_usernames_at_board('second');
            }
        // i'm black player at first board
        } else if(this.#options.myUsername === this.#options.black_player1) {
            // my board
            if(this.#board1.orientation() === 'white') {
                this.#board1.flip();
                this.#players.swap_usernames_at_board('first');
            }
            // teammate's board
            if(this.#board2.orientation() === 'black') {
                this.#board2.flip();
                this.#players.swap_usernames_at_board('second');
            }
        // i'm white player at second board
        } else if(this.#options.myUsername === this.#options.white_player2) {
            // my board
            if(this.#board2.orientation() === 'black') {
                this.#board2.flip();
                this.#players.swap_usernames_at_board('second');
            }
            // teammate's board
            if(this.#board1.orientation() === 'white') {
                this.#board1.flip();
                this.#players.swap_usernames_at_board('first');
            }
        // i'm black player at second board
        } else if(this.#options.myUsername === this.#options.black_player2) {
            // my board
            if(this.#board2.orientation() === 'white') {
                this.#board2.flip();
                this.#players.swap_usernames_at_board('second');
            }
            // teammate's board
            if(this.#board1.orientation() === 'black') {
                this.#board1.flip();
                this.#players.swap_usernames_at_board('first');
            }
        // i'm watcher
        } else {
            // first board
            if(this.#board1.orientation() === 'black') {
                this.#board1.flip();
                this.#players.swap_usernames_at_board('first');
            }
            // second board
            if(this.#board2.orientation() === 'white') {
                this.#board2.flip();
                this.#players.swap_usernames_at_board('second');
            }
        }

    }

    #reset_boards(fen, sparePieces) {
        this.#board1.orientation('white');
        this.#board1.move_count(0);
        this.#board1.position(fen);
        this.#board1.sparePieces(sparePieces);

        this.#board2.orientation('white');
        this.#board2.move_count(0);
        this.#board2.position(fen);
        this.#board2.sparePieces(sparePieces);

    }

    ///////////////////// PLAYERS FUNCTIONS /////////////////////

    #player_added_to_board(board, position, username) {
        let color = this.#board_position_to_color(board, position);
        this.#options.player_joined_board(board, color, username);
        this.#update_players('add', board, color, username);
    }
  
    #player_removed_from_board(board, position) {
        let color = this.#board_position_to_color(board, position);
        this.#options.player_left_board(board, color);
        this.#update_players('remove', board, color);
    }

    #is_playing() {
        return this.#stage === PLAYING;
    }

    /////////////////////// PLAYERS UTIL ////////////////////////
  
    #board_position_to_color(board, position) {
        let b = board === 'first' ? this.#board1 : this.#board2;
        if((b.orientation() === 'white' &&  position === 'top') ||
            (b.orientation() === 'black' && position === 'bottom')) {
            return 'black';
        } else {
            return 'white';
        }
    }
  
    #color_to_board_position(board, color) {
        let b = board === 'first' ? this.#board1 : this.#board2;
        if((b.orientation() === 'white' && color === 'black') || 
            (b.orientation() === 'black' && color === 'white')) {
            return 'top';
        } else {
            return 'bottom';
        }
    }

    ///////////////////// CLOCKS FUNCTIONS /////////////////////

    #update_clocks_position() {
        // first board
        if(this.#board1.orientation() === 'white') {
            this.#white_clock1.set_element_id('time1_bottom');
            this.#black_clock1.set_element_id('time1_top');
        } else {
            this.#white_clock1.set_element_id('time1_top');
            this.#black_clock1.set_element_id('time1_bottom');
        }
        // second board
        if(this.#board2.orientation() === 'white') {
            this.#white_clock2.set_element_id('time2_bottom');
            this.#black_clock2.set_element_id('time2_top');
        } else {
            this.#white_clock2.set_element_id('time2_top');
            this.#black_clock2.set_element_id('time2_bottom');
        }
    }

    ///////////////////// CLOCKS CONTROLLERS /////////////////////

    #update_clocks(board) {
        let chess = board === 'first' ? this.#chess1 :
                                        this.#chess2;
        let w_clock = board === 'first' ? this.#white_clock1 :
                                            this.#white_clock2;
        let b_clock = board === 'first' ? this.#black_clock1 :
                                            this.#black_clock2;

        if(chess.turn() === WHITE) {
            w_clock.start();
            b_clock.stop();
            return b_clock.elapsedTime();
        } else {
            b_clock.start();
            w_clock.stop();
            return w_clock.elapsedTime();
        }
    }

    ///////////////////////// MISC UTIL /////////////////////////

    // update white and black player variables
    #update_players(action, board, color, username) {
        if(board === 'first') {
            if(action === 'add') {
                if(color === 'white') {
                    this.#options.white_player1 = username;
                } else {
                    this.#options.black_player1 = username;
                }
            } else {
                if(color === 'white') {
                    this.#options.white_player1 = null;
                } else {
                    this.#options.black_player1 = null;
                }
            }
        } else {
            if(action === 'add') {
                if(color === 'white') {
                    this.#options.white_player2 = username;
                } else {
                    this.#options.black_player2 = username;
                }
            } else {
                if(color === 'white') {
                    this.#options.white_player2 = null;
                } else {
                    this.#options.black_player2 = null;
                }
            }
        }
    }

    /////////////////////////// INFO ////////////////////////////

    #viewingHistory() {
        return this.#board1.move_count() !== this.#chess1.move_count();
    }

    #sanity_check() {
        setTimeout(() => {console.log(this.#chess1.ascii() + '\n')}, 50)
        setTimeout(() => {console.log(this.#chess2.ascii() + '\n\n')}, 100)
    }

    /***********************************************************/
    /*                      PUBLIC API                         */
    /***********************************************************/

    ///////////////////// GAME INFORMATION //////////////////////

    am_i_at_board() {
        return this.#options.myUsername === this.#options.white_player1 || 
                this.#options.myUsername === this.#options.black_player1 ||
                this.#options.myUsername === this.#options.white_player2 ||
                this.#options.myUsername === this.#options.black_player2;
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

    turn(board) {
        return board === 'first' ? this.#chess1.turn() :
                                    this.#chess2.turn();
    }

    in_checkmate(board) {
        return board === 'first' ? this.#chess1.in_checkmate() :
                                    this.#chess2.in_checkmate();
    }

    in_draw(board) {
        return board === 'first' ? this.#chess1.in_draw() :
                                    this.#chess2.in_draw();
    }

    in_check(board) {
        return board === 'first' ? this.#chess1.in_check() :
                                    this.#chess2.in_check();
    }

    fen(board) {
        return board === 'first' ? this.#chess1.fen() :
                                    this.#chess2.fen();
    }

    pgn(board) {
        return board === 'first' ? this.#chess1.pgn() :
                                    this.#chess2.pgn();
    }

    ///////////////////// META CONTROLLERS //////////////////////
    
    set_clocks(board, whiteClock, blackClock) {
        if(board === 'first') {
            // correct the clocks on first board
            this.#white_clock1.time(whiteClock);
            this.#black_clock1.time(blackClock);
        } else {
            // correct the clocks on second board
            this.#white_clock2.time(whiteClock);
            this.#black_clock2.time(blackClock);
        }
        
    }

    add_player(username) {
        this.#players.add_player(username, true);
    }

    remove_player(username) {
        this.#players.remove_player(username);
    }

    add_player_to_board(board, color, username) {
        this.#update_players('add', board, color, username);
        let position = this.#color_to_board_position(board, color);
        this.#players.add_player_to_board(board, position, username);
    }

    remove_player_from_board(board, color) {
        this.#update_players('remove', board, color);
        let position = this.#color_to_board_position(board, color);
        this.#players.remove_player_from_board(board, position);
    }

    ///////////////////// GAME CONTROLLERS //////////////////////

    backward_move(board) {
        if(board === 'first') {
            this.#board1.clearPremoves();
            let state = this.#chess1.get_state(this.#board1.move_count() - 1);
            // state.turn ensures only pieces of color whose turn it was are animated
            // in order to prevent animating eaten pieces
            this.#update_board_to_state(this.#board1, state, state.turn);
        } else {
            this.#board2.clearPremoves();
            let state = this.#chess2.get_state(this.#board2.move_count() - 1);
            // state.turn ensures only pieces of color whose turn it was are animated
            // in order to prevent animating eaten pieces
            this.#update_board_to_state(this.#board2, state, state.turn);
        }
    }

    forward_move(board) {
        if(board === 'first') {
            let state = this.#chess1.get_state(this.#board1.move_count() + 1);
            this.#update_board_to_state(this.#board1, state);
        } else {
            let state = this.#chess2.get_state(this.#board2.move_count() + 1);
            this.#update_board_to_state(this.#board2, state);
        }
    }

    start() {
        // update playing status
        this.#stage = PLAYING;

        //update board orientation
        this.#update_boards_orientation();
        // update clocks positions based on board orientation
        this.#update_clocks_position();
        
        // reset clocks
        this.#white_clock1.reset();
        this.#black_clock1.reset();
        this.#white_clock2.reset();
        this.#black_clock2.reset();
        // show clocks
        this.#white_clock1.show();
        this.#black_clock1.show();
        this.#white_clock2.show();
        this.#black_clock2.show();
        // start clocks
        this.#white_clock1.start();
        this.#white_clock2.start();
    }

    game_over() {
        if(this.#stage === PLAYING) {
            // update playing status
            this.#stage = POST_GAME;
            // stop clocks
            this.#white_clock1.stop();
            this.#black_clock1.stop();
            this.#white_clock2.stop();
            this.#black_clock2.stop();
        }
    }

    reset(fen, spares) {
        // chess
        this.#chess1.reset(fen, spares);
        this.#chess2.reset(fen, spares);

        // board
        this.#reset_boards(fen, spares);

        // reset usernames
        this.#players.clear_board_usernames();
        
        // hide clocks
        this.#white_clock1.hide();
        this.#black_clock1.hide();
        this.#white_clock2.hide();
        this.#black_clock2.hide();

        // reset console
        console.clear();
        this.#sanity_check();
    }

    move(board, move) {
        let chess = board === 'first' ? this.#chess1 :
                                        this.#chess2;
        let b = board === 'first' ? this.#board1 :
                                    this.#board2;

        let cm = chess.move(move);
        this.#update_spares_after_move(board, cm);

        // if not viewing history
        if(b.move_count() === chess.move_count() - 1) {
            // update board to move
            let state = chess.get_state(chess.move_count());
            let opponentColor = chess.turn() === WHITE ? BLACK : WHITE;
            this.#update_board_to_state(b, state, opponentColor);
            
            if(this.#dragging !== null) {
                // regular piece
                if(this.#dragging.source !== 'offboard') {
                    // if there is my piece on that square
                    if(b.position()[this.#dragging.source].charAt(0) === chess.turn()) {
                        // TODO: move logic here
                        // b.hidePieceOnSquare(this.#dragging.source);
                    // if there is opponent's piece on that square, means my piece is eaten
                    } else {
                        b.breakPieceDragging();
                        this.#dragging = null;
                    }
                // spare piece
                } else {
                    // show one less spare piece, because one is being dragged
                    // TODO: move logic here
                    // b.reduceDisplayCount(this.#dragging.piece);
                }
            }

            let m = b.getPremove();
            let pm = chess.move(m);
            // execute premove
            if(pm) {
                this.#update_spares_after_move(board, pm);
                b.move(pm, false);

                state = chess.premove_state(b.getPremoves());
                this.#update_board_to_state(b, state, false);
                this.#highlight_premove_squares(chess, b);

                this.#options.move_executed(board, pm, 0);

            // premove not valid
            } else {
                b.clearPremoves();
                if(m != null && this.#dragging !== null) {
                    b.breakPieceDragging();
                    this.#dragging = null;
                }
            }
        }
  
        this.#update_clocks(board);

        this.#sanity_check();
    }

}