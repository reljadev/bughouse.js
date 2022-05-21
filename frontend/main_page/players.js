class Players {
    /***********************************************************/
    /*                    INITIALIZATION                       */
    /***********************************************************/

    #$sidebar;
    #options;
    #players;
    #$draggedPlayer;
    #dragging;
    #$screen_dimer;

    constructor(options) {
        this.#parse_arguments(options);
        this.#initialize_sidebar();
        this.#initialize_username_texts();

        this.#players = {};

        if(this.#options.myUsername === this.#options.admin) {
            this.#initialize_players_controller();   
        }

        this.#$screen_dimer = $('<div class="screen_dimer" style="display: none"></div>');
        $('body').append(this.#$screen_dimer);

        this.#dragging = false;
    }

    #parse_arguments(options) {
        options = options ?? {};

        options.admin = options.admin ?? null;
        options.myUsername = options.myUsername ?? null;

        if(!options.$username_top1) {
            throw '$username_top1 must be specified as argument';
        }
        if(!options.$username_bottom1) {
            throw '$username_bottom1 must be specified as argument';
        }
        if(!options.$username_top2) {
            throw '$username_top2 must be specified as argument';
        }
        if(!options.$username_bottom2) {
            throw '$username_bottom2 must be specified as argument';
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

    #initialize_username_texts() {
        this.#options.$username_top1.append('<div class="user_text"></div>');
        this.#options.$username_bottom1.append('<div class="user_text"></div>');
        this.#options.$username_top2.append('<div class="user_text"></div>');
        this.#options.$username_bottom2.append('<div class="user_text"></div>');
    }
    
    #initialize_players_controller() {
        // create hidden element
        $('body').append('<div class="dragged_player" id="draggingPlayer" style="display: none;"></div>');
        this.#$draggedPlayer = $('#draggingPlayer');

        // add event listeners
        this.#$sidebar.on('mousedown', '.player', this.#mousedown.bind(this));

        // player drag
        $(window).on('mousemove', this.#mousemove_window.bind(this))
                 .on('mouseup', this.#mouse_up.bind(this));

        let $u_top1_x = $('<div class="username_x" style="display: none">x</div>');
        let $u_bottom1_x = $('<div class="username_x" style="display: none">x</div>');
        let $u_top2_x = $('<div class="username_x" style="display: none">x</div>');
        let $u_bottom2_x = $('<div class="username_x" style="display: none">x</div>');

        // remove player from board by clicking 'x'
        $u_top1_x.on('click',
                    (evt) => { this.#remove_player.call(this, 'first', 'top'); });
        $u_bottom1_x.on('click',
                    (evt) => { this.#remove_player.call(this, 'first', 'bottom'); });
        $u_top2_x.on('click',
                    (evt) => { this.#remove_player.call(this, 'second', 'top'); });
        $u_bottom2_x.on('click',
                    (evt) => { this.#remove_player.call(this, 'second', 'bottom'); });

        this.#options.$username_top1.append($u_top1_x);
        this.#options.$username_bottom1.append($u_bottom1_x);
        this.#options.$username_top2.append($u_top2_x);
        this.#options.$username_bottom2.append($u_bottom2_x);

        // toggle 'x' on mouse hovering over board username
        this.#options.$username_top1.mouseenter(onUsernameHover.bind(this))
                                    .mouseleave(offUsernameHover);
        this.#options.$username_bottom1.mouseenter(onUsernameHover.bind(this))
                                    .mouseleave(offUsernameHover);
        this.#options.$username_top2.mouseenter(onUsernameHover.bind(this))
                                    .mouseleave(offUsernameHover);
        this.#options.$username_bottom2.mouseenter(onUsernameHover.bind(this))
                                    .mouseleave(offUsernameHover);

        function onUsernameHover(evt) {
            let $user = $(evt.currentTarget);

            if(!this.#dragging && 
                !this.#options.is_playing() &&
                $user.find('.user_text').text() !== '') {
                    $user.find('.username_x').css('display', '');
            }

        }

        function offUsernameHover(evt) {
            $(evt.currentTarget).find('.username_x')
                                .css('display', 'none');
        }

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

        // player coordinates
        let left = $player.offset().left;
        let top = $player.offset().top;

        // hide player
        $player.css('display', 'none');

        // create draggable player
        this.#$draggedPlayer.text($player.text());
        this.#$draggedPlayer.css({
                display: '',
                position: 'absolute',
                left: left,
                top: top,
                });

        this.#$draggedPlayer.animate({width: '90px', height: '20px',
                                         top: evt.pageY - 10, left: evt.pageX - 45},
                                         100,
                                         () => { this.#dragging = true; })

        // dim the whole screen except username spots & dragged player
        this.#$screen_dimer.css('display', '');

    }

    #mousemove_window(evt) {
        // updates are not possible midgame
        if(this.#options.is_playing()) {
            return;
        }
        if (this.#dragging) {
            this.#$draggedPlayer.css({
                    left: evt.pageX - 45,
                    top: evt.pageY - 10,
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

            if(this.#updateFirstTopPlayer(evt.pageX, evt.pageY, username)) {
                player.get_element().remove();
                player.set_element(this.#options.$username_top1);
                this.#options.player_added_to_board('first', 'top', username);
            } else if(this.#updateFirstBottomPlayer(evt.pageX, evt.pageY, username)) {
                player.get_element().remove();
                player.set_element(this.#options.$username_bottom1);
                this.#options.player_added_to_board('first', 'bottom', username);
            } else if(this.#updateSecondTopPlayer(evt.pageX, evt.pageY, username)) {
                player.get_element().remove();
                player.set_element(this.#options.$username_top2);
                this.#options.player_added_to_board('second', 'top', username);
            } else if(this.#updateSecondBottomPlayer(evt.pageX, evt.pageY, username)) {
                player.get_element().remove();
                player.set_element(this.#options.$username_bottom2);
                this.#options.player_added_to_board('second', 'bottom', username);
            } else {
                player.get_element().css({display: '',
                                        width: '90px', height: '20px',
                                        'font-size': '14px'});
                player.get_element().animate({'width': '160px',
                                              'height': '22px',
                                              'font-size' : '17px'}, 300);
            }

            // undim screen
            this.#$screen_dimer.css('display', 'none');
            
            this.#dragging = false;
        }
    }

    /***********************************************************/
    /*                       CONTROLLERS                       */
    /***********************************************************/

    #updateFirstTopPlayer(x, y, username) {
        return this.#updatePlayer(this.#options.$username_top1, x, y, username);
    }

    #updateFirstBottomPlayer(x, y, username) {
        return this.#updatePlayer(this.#options.$username_bottom1, x, y, username);
    }

    #updateSecondTopPlayer(x, y, username) {
        return this.#updatePlayer(this.#options.$username_top2, x, y, username);
    }

    #updateSecondBottomPlayer(x, y, username) {
        return this.#updatePlayer(this.#options.$username_bottom2, x, y, username);
    }

    #updatePlayer($holder, x, y, username) {
        let user_left = $holder.offset().left;
        let user_width = $holder.width();
        let user_top = $holder.offset().top;

        if((x >= user_left && x <= user_left + user_width) && 
            y >= user_top && y <= user_top + 20) { //TODO: shouldn't be hardcoded
                let $user_text = $holder.find('.user_text');
                if($user_text.text() === '') {
                    $user_text.text(username);
                    $holder.css({'color': 'white',
                                'background-color': 'black',
                                'border': 'solid 1px white'});
                    return true;
                }
        }
        return false;
    }

    #remove_player(board, position) {
        let removed = this.remove_player_from_board(board, position);
        if(removed) {
            this.#options.player_removed_from_board(board, position);
        }
    }

    /***********************************************************/
    /*                       PUBLIC API                        */
    /***********************************************************/

    add_player(username, connected) {
        let $new_player = $('<div class="player">' + username + '</div>');
        $new_player.css({'width': '90px',
                        'height': '20px', 
                        'font-size' : '14px'});
        if(username === this.#options.myUsername) {
            $new_player.css('background-color', 'black');
        }

        let p = this.#players[username];
        // player already exists, update it's element
        if(p) {
            if(p.is_connected()) {
                p.set_element($new_player);
                this.#$sidebar.append($new_player);
                $new_player.animate({'width': '160px',
                                'height': '22px',
                                'font-size' : '17px'}, 300);
            } else {
                p.set_connected(true);
            }
        // create new player
        } else {
            this.#players[username] = new Players.Player(username, connected, $new_player);
            this.#$sidebar.append($new_player);
            $new_player.animate({'width': '160px',
                                'height': '22px',
                                'font-size' : '17px'}, 300);
        }
    }

    remove_player(username) {
        let p = this.#players[username];
        let $element = p.get_element();

        if($element) {
            // player at board
            if(p.get_username() === this.#options.$username_top1.find('.user_text').text() || //TODO: use white_player1 instead
                p.get_username() === this.#options.$username_bottom1.find('.user_text').text() ||
                p.get_username() === this.#options.$username_top2.find('.user_text').text() ||
                p.get_username() === this.#options.$username_bottom2.find('.user_text').text()) {
                    // while playing
                    if(this.#options.is_playing()) {
                        // not allowed, just gray him out
                        p.set_connected(false);
                    // not playing
                    } else {
                        // remove from board
                        $element.find('.user_text').text('');
                        $element.css({'color': 'black',
                                        'background-color': 'white',
                                        'border': 'none'});
                        // delete from players list
                        delete this.#players[username];
                    }
            // player is in sidebar
            } else {
                $element.remove();
                delete this.#players[username];
            }
        }
    }

    add_player_to_board(board, position, username) {
        let $username = null;
        if(board === 'first') {
            $username = position === 'top' ? this.#options.$username_top1 : 
                                             this.#options.$username_bottom1;
        } else {
            $username = position === 'top' ? this.#options.$username_top2 : 
                                             this.#options.$username_bottom2;
        }
        
        let p = this.#players[username];
        
        if(p) {
            let $player = p.get_element();
            if($player) {
                let $user_text = $username.find('.user_text');
                $user_text.text(username);
                $username.css({'color': 'white',
                                'background-color': 'black',
                                'border': 'solid 1px white'});
                $player.remove();
                p.set_element($username);
            }
        }
    }

    remove_player_from_board(board, position) {
        let $username = null;
        if(board === 'first') {
            $username = position === 'top' ? this.#options.$username_top1 : 
                                            this.#options.$username_bottom1;
        } else {
            $username = position === 'top' ? this.#options.$username_top2 : 
                                            this.#options.$username_bottom2;
        }
        
        let $user_text = $username.find('.user_text'); 
        let username = $user_text.text();

        if(username !== '') {
            let p = this.#players[username];
            if(p) {
                if(p.is_connected()) {
                    this.add_player(username, true);
                } else {
                    delete this.#players[username];
                }
                
                $user_text.text('');
                $username.css({'color': 'black',
                                'background-color': 'white',
                                'border': 'none'});
                return true;
            }
        }

        return false;
    }

    swap_usernames_at_board(board) {
        let u_top = board === 'first' ? 
                        this.#options.$username_top1.find('.user_text').text() :
                        this.#options.$username_top2.find('.user_text').text();
        let u_bottom = board === 'first' ? 
                        this.#options.$username_bottom1.find('.user_text').text() :
                        this.#options.$username_bottom2.find('.user_text').text();
        let p_top = this.#players[u_top];
        let p_bottom = this.#players[u_bottom];

        if(p_top && p_bottom) {
            // swap usernames
            p_bottom.get_element().find('.user_text').text(p_top.get_username())
            p_top.get_element().find('.user_text').text(p_bottom.get_username())
            
            // swap element references
            if(board === 'first') {
                p_top.set_element(this.#options.$username_bottom1)
                p_bottom.set_element(this.#options.$username_top1)
            } else {
                p_top.set_element(this.#options.$username_bottom2)
                p_bottom.set_element(this.#options.$username_top2)
            }
            
        }
    }

    clear_board_usernames() {
        this.remove_player_from_board('first', 'top')
        this.remove_player_from_board('first', 'bottom')
        this.remove_player_from_board('second', 'top')
        this.remove_player_from_board('second', 'bottom')
    }

}

Players.Player = class Player {
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