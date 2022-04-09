class Sidebar {
    /***********************************************************/
    /*                    INITIALIZATION                       */
    /***********************************************************/

    #$sidebar;
    #options;
    #players;
    #$draggedPlayer;
    #dragging;

    constructor(options) {
        this.#parse_arguments(options);
        this.#initialize_sidebar();

        this.#players = {};

        if(this.#options.myUsername === this.#options.admin) {
            this.#initialize_players_controller();   
        }

        this.#dragging = false;
    }

    #parse_arguments(options) {
        options = options ?? {};

        options.admin = options.admin ?? null;
        options.myUsername = options.myUsername ?? null;

        if(!options.$username_top) {
            throw '$username_top must be specified as argument';
        }
        if(!options.$username_bottom) {
            throw '$username_bottom must be specified as argument';
        }

        options.player_added_to_board = options.player_added_to_board ?? function() {};
        options.player_removed_from_board = options.player_removed_from_board ?? function() {};

        options.is_playing = options.is_playing ?? function() {};

        this.#options = options;
    }

    #initialize_sidebar() {
        this.#$sidebar = $('#' + this.#options.element);
        if(this.#$sidebar.length !== 1) {
            throw 'element argument to Sidebar() must be the ID of a DOM node';
        }
    }
    
    #initialize_players_controller() {
        // create hidden element
        $('body').append('<div class="player" id="draggingPlayer" style="display: none;"></div>');
        this.#$draggedPlayer = $('#draggingPlayer');

        // add event listeners
        this.#$sidebar.on('mousedown', '.player', this.#mousedown.bind(this));

        // player drag
        $(window).on('mousemove', this.#mousemove_window.bind(this))
                 .on('mouseup', this.#mouse_up.bind(this));

        // remove opponent by clicking x
        this.#options.$username_top.on('click', this.#removeTopPlayer.bind(this));
        this.#options.$username_bottom.on('click', this.#removeBottomPlayer.bind(this));
    }

    /***********************************************************/
    /*                     EVENT HANDLERS                      */
    /***********************************************************/
   
    #mousedown(evt) {
        // updates are not possible midgame
        if(this.#options.is_playing()) {
            return;
        }
        
        let $player = $(evt.currentTarget);
        // hide player
        $player.css('display', 'none');

        // create draggable player
        this.#$draggedPlayer.text($player.text());
        this.#$draggedPlayer.css({
                display: '',
                position: 'absolute',
                left: evt.pageX,
                top: evt.pageY
                });

        // update dragging state
        this.#dragging = true;
    }

    #mousemove_window(evt) {
        // updates are not possible midgame
        if(this.#options.is_playing()) {
            return;
        }
        if (this.#dragging) {
            this.#$draggedPlayer.css({
                    left: evt.pageX,
                    top: evt.pageY
                    });
        }
    }

    #mouse_up(evt) {
        // updates are not possible midgame
        if(this.#options.is_playing()) { 
            return;
        }
        if(this.#dragging) {
            let username = this.#$draggedPlayer.text();
            let $player = this.#players[username];
            // hide dragged player
            this.#$draggedPlayer.css('display', 'none');

            if(this.#updateTopPlayer(evt.pageX, evt.pageY, username)) {
                $player.remove();
                this.#options.player_added_to_board('top', username);
            } else if(this.#updateBottomPlayer(evt.pageX, evt.pageY, username)) {
                $player.remove();
                this.#options.player_added_to_board('bottom', username);
            } else {
                $player.css('display', '');
            }
            this.#dragging = false;
        }
    }

    /***********************************************************/
    /*                       CONTROLLERS                       */
    /***********************************************************/

    #updateTopPlayer(x, y, username) {
        return this.#updatePlayer(this.#options.$username_top, x, y, username);
    }

    #updateBottomPlayer(x, y, username) {
        return this.#updatePlayer(this.#options.$username_bottom, x, y, username);
    }

    #updatePlayer($player, x, y, username) {
        let user_left = $player.offset().left;
        let user_width = $player.width();
        let user_top = $player.offset().top;
    
        if((x >= user_left && x <= user_left + user_width) && 
            y <= user_top && y >= user_top - 40) { //TODO: shouldn't be hardcoded
                if($player.text() === '') {
                    $player.text(username);
                    return true;
                }
        }
        return false;
    }

    #removeTopPlayer(evt) {
        this.#remove_player(this.#options.$username_top, 'top');
    } 

    #removeBottomPlayer(evt) {
        this.#remove_player(this.#options.$username_bottom, 'bottom');
    }

    #remove_player($username, position) {
        // TODO: x shouldn't even be present there
        // updates are not possible midgame
        if(this.#options.is_playing()) {
            return;
        }

        let username = $username.text();
        if(username !== '') {
            this.#add_player(username);
            $username.text('');
            this.#options.player_removed_from_board(position);
        }
    }

    #add_player(username) {
        let $new_player = $('<div class="player">' + username + '</div>');
        if(username === this.#options.myUsername) {
            $new_player.css('background-color', 'black');
        }
        this.#players[username] = $new_player;
        this.#$sidebar.append($new_player);
    }

    /***********************************************************/
    /*                       PUBLIC API                        */
    /***********************************************************/

    add_player(arg) {
        if(Array.isArray(arg)) {
            for(let i in arg) {
                this.#add_player(arg[i]);
            }
        } else {
            this.#add_player(arg);
        }
    }

    remove_player(username) {
        let $player = this.#players[username];
        if(typeof $player !== 'undefined') {
            $player.remove();
        }
    }

    add_player_to_board(position, username) {
        let $username = position === 'top' ? this.#options.$username_top : 
                                             this.#options.$username_bottom;
        let $player = this.#players[username];
        if(typeof $player !== 'undefined') {
            $username.text(username)
            $player.remove()
        }
    }

    remove_player_from_board(position) {
        let $username = position === 'top' ? this.#options.$username_top : 
                                             this.#options.$username_bottom;
        let username = $username.text()
        if(username !== '') {
            this.#add_player(username)
            $username.text('')
        }
    }

    swap_usernames_at_board() {
        let tmp = this.#options.$username_bottom.text()
        this.#options.$username_bottom.text(this.#options.$username_top.text())
        this.#options.$username_top.text(tmp)
    }

    clear_board_usernames() {
        this.remove_player_from_board('top')
        this.remove_player_from_board('bottom')
    }

}