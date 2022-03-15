var Stopwatch = function (options) {

    var offset,
        clock,
        interval,
        startTime;

    var showingFractions = false
    let formatterOptions = {
            minute: 'numeric',
            second: 'numeric',
        }
    let formatter = new Intl.DateTimeFormat([], formatterOptions);

    // default options
    options = options || {};
    options.clock = options.clock || 5 * 1000 * 60; // 5 minutes
    options.delay = options.delay || 1; // 1 ms

    // initialize
    reset();

    // functions
    function start() {
        if (!interval) {
            offset = performance.now()
            interval = setInterval(update, options.delay);
            startTime = clock;
        }
    }

    function stop() {
        if (interval) {
            clearInterval(interval);
            interval = null;
        }
    }

    function elapsedTime() {
        if(!interval && startTime) {
            return startTime - clock
        }
    }

    function add(t) {
        clock += t;
    }

    function reset() {
        clock = options.clock;
    }

    function update() {
        clock -= delta();
        if(clock <= 0) {
            clock = 0
            stop()
            if(typeof options.onTimesUp !== 'undefined') { 
                options.onTimesUp()
            }
        }
    }

    function delta() {
        var now = performance.now()
        d = now - offset;

        offset = now;
        return d;
    }

    function time(t) {
        if(t) {
            clock = t
        }
        return clock
    }

    // public API
    this.start = start;
    this.stop = stop;
    this.elapsedTime = elapsedTime;
    this.add = add;
    this.reset = reset;
    this.time = time;
};

if(module) module.exports = Stopwatch