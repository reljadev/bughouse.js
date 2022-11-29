const { deepCopy } = require("../utils/misc");

class Stopwatch {
    // declare private variables
    #offset;
    #clock;
    #interval;
    #start_time;
    #options;

    constructor(options) {
        // default options
        options = options ?? {};
        options.clock = options.clock ?? 5 * 1000 * 60; // 5 minutes
        options.delay = options.delay ?? 1; // 1 ms
        this.#options = deepCopy(options);

        // initialize
        this.reset();
    }

    #update() {
        this.#clock -= this.#delta();
        if(this.#clock <= 0) {
            this.#clock = 0;
            this.stop();
            if(typeof this.#options.onTimesUp !== 'undefined') { 
                this.#options.onTimesUp();
            }
        }
    }

    #delta() {
        let now = performance.now();
        let d = now - this.#offset;

        this.#offset = now;
        return d;
    }

    /////////////// PUBLIC API ///////////////

    start() {
        if (!this.#interval) {
            this.#offset = performance.now();
            this.#interval = setInterval(this.#update.bind(this), this.#options.delay);
            this.#start_time = this.#clock;
        }
    }

    stop() {
        if (this.#interval) {
            clearInterval(this.#interval);
            this.#interval = null;
        }
    }

    elapsed_time() {
        if(!this.#interval && this.#start_time) {
            return this.#start_time - this.#clock;
        }
    }

    add(t) {
        this.#clock += t;
    }

    reset() {
        this.#clock = this.#options.clock;
    }

    time(t) {
        if(t) {
            this.#clock = t;
        }
        return this.#clock;
    }

}

module.exports = Stopwatch;