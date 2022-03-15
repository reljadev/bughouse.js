var Stopwatch = function (elem, options) {

    var timer = createTimer(),
        offset,
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

    // append elements     
    elem.appendChild(timer);

    // initialize
    reset();

    // functions
    function createTimer() {
        return document.createElement("span");
    }

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
        render();
    }

    function reset() {
        clock = options.clock;
        render();
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
        render();
    }

    function render() {
        if(clock < 1000 * 60 && !showingFractions) {
            delete formatterOptions.minute
            formatterOptions.fractionalSecondDigits = 1
            formatter = new Intl.DateTimeFormat([], formatterOptions);
            showingFractions = true
        }
        timer.innerHTML = formatter.format(clock);
    }

    function delta() {
        var now = performance.now()
        d = now - offset;

        offset = now;
        return d;
    }

    function time(t) {
        if(t) {
            console.log('updating to ' + t)
            clock = t
            render()
        }
        return clock
    }

    function show() {
        elem.style.display = ''
    }

    function hide() {
        elem.style.display = 'none'
    }

    // public API
    this.start = start;
    this.stop = stop;
    this.elapsedTime = elapsedTime;
    this.add = add;
    this.reset = reset;
    this.time = time;
    this.show = show;
    this.hide = hide;
};