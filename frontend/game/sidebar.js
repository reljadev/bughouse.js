;(function () {

    //TODO: this should def be changed! no passing updateUsername
    function constructor (element,
                            admin, myUsername,
                            $username_top, $username_bottom,
                            playerJoined, playerRemoved,
                            isPlaying) {

        ///////////////////// INITIALIZATION /////////////////////

        var $sidebar = $('#' + element)
        var players = {}

        ///////////////////// MOVING PLAYERS /////////////////////
        
        if(myUsername === admin) {
            // create hidden element
            $('body').append('<div class="player" id="draggingPlayer" style="display: none;"></div>')
            var $draggedPlayer = $('#draggingPlayer')

            // add event listeners
            $sidebar.on('mousedown', '.player', mouseDown)

            // player drag
            $(window).on('mousemove', mousemoveWindow) //TODO: can you even call two functions on mouse move?
                    .on('mouseup', mouseUp)

            // remove opponent by clicking x
            $username_top.on('click', removeTopPlayer)
            $username_bottom.on('click', removeBottomPlayer)
        }

        var dragging = false
        function mouseDown(evt) {
            // updates are not possible midgame
            if(isPlaying()) {
                return
            }
            
            var $player = $(this)
            // hide player
            $player.css('display', 'none')

            // create draggable player
            $draggedPlayer.text($player.text())
            $draggedPlayer.css({
                display: '',
                position: 'absolute',
                left: evt.pageX,
                top: evt.pageY
              })

            // update dragging state
            dragging = true
        }

        function mousemoveWindow(evt) {
            // updates are not possible midgame
            if(isPlaying()) {
                return
            }
            if (dragging) {
                $draggedPlayer.css({
                    left: evt.pageX,
                    top: evt.pageY
                  })
            }
        }

        function mouseUp(evt) {
            // updates are not possible midgame
            if(isPlaying()) { 
                return
            }
            if(dragging) {
                var username = $draggedPlayer.text()
                var $player = players[username]
                // hide dragged player
                $draggedPlayer.css('display', 'none')

                if(updateTopPlayer(evt.pageX, evt.pageY, username)) {
                    $player.remove()
                    playerJoined('top', username)
                } else if(updateBottomPlayer(evt.pageX, evt.pageY, username)) {
                    $player.remove()
                    playerJoined('bottom', username)
                } else {
                    $player.css('display', '')
                }
                dragging = false
            }
        }

        function updateTopPlayer(x, y, username) {
            return updatePlayer($username_top, x, y, username)
        }

        function updateBottomPlayer(x, y, username) {
            return updatePlayer($username_bottom, x, y, username)
        }

        function updatePlayer($player, x, y, username) {
            var user_left = $player.offset().left
            var user_width = $player.width()
            var user_top = $player.offset().top
      
            if((x >= user_left && x <= user_left + user_width) && 
                y <= user_top && y >= user_top - 40) { //TODO: shouldn't be hardcoded
                    if($player.text() === '') {
                        $player.text(username)
                        return true
                    }
            }
            return false
        }

        function removeTopPlayer(evt) {
            removePlayer($username_top, 'top', playerRemoved)
        } 

        function removeBottomPlayer(evt) {
            removePlayer($username_bottom, 'bottom', playerRemoved)
        }

        function removePlayer($username, position, playerRemoved) {
            // TODO: x shouldn't even be present there
            // updates are not possible midgame
            if(isPlaying()) {
                return
            }

            var username = $username.text()
            if(username !== '') {
                addPlayer(username)
                $username.text('')
                playerRemoved(position)
            }
        }

        // throttle mouse movement
        // const DRAG_THROTTLE_RATE = 20
        // var throttledMousemoveWindow = throttle(mousemoveWindow, DRAG_THROTTLE_RATE)

        // function throttle (f, interval, scope) {
        //     console.log('throttle')
        //     var timeout = 0
        //     var shouldFire = false
        //     var args = []
        
        //     var handleTimeout = function () {
        //         console.log('handleTimeout')
        //         timeout = 0
        //         if (shouldFire) {
        //             shouldFire = false
        //             fire()
        //         }
        //     }
        
        //     var fire = function () {
        //         console.log('fire')
        //         timeout = window.setTimeout(handleTimeout, interval)
        //         f.apply(scope, args)
        //     }
        
        //     return function (_args) {
        //       args = arguments
        //       if (!timeout) {
        //         fire()
        //       } else {
        //         shouldFire = true
        //       }
        //     }
        // }

        ///////////////////// MISC UTIL /////////////////////
        function addPlayer(username) {
            var $new_player = $('<div class="player">' + username + '</div>')
            if(username === myUsername) {
                $new_player.css('background-color', 'black')
            }
            players[username] = $new_player //TODO: keeping all of these references might be two expensive
            $sidebar.append($new_player)
        }

        ///////////////////// PUBLIC API /////////////////////
        var widget = {}

        widget.addPlayer = function(arg) {
            if(Array.isArray(arg)) {
                for(var i in arg) {
                  addPlayer(arg[i])
                }
              } else {
                addPlayer(arg)
              }
        }

        widget.removePlayer = function(username) {
            var $player = players[username]
            if(typeof $player !== 'undefined') {
                $player.remove()
            }
        }

        widget.addPlayerToBoard = function(position, username) {
            var $username = position === 'top' ? $username_top : $username_bottom
            var $player = players[username]
            if(typeof $player !== 'undefined') {
                $username.text(username)
                $player.remove()
            }
        }

        widget.removePlayerFromBoard = function(position) {
            var $username = position === 'top' ? $username_top : $username_bottom
            var username = $username.text()
            if(username !== '') {
                addPlayer(username)
                $username.text('')
            }
        }

        return widget
    }

    window['Sidebar'] = constructor

})(); // end anonymous wrapper