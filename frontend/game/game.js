// retrieve data
// NOTE: data variable is included at renderization time (runtime)
let game_id = data.id
console.log(game_id) //TODO: this should be displayed on page
let admin = data.admin
let players = data.usernames
let fen = data.state.fen
let sparePieces = data.state.sparePieces

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
var sidebar = Sidebar('mySidebar', board.getOpponentUsername())

//////////////// socket io ///////////////////////

// connect to server
// NOTE: io is imported in game.ejs
const socket = io('localhost:3000', 
                  { query: "gameId=" + game_id + "&username=" + username})

// opponent moved
socket.on('move', (move) => { //TODO: this function shares code with onDrop
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
socket.on('joined', (username) => {
  sidebar.addPlayer(username)
})

// some player disconnected
// TODO: but what if he is playing??
socket.on('disconnected', (username) => {
  sidebar.removePlayer(username)
})

/////////////////////////////////////////////////

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
  socket.emit('move', move)

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