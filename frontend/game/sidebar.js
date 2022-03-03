;(function () {

    function constructor (element) {
        var $sidebar = $('#' + element)
        var players = {}

        var widget = {}

        widget.addPlayer = function(username) {
            var $new_player = $('<div class="player">' + username + '</div>')
            players[username] = $new_player
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