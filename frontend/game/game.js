// retrieve data
// NOTE: data variable is included at renderization time (runtime)
let game_id = data.id
console.log(game_id) //TODO: this should be displayed on page
let admin = data.admin
let players = data.usernames
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
  admin: admin,
}
var board = Chessboard('myBoard', config)

// initialize sidebar
var sidebar = Sidebar('mySidebar', admin, myUsername, board.getOpponentUsername(), 
                        opponentJoined, opponentRemoved)
sidebar.addPlayer(players)

// init admin page
if(myUsername === admin) {
  var $start_button = $('<button id="start_game">Start</button>')
  $('#main_page').append($start_button)
  $start_button.attr('disabled', 'disabled')
  $start_button.on('click', start_game)
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

// opponent added to chessboard
server.on('opponentJoined', (username) => {
  sidebar.addOpponent(username)
})

// removed opponent from chessboard
server.on('opponentRemoved', (username) => {
  sidebar.removeOpponent(username)
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

server.on('game_has_started', () => {
  console.log('game has started')
})

// some player disconnected
// TODO: but what if he is playing??
server.on('disconnected', (username) => {
  sidebar.removePlayer(username)
})

//////////////// sidebar functions ///////////////////////

function opponentJoined(username) {
  server.emit('opponentJoined', username)
}

function opponentRemoved(username) {
  server.emit('opponentRemoved', username)
}

//////////////// start the game ///////////////////////

function start_game(evt) {
  // hide start button
  $start_button.css('display', 'none')
  // disable updating opponent
  sidebar.disableUpdatingOpponent()
  // notify server of game started
  server.emit('game_has_started')
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

  // TODO: only pick up your pieces, when it's your turn to move
  // only pick up pieces for the side to move
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