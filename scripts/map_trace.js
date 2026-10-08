// ==UserScript==
// @name        map_trace
// @namespace   Zabuza
// @description Leaves a fading trace on the map to mark tiles that were recently visited
// @include     *.freewar.de/freewar/internal/map.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
    var STORAGE_KEY = "map_trace";
    var ENABLED_STORAGE_KEY = "map_trace_enabled";
    var MAX_TILES = 30;
    var MAX_AGE = 5 * 60 * 1000;
    var CHECK_INTERVAL = 500;
    var TRACE_OPACITY = 0.5;
    var traceEnabled = loadTraceEnabled();

    function loadTrace() {
        var data;
        try {
            data = localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            data = null;
        }
        if (!data) {
            var match = document.cookie.match(new RegExp("(?:^|; )" + STORAGE_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
            data = match ? decodeURIComponent(match[1]) : null;
        }
        if (!data) { return []; }

        try {
            data = JSON.parse(data);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }

    function saveTrace(trace) {
        var data = JSON.stringify(trace);
        try {
            localStorage.setItem(STORAGE_KEY, data);
            return;
        } catch (e) {}
        document.cookie = STORAGE_KEY + "=" + encodeURIComponent(data) + "; path=/";
    }

    function loadTraceEnabled() {
        var data;
        try {
            data = localStorage.getItem(ENABLED_STORAGE_KEY);
        } catch (e) {
            data = null;
        }
        if (data === null) {
            var match = document.cookie.match(new RegExp("(?:^|; )" + ENABLED_STORAGE_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
            data = match ? decodeURIComponent(match[1]) : null;
        }
        if (data === null) { return true; }

        return data === "true";
    }

    function saveTraceEnabled() {
        var data = traceEnabled ? "true" : "false";
        try {
            localStorage.setItem(ENABLED_STORAGE_KEY, data);
            return;
        } catch (e) {}
        document.cookie = ENABLED_STORAGE_KEY + "=" + data + "; path=/";
    }

    function getCurrentPosition() {
        var user = document.querySelector("svg.mapstate path.user");
        if (!user) { return null; }

        var tile = user.closest("td[id^='mapx']");
        if (!tile) { return null; }

        var match = tile.id.match(/^mapx(-?\d+)y(-?\d+)$/);
        if (!match) { return null; }

        return {
            x: parseInt(match[1], 10),
            y: parseInt(match[2], 10)
        };
    }

    function cleanupTrace(trace, now) {
        trace = trace.filter(function (entry) {
            return now - entry.timestamp <= MAX_AGE;
        });

        while (trace.length > MAX_TILES) {
            trace.shift();
        }

        return trace;
    }

    function updateTileOpacity(trace, position) {
        var tiles = document.querySelectorAll("td[id^='mapx']");

        tiles.forEach(function (tile) {
            var match = tile.id.match(/^mapx(-?\d+)y(-?\d+)$/);
            if (!match) { return; }

            var x = parseInt(match[1], 10);
            var y = parseInt(match[2], 10);

            if (position && x === position.x && y === position.y) {
                if (tile.style.opacity === String(TRACE_OPACITY)) {
                    tile.style.opacity = "";
                }
                return;
            }

            var traced = trace.some(function (entry) {
                return entry.x === x && entry.y === y;
            });

            if (traceEnabled && traced) {
                if (tile.style.opacity !== String(TRACE_OPACITY)) {
                    tile.style.opacity = TRACE_OPACITY;
                }
            } else if (tile.style.opacity === String(TRACE_OPACITY)) {
                tile.style.opacity = "";
            }
        });
    }

    function updateTrace() {
        var now = Date.now();
        var trace = cleanupTrace(loadTrace(), now);
        var position = getCurrentPosition();

        if (position) {
            var last = trace.length > 0 ? trace[trace.length - 1] : null;

            if (!last || last.x !== position.x || last.y !== position.y) {
                trace.push({
                    x: position.x,
                    y: position.y,
                    timestamp: now
                });

                trace = cleanupTrace(trace, now);
            }
        }

        saveTrace(trace);
        updateTileOpacity(trace, position);
    }

    function createTraceToggle() {
        var positionText = document.querySelector(".positiontext");
        if (!positionText) { return; }

        var reloadLink = positionText.querySelector("a");
        if (!reloadLink) { return; }

        if (document.getElementById("map-trace-toggle")) {
            return;
        }

        var toggle = document.createElement("span");
        toggle.id = "map-trace-toggle";
        toggle.textContent = "⊙";
        toggle.style.display = "inline-block";
        toggle.style.width = "14px";
        toggle.style.height = "14px";
        toggle.style.lineHeight = "14px";
        toggle.style.textAlign = "center";
        toggle.style.cursor = "pointer";
        toggle.style.marginRight = "1px";
        toggle.style.verticalAlign = "middle";

        function updateToggle() {
            toggle.title = traceEnabled ? "Laufspur ausblenden und löschen" : "Laufspur anzeigen";
            toggle.style.color = traceEnabled ? "#7e66a1" : "#777777";
        }

        toggle.addEventListener("click", function () {
            traceEnabled = !traceEnabled;
            saveTraceEnabled();

            if (!traceEnabled) {
                saveTrace([]);
            }

            updateToggle();
            updateTrace();
        });

        updateToggle();
        positionText.insertBefore(toggle, reloadLink);
    }

    createTraceToggle();
    updateTrace();
    setInterval(updateTrace, CHECK_INTERVAL);

    var observer = new MutationObserver(function () { updateTrace(); });
    observer.observe(document.body, { childList: true, subtree: true });
})();
