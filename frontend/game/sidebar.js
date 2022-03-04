;(function () {

    const DRAG_THROTTLE_RATE = 20

    //TODO: this should def be changed! no passing updateUsername
    function constructor (element, updateUsername) {
        var $sidebar = $('#' + element)
        var players = {}

        ///////////////////// MOVING PLAYERS /////////////////////
        
        // create hidden element
        $('body').append('<div class="player" id="draggingPlayer" style="display: none;"></div>')
        var $draggedPlayer = $('#draggingPlayer')

        // add event listeners
        $sidebar.on('mousedown', '.player', mouseDown)

        // piece drag
        $(window).on('mousemove', mousemoveWindow) //TODO: can you even call two functions on mouse move?
                 .on('mouseup', mouseUp)

        var dragging = false
        function mouseDown(evt) {
            // hide player
            var $player = $(this)
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

        function mouseUp(evt) {
            if(dragging) {
                var username = $draggedPlayer.text()
                var $player = players[username]
                // hide dragged player
                $draggedPlayer.css('display', 'none')

                if(updateUsername(evt.pageX, evt.pageY, username)) {
                    $player.remove()
                } else {
                    $player.css('display', '')
                }
                dragging = false
            }
        }

        function mousemoveWindow(evt) {
            if (dragging) {
                $draggedPlayer.css({
                    left: evt.pageX,
                    top: evt.pageY
                  })
            }
        }

        // throttle mouse movement
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

        ///////////////////// PUBLIC API /////////////////////
        var widget = {}

        widget.addPlayer = function(username) {
            var $new_player = $('<div class="player">' + username + '</div>')
            players[username] = $new_player //TODO: keeping all of these references might be two expensive
            $sidebar.append($new_player)
        }

        widget.removePlayer = function(username) {
            var $player = players[username]
            if(typeof $player !== 'undefined') {
                $player.remove()
            }
        }

        return widget
    }

    window['Sidebar'] = constructor

})(); // end anonymous wrapper