//// retrieve data ////
// NOTE: data variable is included at renderization time (runtime)
let game_id = data.id
console.log(game_id) //TODO: this should be displayed on page
let admin = data.admin
let white_player = data.white_player
let black_player = data.black_player
let turn = data.turn
let times = data.state.times
let players = data.usernames
let stage = data.stage
let fen = data.state.fen
let sparePieces = data.state.sparePieces
let start_fen = data.state.start_fen
let start_spares = data.state.start_spares
let pgn = data.state.pgn


//////////////// initialization ///////////////////////

//// chess ////
var premoves = []
if(stage === 'pre-game') { //TODO: deepCopy IN COSTRUCTOR NOT HERE!!!
  var game = new Chess(fen, deepCopy(sparePieces)) //TODO: won't this cause name conflict with chess and app?
// if player joins midgame
} else {
  var game = new Chess(start_fen, deepCopy(start_spares))
  game.load_pgn(pgn)
  // sanity check
  setTimeout(() => {console.log(game.ascii() + '\n')}, 50)
  setTimeout(() => {console.log(board.ascii() + '\n\n')}, 300)
}
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')

//// chessboard ////
var config = {
  draggable: true,
  position: fen,
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
  sparePieces: deepCopy(sparePieces),
}
var board = Chessboard('myBoard', config)

// when player joins midgame, update status immedietely
if(stage === 'playing') {
  updateStatus()
}

//// sidebar ////
var sidebar = Sidebar('mySidebar', 
                        admin, myUsername,
                        board.getTopUsername(), board.getBottomUsername(), 
                        playerJoined, playerRemoved,
                        isPlaying)
// add players
sidebar.addPlayer(myUsername)
sidebar.addPlayer(players)
if(white_player !== null) {
  var position = locationOfPlayer('white')
  sidebar.addPlayerToBoard(position, white_player)
}
if(black_player !== null) {
  var position = locationOfPlayer('black')
  sidebar.addPlayerToBoard(position, black_player)
}

//// timers ////
var white_timer = new Stopwatch($('#white_timer').get(0), {
                            clock: time_white, // injected in game.ejs
                            delay: 100,
                          });
var black_timer = new Stopwatch($('#black_timer').get(0), {
                            clock: time_black, // injected in game.ejs
                            delay: 100,
                          });
if(stage === 'pre-game') {
  white_timer.hide()
  black_timer.hide()
} else if(stage === 'playing') {
  if(turn === 'w') {
    white_timer.start()
  } else {
    black_timer.start()
  }
}

//// buttons ////

// forward and backward buttons
var $backward_button = $('#backward_button')
$backward_button.on('click', backward_move)
var $forward_button = $('#forward_button')
$forward_button.on('click', forward_move)
// hide buttons if not playing
if(stage === 'pre-game') {
  $backward_button.css('display', 'none')
  $forward_button.css('display', 'none')
} 

// resign button
var $resign_button = $('#resign_game')
$resign_button.css('display', 'none')
$resign_button.on('click', resign_game)


//// init admin page ////
if(myUsername === admin) {
  // start button
  var $start_button = $('<button id="start_game">start</button>')
  $('#main_page').append($start_button)
  $start_button.attr('disabled', 'disabled')
  $start_button.on('click', start_game)

  // reset button
  var $reset_button = $('<button id="reset_game">reset</button>')
  $('#main_page').append($reset_button)
  $reset_button.css('display', 'none')
  $reset_button.on('click', reset_game)
}

//// events ////

function start_game(evt) {
  // update playing status
  stage = 'playing'
  // hide start button
  $start_button.css('display', 'none')
  // update board orientation
  updateBoardOrientation()
  // update status
  updateStatus()
  // show resign button to players
  if(myUsername === white_player || myUsername === black_player) {
    $resign_button.css('display', '')
  }
  // show forward, backward buttons
  $forward_button.css('display', '')
  $backward_button.css('display', '')
  // reset timers
  white_timer.reset()
  black_timer.reset()
  // show timers
  white_timer.show()
  black_timer.show()
  // start timer
  white_timer.start()
  // notify server of game started
  server.emit('game_has_started')
}

function backward_move(evt) {
  updateBoardToMove(board.move_count() - 1)
  // sanity check
  setTimeout(() => {console.log(game.ascii() + '\n')}, 50)
  setTimeout(() => {console.log(board.ascii() + '\n\n')}, 300)
}

function forward_move(evt) {
  updateBoardToMove(board.move_count() + 1)
  // sanity check
  setTimeout(() => {console.log(game.ascii() + '\n')}, 50)
  setTimeout(() => {console.log(board.ascii() + '\n\n')}, 300)
}

function updateBoardToMove(moveNum) {
  var state = game.get_state(moveNum)
  board.position(state.fen)
  board.sparePieces(state.sparePieces)
  board.move_count(state.move_count)
}

function viewingHistory() {
  return board.move_count() !== game.move_count()
}

function resign_game(evt) {
  gameIsOver('resignation')
  // hide resign button
  $resign_button.css('display', 'none')
}

function reset_game(evt) {
  // hide reset button
  $reset_button.css('display', 'none')
  // show start button
  $start_button.css('display', '')
  $start_button.attr('disabled', 'disabled')
  // chess
  game.load(fen)
  game.loadSpares(sparePieces)
  // board
  resetBoard(fen, sparePieces)
  // status
  resetStatus()
  // hide timers
  white_timer.hide()
  black_timer.hide()
  // hide forward & backward buttons
  $forward_button.css('display', 'none')
  $backward_button.css('display', 'none')
  // sanity check
  setTimeout(() => {console.log(game.ascii() + '\n')}, 200)
  setTimeout(() => {console.log(board.ascii() + '\n\n')}, 300)
  // send signal to server
  server.emit('reset_game', fen, sparePieces)
}

function resetBoard(fen, sparePieces) {
  board.orientation('white')
  board.position(fen)
  // reset spare pieces
  board.sparePieces(sparePieces)
  // reset usernames
  sidebar.clearBoardUsernames()
}

function updateBoardOrientation() {
  if((board.orientation() === 'white' && black_player === myUsername) ||
      (board.orientation() === 'black' && white_player === myUsername)) {
        board.flip()
        sidebar.swapUsernamesAtBoard()
  }
}

function gameIsOver() {
  if(myUsername === admin) {
    $reset_button.css('display', '')
  }
  server.emit('game_is_over')
}

//////////////// socket io ///////////////////////

// connect to server
// NOTE: io is imported in game.ejs
const server = io('/',  { query: "gameId=" + game_id + "&username=" + myUsername})

// opponent moved
server.on('move', (move, whiteClock, blackClock) => { //TODO: this function shares code with onDrop

  board.position(game.fen(), false)
  board.sparePieces(game.sparePieces())
  board.clearPremoveHighlights() //TODO: this should be controled by chessboard

  game.move(move)
  board.move(move)

  var m = premoves.shift()
  var pm = game.move(m)
  if(pm) {
    board.move(pm, false)
    board.premove(...premoves)
    server.emit('move', pm, 0)
  } else {
    premoves = []
    // update turn
    turn = turn === 'w' ? 'b' : 'w'
    // update timers
    updateTimers()
  }

  updateStatus()

  // if(previousMoves.length === 0) {
    
  // } else {
  //   newMoves.push(move)
  //   // TODO: if I already have a premove, do it & add move to previousMoves instead of newMoves
  //   // timers should be updated
  // }

  // correct the clocks
  white_timer.time(whiteClock)
  black_timer.time(blackClock)
  
  // sanity check
  setTimeout(() => {console.log(game.ascii() + '\n')}, 200)
  setTimeout(() => {console.log(board.ascii() + '\n\n')}, 300)
})

// some player joined
server.on('joined', (username) => {
  sidebar.addPlayer(username)
})

// player added to chessboard
server.on('playerJoined', (color, username) => {
  updatePlayersAtBoard('add', color, username)
  var position = locationOfPlayer(color)
  sidebar.addPlayerToBoard(position, username)
})

// removed player from chessboard
server.on('playerRemoved', (color) => {
  updatePlayersAtBoard('remove', color) //TODO: you really to name this differently
  var position = locationOfPlayer(color)
  sidebar.removePlayerFromBoard(position)
})

// admin can start a game
server.on('can_start_game', () => {
  // this will never be sent to a client that's not an admin
  $start_button.removeAttr('disabled')
})

// admin can't start a game
server.on('cant_start_game', () => {
  // this will never be sent to a client that's not an admin
  $start_button.attr('disabled', 'disabled')
})

// admin initiated new game
server.on('game_has_started', () => {
  // update playing status
  stage = 'playing'
  //update board orientation
  updateBoardOrientation()
  // update status
  updateStatus()
  // show resign button for players
  if(myUsername === white_player || myUsername === black_player) {
    $resign_button.css('display', '')
  }
  // show forward, backward buttons
  $forward_button.css('display', '')
  $backward_button.css('display', '')
  // reset timers
  white_timer.reset()
  black_timer.reset()
  // show timers
  white_timer.show()
  black_timer.show()
  // start timer
  white_timer.start()
})

server.on('game_is_over', (message) => {
  if(stage === 'playing') {
    // update playing status
    stage = 'post-game'
    // show reset button
    if(myUsername === admin) {
      $reset_button.css('display', '')
    }
    // hide resign button
    $resign_button.css('display', 'none')
    // stop timers
    white_timer.stop()
    black_timer.stop()
    // show popup
    console.log(message)
    // TODO: show pop up dialog
  }
})

server.on('reset_game', (fen, sparePieces) => {
  game.load(fen)
  game.loadSpares(sparePieces)
  resetBoard(fen, sparePieces)
  resetStatus()
  $backward_button.css('display', 'none')
  $forward_button.css('display', 'none')
  // hide timers
  white_timer.hide()
  black_timer.hide()
})

// some player disconnected
// TODO: but what if he is playing??
server.on('disconnected', (username) => {
  sidebar.removePlayer(username)
})

//////////////// sidebar functions ///////////////////////

// player added to board
function playerJoined(position, username) {
  var color = colorOfPlayer(position)
  server.emit('playerJoined', color, username)
  updatePlayersAtBoard('add', color, username)
}

// player removed from board
function playerRemoved(position) {
  var color = colorOfPlayer(position)
  server.emit('playerRemoved', color)
  updatePlayersAtBoard('remove', color)
}

function updatePlayersAtBoard(action, color, username) {
  if(action === 'add') {
    if(color === 'white') {
      white_player = username
    } else {
      black_player = username
    }
  } else {
    if(color === 'white') {
      white_player = null
    } else {
      black_player = null
    }
  }
}

function colorOfPlayer(position) {
  if((board.orientation() === 'white' &&  position === 'top') ||
      (board.orientation() === 'black' && position === 'bottom')) {
    return 'black'
  } else {
    return 'white'
  }
}

function locationOfPlayer(color) {
  if((board.orientation() === 'white' && color === 'black') || 
      (board.orientation() === 'black' && color === 'white')) {
    return 'top'
  } else {
    return 'bottom'
  }
}

// used by sidebar
function isPlaying() {
  return stage === 'playing'
}

//////////////// chessboard functions ///////////////////////

function deepCopy(obj) {
    var copy = {}

    for (var property in obj) {
      if (typeof obj[property] === 'object') {
        copy[property] = deepCopy(obj[property])
      } else {
        copy[property] = obj[property]
      }
    }

    return copy
}

function onDragStart (source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false
  // do not pick up pieces if the game hasn't started
  if(stage !== 'playing') return false
  // do not pick up pieces if user is checking history
  if(viewingHistory()) {
    console.log(board.move_count())
    console.log(game.move_count())
    return false
  } 

  // only pick up your pieces
  if((piece.search(/^b/) !== -1 && white_player === myUsername) ||
      (piece.search(/^w/) !== -1 && black_player === myUsername)) {
      return false
  }
}

function onDrop (source, target, draggedPiece, newPosition, oldPosition, currentOrientation) {
  // create move
  var promotion = source === 'offboard' ? false : 'q'
  var m = {from: source,
           to: target,
           promotion: promotion, // NOTE: always promote to a queen for example simplicity
           piece: draggedPiece.charAt(1).toLowerCase()
          }

  // if it's not our turn, then premove
  if ((game.turn() === 'w' && draggedPiece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && draggedPiece.search(/^w/) !== -1)) {
        if(source === target) return 'snapback' 

        premoves.push(m)
        return 'premove'
  }

  // make a move
  var move = game.move(m)
  // illegal move
  if (move === null) return 'snapback'

  // update turn
  turn = turn === 'w' ? 'b' : 'w'
  // update timers
  var elapsedTime = updateTimers()

  // send move to server
  server.emit('move', move, elapsedTime)

  updateStatus()
  // sanity check
  setTimeout(() => {console.log(game.ascii() + '\n')}, 200)
  setTimeout(() => {console.log(board.ascii() + '\n\n')}, 300)
}

function updateTimers() {
  if(turn === 'w') {
    white_timer.start()
    black_timer.stop()
    return black_timer.elapsedTime()
  } else {
    black_timer.start()
    white_timer.stop()
    return white_timer.elapsedTime()
  }
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
  if(premoves.length === 0) { //TODO: change this
    board.position(game.fen())
  }
}

function updateStatus () {
  var status = ''

  var moveColor = 'White'
  if (game.turn() === 'b') {
    moveColor = 'Black'
  }

  // checkmate?
  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.'
    gameIsOver('checkmate')
  }

  // draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position'
  }

  // game still on
  else {
    status = moveColor + ' to move'
    
    // check?
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check'
    }
  }
  
  $status.html(status)
  $fen.html(game.fen())
  $pgn.html(game.pgn())
}

function resetStatus() {
  $status.html('')
  $fen.html('')
  $pgn.html('')
}