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
let playing = data.playing
let fen = data.state.fen
let sparePieces = data.state.sparePieces
let start_fen = data.state.start_fen
let start_spares = data.state.start_spares
let pgn = data.state.pgn

//////////////// initialization ///////////////////////

//// chess ////
if(!playing) { //TODO: deepCopy IN COSTRUCTOR NOT HERE!!!
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
if(playing) {
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

let options = {
  timeZone: 'Europe/Belgrade',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  fractionalSecondDigits: 3,
},
formatter = new Intl.DateTimeFormat([], options);

var $clock = $('<span>00:00:00:000</span>')
$('body').append($clock)

function timeUpdater() {
  $clock.text(formatter.format(new Date()))
}

setInterval(timeUpdater, 100)

//// timers ////
var $white_timer = $('#white_timer')
var $black_timer = $('#black_timer')
if(!playing) {
  $white_timer.css('display', 'none')
  $black_timer.css('display', 'none')
} else {
  if(turn === 'w') {
    whiteTimer()
  } else {
    blackTimer()
  }
}

function whiteTimer() {
  // don't update time if white isn't playing currently
  if(!playing || turn !== 'w') return

  var t = updateTime(times.w_min, times.w_sec)
  times.w_min = t[0], times.w_sec = t[1]
  $white_timer.text('white timer: ' + times.w_min + ':' + times.w_sec + ':00')
  setTimeout(whiteTimer, 1000)
}

function blackTimer() {
  // don't update time if black isn't playing currently
  if(!playing || turn !== 'b') return

  var t = updateTime(times.b_min, times.b_sec)
  times.b_min = t[0], times.b_sec = t[1]
  $black_timer.text('black timer ' + times.b_min + ':' + times.b_sec + ':00')
  setTimeout(blackTimer, 1000)
}

function updateTime(min, sec) {
  sec -= 1
  if(sec < 0) {
    min -= 1
    sec = 59
    if(min < 0) {
      min = sec = 0
      console.log('times up')
      gameIsOver()
    }
  }
  return [min, sec]
}

//// buttons ////

// forward and backward buttons
var movesToDo = []
var newMoves = [] //TODO: this is really ugly

var $backward_button = $('#backward_button')
$backward_button.on('click', backward_move)
var $forward_button = $('#forward_button')
$forward_button.on('click', forward_move)
// hide buttons if not playing
if(!playing) {
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
  playing = true
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
  // show timers
  $white_timer.css('display', '')
  $black_timer.css('display', '')
  // start timer
  whiteTimer()
  // notify server of game started
  server.emit('game_has_started')
}

function backward_move(evt) {
  var move = game.undo()
  if(move !== null) {
    movesToDo.push(move)
    board.position(game.fen())
    // update spares
    if(move.from === 'offboard') {
      var color = move.color === 'w' ? 'white' : 'black'
      var piece = move.color + move.piece.toUpperCase()
      var spares = board.sparePieces()
      spares[color][piece] += 1
      board.sparePieces(spares)
    }
  }
  // sanity check
  setTimeout(() => {console.log(game.ascii() + '\n')}, 50)
  setTimeout(() => {console.log(board.ascii() + '\n\n')}, 300)
}

function forward_move(evt) {
  // get move
  var move = movesToDo.pop()
  if(typeof move === 'undefined') {
    move = newMoves.pop()
    if(typeof move === 'undefined') return
  }
  // make move
  game.move(move)
  if(move.from === 'offboard') {
    var moveStr = (move.color + move.piece.toUpperCase()) + '-' + move.to
  } else {
    var moveStr = move.from + '-' + move.to
  }
  board.move(moveStr)
  // sanity check
  setTimeout(() => {console.log(game.ascii() + '\n')}, 50)
  setTimeout(() => {console.log(board.ascii() + '\n\n')}, 300)
}

function resign_game(evt) {
  gameIsOver()
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

//measure time///
setTimeout(bla, 2000)

var time1 = null
function bla() {
  time1 = formatter.format(new Date())
  server.emit('request')
}

server.on('response', () => {
  var time2 = formatter.format(new Date())
  console.log('time1: ' + time1)
  console.log('time2: ' + time2)

})
/////////////////

// opponent moved
server.on('move', (move, serverTimes) => { //TODO: this function shares code with onDrop
  var m = null
  if(movesToDo.length === 0) {
    m = game.move(move)
    if(m !== null) {
      if(move.from === 'offboard') {
        var moveStr = (move.color + move.piece.toUpperCase()) + '-' + move.to
      } else {
        var moveStr = move.from + '-' + move.to
      }
      board.move(moveStr) //TODO: why can it work without this as well, but with delay??
      updateStatus()
    }
  } else {
    newMoves.push(move)
  }
  // update turn
  if(m !== null) {
    if(turn === 'w') {
      turn = 'b'
    } else {
      turn = 'w'
    }
  }
  // update times
  times = serverTimes
  // start timer
  if(turn === 'w') {
    whiteTimer()
  } else {
    blackTimer()
  }
  
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
  playing = true
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
  // show timers
  $white_timer.css('display', '')
  $black_timer.css('display', '')
  // start timer
  whiteTimer()
})

server.on('game_is_over', (message) => {
  if(playing) {
    // update playing status
    playing = false
    // show reset button
    if(myUsername === admin) {
      $reset_button.css('display', '')
    }
    // hide resign button
    $resign_button.css('display', 'none')
    // hide forward & backward buttons
    $backward_button.css('display', 'none')
    $forward_button.css('display', 'none')
    // hide timers
    $white_timer.css('display', 'none')
    $black_timer.css('display', 'none')
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
  return playing
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
  if(!playing) return false
  // do not pick up pieces if user is checking history
  if(movesToDo.length !== 0) return false

  // only pick up your pieces
  if((game.turn() === 'w' && white_player !== myUsername) ||
      (game.turn() === 'b' && black_player !== myUsername)) {
      return false
  }
  // only pick up pieces when it's your turn
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }
}

function onDrop (source, target, draggedPiece, newPosition, oldPosition, currentOrientation) {

  var promotion = source === 'offboard' ? false : 'q'
  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: promotion, // NOTE: always promote to a queen for example simplicity
    piece: draggedPiece.charAt(1).toLowerCase()
  })

  // illegal move
  if (move === null) return 'snapback'

  // send move to server
  server.emit('move', move)

  // update turn
  if(turn === 'w') {
    turn = 'b'
  } else {
    turn = 'w'
  }
  // start timer
  if(turn === 'w') {
    whiteTimer()
  } else {
    blackTimer()
  }

  updateStatus()
  // sanity check
  setTimeout(() => {console.log(game.ascii() + '\n')}, 200)
  setTimeout(() => {console.log(board.ascii() + '\n\n')}, 300)
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
  board.position(game.fen())
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
    gameIsOver()
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