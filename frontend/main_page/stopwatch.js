class Stopwatch {
    /***********************************************************/
    /*                    INITIALIZATION                       */
    /***********************************************************/

    #options;

    #$element;
    #timer;
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

        this.#options = options;
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
        this.#timer = this.#createTimer();     
        this.#$element.append(this.#timer);
    }

    #createTimer() {
        return $('<input type="text" class="clock_display" />');
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
        this.#timer.val(this.#formatter.format(this.#clock));
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
    }

    stop() {
        if (this.#interval) {
            clearInterval(this.#interval);
            this.#interval = null;
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
            this.#render();
        }
        return this.#clock;
    }

    show() {
        this.#$element.css('display', '');
    }

    hide() {
        this.#$element.css('display', 'none');
    }

    set_element_id(element_id) {
        this.#$element = $('#' + element_id);
        this.#render();
    }

};