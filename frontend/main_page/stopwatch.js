class Stopwatch {
    /***********************************************************/
    /*                    INITIALIZATION                       */
    /***********************************************************/

    #options;

    #$element;
    #$timer;
    #offset;
    #clock;
    #interval;
    #startTime;

    #showingFractions;
    #formatterOptions;
    #formatter;

    constructor(element_id, options) {
        this.#parse_arguments(element_id, options);
        this.#initialize_formatter();
        this.#initialize_timer();

        // initialize
        this.reset();
    }

    #parse_arguments(element_id, options) {
        this.#$element = $('#' + element_id);

        options = options ?? {};
        options.clock = options.clock ?? 5 * 1000 * 60; // 5 minutes
        options.delay = options.delay ?? 1; // 1 ms

        function clone(obj) {
            return JSON.parse(JSON.stringify(obj));
        }

        this.#options = clone(options);
    }

    #initialize_formatter() {
        this.#showingFractions = false;
        this.#formatterOptions = {
                minute: 'numeric',
                second: 'numeric',
            }
        this.#formatter = new Intl.DateTimeFormat([], this.#formatterOptions);
    }

    #initialize_timer() {
        this.#$timer = this.#createTimer();
        this.#$element.append(this.#$timer);
    }

    #createTimer() {
        return $('<input type="text" class="clock_display" readonly/>');
    }

    /***********************************************************/
    /*                    PRIVATE FUNCTIONS                    */
    /***********************************************************/

    #render() {
        if(this.#clock < 1000 * 60 && !this.#showingFractions) {
            delete this.#formatterOptions.minute;
            this.#formatterOptions.fractionalSecondDigits = 1;
            this.#formatter = new Intl.DateTimeFormat([], this.#formatterOptions);
            this.#showingFractions = true;
        }
        this.#$timer.val(this.#formatter.format(this.#clock));
    }

    #update() {
        this.#clock -= this.#delta();
        if(this.#clock <= 0) {
            this.#clock = 0;
            this.stop();
        }
        this.#render();
    }

    #delta() {
        let now = performance.now();
        let d = now - this.#offset;

        this.#offset = now;
        return d;
    }

    /***********************************************************/
    /*                       PUBLIC API                        */
    /***********************************************************/

    start() {
        if (!this.#interval) {
            this.#offset = performance.now();
            this.#interval = setInterval(this.#update.bind(this), this.#options.delay);
            this.#startTime = this.#clock;
        }
        if(!this.#$timer.hasClass('working')) {
            this.#$timer.addClass('working');
        }
    }

    stop() {
        if (this.#interval) {
            clearInterval(this.#interval);
            this.#interval = null;
        }
        if(this.#$timer.hasClass('working')) {
            this.#$timer.removeClass('working');
        }
    }

    elapsedTime() {
        if(!this.#interval && this.#startTime) {
            return this.#startTime - this.#clock;
        }
    }

    reset() {
        this.#clock = this.#options.clock;
        this.#render();
    }

    add(t) {
        this.#clock += t;
        this.#render();
    }

    time(t) {
        if(t) {
            this.#clock = t;
            if(t >= 1000 * 60) {
                delete this.#formatterOptions.fractionalSecondDigits;
                this.#formatterOptions.minute = 'numeric';
                this.#formatter = new Intl.DateTimeFormat([], this.#formatterOptions);
                this.#showingFractions = false;
            }
            this.#render();
        }
        return this.#clock;
    }

    get_displayed_value() {
        const time = this.#$timer.val();

        // check if format is correct
        const reg_min = /^([0-9][0-9]):([0-9][0-9])$/;
        const reg_sec = /^([0-9][0-9]).([0-9])$/;
        let found = time.match(reg_min);

        if(found) {
            return (parseInt(found[1], 10) * 60 + parseInt(found[2], 10)) * 1000;
        } else {
            found = time.match(reg_sec);
            if(found) {
                return parseInt(found[1], 10) * 1000 + parseInt(found[2], 10) * 100;
            } else {
                throw 'incorrect time format';
            }
        }
    }

    show() {
        this.#$element.css('display', '');
    }

    hide() {
        this.#$element.css('display', 'none');
    }

    editable(value) {
        this.#$timer.prop('readonly', !value);
    }

    set_element_id(element_id) {
        this.#$element = $('#' + element_id);

        this.#$timer.remove();
        this.#$timer = this.#createTimer();
        this.#$element.append(this.#$timer);

        this.#render();
    }

};