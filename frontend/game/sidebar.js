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
        this.#options.$username_top.on('click', 
                                        (evt) => { this.#remove_player.call(this, 'top'); });
        this.#options.$username_bottom.on('click', 
                                        (evt) => { this.#remove_player.call(this, 'bottom'); });
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
            let player = this.#players[username];

            // hide dragged player
            this.#$draggedPlayer.css('display', 'none');

            if(this.#updateTopPlayer(evt.pageX, evt.pageY, username)) {
                player.get_element().remove();
                player.set_element(this.#options.$username_top);
                this.#options.player_added_to_board('top', username);
            } else if(this.#updateBottomPlayer(evt.pageX, evt.pageY, username)) {
                player.get_element().remove();
                player.set_element(this.#options.$username_bottom);
                this.#options.player_added_to_board('bottom', username);
            } else {
                player.get_element().css('display', '');
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

    #remove_player(position) {
        // TODO: x shouldn't even be present there
        // updates are not possible midgame
        // once this is handled, delete this function
        if(this.#options.is_playing()) {
            return;
        }

        let removed = this.remove_player_from_board(position);
        if(removed) {
            this.#options.player_removed_from_board(position);
        }
    }

    /***********************************************************/
    /*                       PUBLIC API                        */
    /***********************************************************/

    add_player(username, connected) {
        let $new_player = $('<div class="player">' + username + '</div>');
        if(username === this.#options.myUsername) {
            $new_player.css('background-color', 'black');
        }

        let p = this.#players[username];
        // player already exists, update it's element
        if(p) {
            if(p.is_connected()) {
                p.set_element($new_player);
                this.#$sidebar.append($new_player);
            } else {
                p.set_connected(true);
            }
        // create new player
        } else {
            this.#players[username] = new Sidebar.Player(username, connected, $new_player);
            this.#$sidebar.append($new_player);
        }
    }

    remove_player(username) {
        let p = this.#players[username];
        let $element = p.get_element();

        if($element) {
            // removing player at board
            if(p.get_username() === this.#options.$username_top.text() ||
                p.get_username() === this.#options.$username_bottom.text()) {
                    // while playing
                    if(this.#options.is_playing()) {
                        // not allowed, just gray him out
                        p.set_connected(false);
                        return;
                    }
                }

            $element.remove();
            delete this.#players[username];
        }
    }

    add_player_to_board(position, username) {
        let $username = position === 'top' ? this.#options.$username_top : 
                                             this.#options.$username_bottom;
        let p = this.#players[username];
        
        if(p) {
            let $player = p.get_element();
            if($player) {
                $username.text(username)
                $player.remove()
                p.set_element($username);
            }
        }
    }

    remove_player_from_board(position) {
        let $username = position === 'top' ? this.#options.$username_top : 
                                             this.#options.$username_bottom;
        let username = $username.text()
        if(username !== '') {
            let p = this.#players[username];
            if(p) {
                if(p.is_connected()) {
                    this.add_player(username, true)
                } else {
                    delete this.#players[username];
                }
                $username.text('')
                return true;
            }
        }

        return false;
    }

    swap_usernames_at_board() {
        let p_top = this.#players[this.#options.$username_top.text()]
        let p_bottom = this.#players[this.#options.$username_bottom.text()]

        if(p_top && p_bottom) {
            // swap usernames
            p_bottom.get_element().text(p_top.get_username())
            p_top.get_element().text(p_bottom.get_username())
            
            // swap element references
            p_top.set_element(this.#options.$username_bottom)
            p_bottom.set_element(this.#options.$username_top)
        }
    }

    clear_board_usernames() {
        this.remove_player_from_board('top')
        this.remove_player_from_board('bottom')
    }

}

Sidebar.Player = class Player {
    #username;
    #connected;
    #$element;

    constructor(username, connected, $element) {
        if(!username) {
            throw 'username argument needs to be specified in Player()';
        }
        this.#username = username;            

        if(!connected) {
            throw 'connected argument needs to be specified in Player()';
        }
        this.#connected = connected;

        this.#$element = $element ?? null;
    }

    get_username() {
        return this.#username;
    }

    is_connected() {
        return this.#connected;
    }

    set_connected(connected) {
        this.#connected = connected;
    }

    get_element() {
        return this.#$element;
    }

    set_element($element) {
        this.#$element = $element;
    }
}