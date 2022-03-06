// retrieve data
// NOTE: data variable is included at renderization time (runtime)
let game_id = data.id
console.log(game_id) //TODO: this should be displayed on page
let admin = data.admin
let white_player = data.white_player
let black_player = data.black_player
let players = data.usernames
let playing = data.playing
let fen = data.state.fen
let sparePieces = data.state.sparePieces

//////////////// initialization ///////////////////////

// initialize chess
var game = new Chess(fen, deepCopy(sparePieces)) //TODO: won't this cause name conflict with chess and app?
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')

// initialize chessboard
var config = {
  draggable: true,
  position: fen,
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
  sparePieces: deepCopy(sparePieces),
}
var board = Chessboard('myBoard', config)

// initialize sidebar
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

// init admin page
if(myUsername === admin) {
  // start button
  var $start_button = $('<button id="start_game">Start</button>')
  $('#main_page').append($start_button)
  $start_button.attr('disabled', 'disabled')
  $start_button.on('click', start_game)
}

function start_game(evt) {
  // update playing status
  playing = true
  // hide start button
  $start_button.css('display', 'none')
  // notify server of game started
  server.emit('game_has_started')
}

//////////////// socket io ///////////////////////

// connect to server
// NOTE: io is imported in game.ejs
const server = io('localhost:3000', 
                  { query: "gameId=" + game_id + "&username=" + myUsername})

// opponent moved
server.on('move', (move) => { //TODO: this function shares code with onDrop
  game.move(move)
  if(move.from === 'offboard') {
    var moveStr = (move.color + move.piece.toUpperCase()) + '-' + move.to
  } else {
    var moveStr = move.from + '-' + move.to
  }
  board.move(moveStr) //TODO: why can it work without this as well, but with delay??
  updateStatus()
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
  playing = true
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

// sidebar uses to know whether game can be updated
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

updateStatus()