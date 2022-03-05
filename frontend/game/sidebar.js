;(function () {

    //TODO: this should def be changed! no passing updateUsername
    function constructor (element, admin, myUsername, $username_top, opponentJoined, opponentRemoved) {

        ///////////////////// INITIALIZATION /////////////////////

        var $sidebar = $('#' + element)
        var players = {}
        addPlayer(myUsername)

        ///////////////////// MOVING PLAYERS /////////////////////
        
        // create hidden element
        $('body').append('<div class="player" id="draggingPlayer" style="display: none;"></div>')
        var $draggedPlayer = $('#draggingPlayer')

        // add event listeners
        $sidebar.on('mousedown', '.player', mouseDown)

        // piece drag
        $(window).on('mousemove', mousemoveWindow) //TODO: can you even call two functions on mouse move?
                 .on('mouseup', mouseUp)

        $username_top.on('click', removeOpponent)

        var can_update_opponent = true
        var dragging = false
        function mouseDown(evt) {
            // only admin can place opponents while game hasn't started
            if(myUsername !== admin && can_update_opponent) {
                return
            }
            
            var $player = $(this)
            // you can't manipulate admin
            if($player.text() === admin) {
                return
            }
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
            // only admin can place opponents while game hasn't started
            if(myUsername !== admin && can_update_opponent) {
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
            // only admin can place opponents while game hasn't started
            if(myUsername !== admin && can_update_opponent) {
                return
            }
            if(dragging) {
                var username = $draggedPlayer.text()
                var $player = players[username]
                // hide dragged player
                $draggedPlayer.css('display', 'none')

                if(updateOpponent(evt.pageX, evt.pageY, username)) {
                    $player.remove()
                    opponentJoined(username)
                } else {
                    $player.css('display', '')
                }
                dragging = false
            }
        }

        function updateOpponent(x, y, username) {
            var user_left = $username_top.offset().left
            var user_width = $username_top.width()
            var user_top = $username_top.offset().top
      
            if((x >= user_left && x <= user_left + user_width) && 
                y <= user_top && y >= user_top - 40) { //TODO: shouldn't be hardcoded
                    if($username_top.text() === '') {
                        $username_top.text(username)
                        return true
                    }
            }
            return false
        }

        function removeOpponent(evt) {
            // TODO: x shouldn't even be present there
            // only admin can remove opponents while game hasn't started
            if(myUsername !== admin || !can_update_opponent) {
                return
            }
            var username = $username_top.text()
            if(username !== '') {
                addPlayer(username)
                $username_top.text('')
                opponentRemoved(username)
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

        widget.addOpponent = function(username) {
            var $player = players[username]
            if(typeof $player !== 'undefined') {
                $username_top.text(username)
                $player.remove()
            }
        }

        widget.removeOpponent = function(username) {
            if(username !== '') {
                addPlayer(username)
                $username_top.text('')
            }
        }

        widget.disableUpdatingOpponent = function() {
            can_update_opponent = false
        }

        return widget
    }

    window['Sidebar'] = constructor

})(); // end anonymous wrapper