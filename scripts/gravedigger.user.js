// ==UserScript==
// @name        gravedigger
// @namespace   Zabuza
// @description Utility for doing gravedigging (taking drops from people dying to NPCs)
// @include     *.freewar.de/freewar/internal/frset.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
    var GRAVEDIGGER_TARGET_KEY = "gravedigger-target";
    var GRAVEDIGGER_TARGET_EXPIRATION_TIME = 5 * 60 * 1000;
    var GRAVEDIGGER_TARGET_COOKIE_MAX_AGE = 10 * 60;

    var GRAVEDIGGER_COORDINATE_TOOL_MARKERS = [
        "Lebende Wesen an der Oberfläche dieser Welt",
        "Lebende Wesen in deinem Umkreis von"
    ];

    var GRAVEDIGGER_COORDINATE_PATTERN =
        /X:\s*(-?\d+)\s*(?:\/\s*|\s+)Y:\s*(-?\d+)/;

    var GRAVEDIGGER_TARGET_NAVIGATION_KEY =
        "target-navigation-coordinate";
    var GRAVEDIGGER_TARGET_NAVIGATION_TIMESTAMP_KEY =
        "target-navigation-coordinate-timestamp";
    var GRAVEDIGGER_TARGET_NAVIGATION_TYPE_KEY =
        "target-navigation-coordinate-type";

    var GRAVEDIGGER_PATTERN =
        /wird an diesem Ort wiedergeboren, nachdem .+? durch das NPC .+ gestorben ist\./;

    var GRAVEDIGGER_MOVEMENT_PATTERN =
        /(verlässt den Ort|eilt) Richtung (Nordwesten|Norden|Nordosten|Westen|Osten|Südwesten|Süden|Südosten)/;

    var GRAVEDIGGER_DIRECTION_OFFSETS = {
        "Nordwesten": [-1, -1],
        "Norden": [0, -1],
        "Nordosten": [1, -1],
        "Westen": [-1, 0],
        "Osten": [1, 0],
        "Südwesten": [-1, 1],
        "Süden": [0, 1],
        "Südosten": [1, 1]
    };

    function saveGravediggerTarget(target) {
        var value = JSON.stringify(target);

        try {
            localStorage.setItem(
                GRAVEDIGGER_TARGET_KEY,
                value
            );

            return;
        } catch (e) {
            document.cookie =
                GRAVEDIGGER_TARGET_KEY + "=" +
                encodeURIComponent(value) +
                "; path=/; max-age=" +
                GRAVEDIGGER_TARGET_COOKIE_MAX_AGE;
        }
    }

    function getCookie(name) {
        var cookies = document.cookie.split(";");

        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i].trim();

            if (cookie.indexOf(name + "=") === 0) {
                return decodeURIComponent(
                    cookie.substring(name.length + 1)
                );
            }
        }

        return null;
    }

    function getGravediggerTarget() {
        var value = null;

        try {
            value = localStorage.getItem(
                GRAVEDIGGER_TARGET_KEY
            );
        } catch (e) {}

        if (!value) {
            value = getCookie(GRAVEDIGGER_TARGET_KEY);
        }

        if (!value) {
            return null;
        }

        var target;

        try {
            target = JSON.parse(value);
        } catch (e) {
            clearGravediggerTarget();
            return null;
        }

        if (
            !target.timestamp ||
            Date.now() - target.timestamp >
                GRAVEDIGGER_TARGET_EXPIRATION_TIME
        ) {
            clearGravediggerTarget();
            return null;
        }

        return target;
    }

    function clearGravediggerTarget() {
        try {
            localStorage.removeItem(
                GRAVEDIGGER_TARGET_KEY
            );
        } catch (e) {}

        document.cookie =
            GRAVEDIGGER_TARGET_KEY + "=; path=/; max-age=0";
    }

    function getCurrentPosition() {
        var frameElement = document.querySelector(
            "frame[name=\"mapFrame\"]"
        );

        if (!frameElement) {
            return null;
        }

        var frameDocument;

        try {
            frameDocument = frameElement.contentDocument;
        } catch (e) {
            return null;
        }

        if (!frameDocument) {
            return null;
        }

        var positionElement = frameDocument.querySelector(
            "p.positiontext"
        );

        if (!positionElement) {
            return null;
        }

        var match = positionElement.textContent.match(
            /Position X:\s*(-?\d+)\s+Y:\s*(-?\d+)/
        );

        if (!match) {
            return null;
        }

        return {
            x: parseInt(match[1], 10),
            y: parseInt(match[2], 10)
        };
    }

    function updateGravediggerTargetPosition(direction) {
        var target = getGravediggerTarget();

        if (!target || !target.username) {
            return false;
        }

        var offset = GRAVEDIGGER_DIRECTION_OFFSETS[direction];

        if (!offset) {
            return false;
        }

        var position = getCurrentPosition();

        if (!position) {
            return false;
        }

        target.x = position.x + offset[0];
        target.y = position.y + offset[1];

        saveGravediggerTarget(target);

        return true;
    }

    function saveNavigationTarget(x, y) {
        var value = x + "/" + y;
        var timestamp = Date.now();

        try {
            localStorage.setItem(
                GRAVEDIGGER_TARGET_NAVIGATION_KEY,
                value
            );

            localStorage.setItem(
                GRAVEDIGGER_TARGET_NAVIGATION_TIMESTAMP_KEY,
                String(timestamp)
            );

            localStorage.setItem(
                GRAVEDIGGER_TARGET_NAVIGATION_TYPE_KEY,
                "gravedigger"
            );

            return;
        } catch (e) {
            document.cookie =
                GRAVEDIGGER_TARGET_NAVIGATION_KEY + "=" +
                encodeURIComponent(value) +
                "; path=/; max-age=7200";

            document.cookie =
                GRAVEDIGGER_TARGET_NAVIGATION_TIMESTAMP_KEY + "=" +
                encodeURIComponent(timestamp) +
                "; path=/; max-age=7200";

            document.cookie =
                GRAVEDIGGER_TARGET_NAVIGATION_TYPE_KEY +
                "=gravedigger; path=/; max-age=7200";
        }
    }

    function scanItemFrame() {
        var target = getGravediggerTarget();

        if (!target || !target.username) {
            return;
        }

        var frameElement = document.querySelector(
            "frame[name=\"itemFrame\"]"
        );

        if (!frameElement) {
            return;
        }

        var frameDocument;

        try {
            frameDocument = frameElement.contentDocument;
        } catch (e) {
            return;
        }

        if (!frameDocument || !frameDocument.body) {
            return;
        }

        var bodyText = frameDocument.body.innerText;

        if (
            !bodyText ||
            !GRAVEDIGGER_COORDINATE_TOOL_MARKERS.some(function (marker) {
                return bodyText.includes(marker);
            })
        ) {
            return;
        }

        var walker = frameDocument.createTreeWalker(
            frameDocument.body,
            NodeFilter.SHOW_TEXT
        );

        var textNodes = [];
        var node;

        while ((node = walker.nextNode())) {
            if (node.nodeValue.indexOf(target.username) !== -1) {
                textNodes.push(node);
            }
        }

        for (var i = 0; i < textNodes.length; i++) {
            var textNode = textNodes[i];

            var lineStart = textNode;

            while (
                lineStart.parentNode &&
                lineStart.parentNode !== frameDocument.body
            ) {
                lineStart = lineStart.parentNode;
            }

            var lineText = "";
            var linePart = lineStart;

            while (
                linePart &&
                !(linePart.nodeType === 1 && linePart.tagName === "BR")
            ) {
                lineText += linePart.textContent || "";
                linePart = linePart.nextSibling;
            }

            var coordinateMatch =
                GRAVEDIGGER_COORDINATE_PATTERN.exec(lineText);

            if (!coordinateMatch) {
                continue;
            }

            var x = parseInt(coordinateMatch[1], 10);
            var y = parseInt(coordinateMatch[2], 10);

            saveNavigationTarget(x, y);

            return;
        }
    }

    var gravediggerAudioContext = null;

    function playGravediggerNotification() {
        try {
            var AudioContext =
                window.AudioContext || window.webkitAudioContext;

            if (!AudioContext) {
                return;
            }

            if (!gravediggerAudioContext) {
                gravediggerAudioContext = new AudioContext();
            }

            var audioContext = gravediggerAudioContext;

            function playNotification() {
                var now = audioContext.currentTime;

                function playTone(frequency, startTime, duration) {
                    var oscillator = audioContext.createOscillator();
                    var gain = audioContext.createGain();

                    oscillator.type = "sine";
                    oscillator.frequency.value = frequency;

                    gain.gain.setValueAtTime(0.0001, startTime);
                    gain.gain.exponentialRampToValueAtTime(
                        0.3,
                        startTime + 0.04
                    );
                    gain.gain.setValueAtTime(
                        0.3,
                        startTime + duration - 0.08
                    );
                    gain.gain.exponentialRampToValueAtTime(
                        0.0001,
                        startTime + duration
                    );

                    oscillator.connect(gain);
                    gain.connect(audioContext.destination);

                    oscillator.start(startTime);
                    oscillator.stop(startTime + duration);
                }

                playTone(880, now, 0.35);
                playTone(1175, now + 0.45, 0.45);
            }

            if (audioContext.state === "suspended") {
                audioContext.resume().then(function () {
                    playNotification();
                }).catch(function (error) {
                    console.error("Gravedigger audio resume failed:", error);
                });

                return;
            }

            playNotification();
        } catch (error) {
            console.error("Gravedigger audio failed:", error);
        }
    }

    document.addEventListener("gravedigger-test-sound", function () {
        playGravediggerNotification();
    });

    function makeGravediggerNpcClickable(message, npcElement) {
        if (npcElement.dataset.gravediggerClickable) {
            return;
        }

        npcElement.dataset.gravediggerClickable = "true";
        npcElement.style.cursor = "text";
        npcElement.style.userSelect = "text";
        npcElement.style.textDecoration = "underline";
        npcElement.title = "Doppelklicken, um NPC-Namen auszuwählen";

        npcElement.addEventListener("mousedown", function (event) {
            if (event.detail === 2) {
                event.preventDefault();
            }
        });

        npcElement.addEventListener("dblclick", function (event) {
            event.preventDefault();
            event.stopPropagation();

            var selection = npcElement.ownerDocument.defaultView.getSelection();
            var range = npcElement.ownerDocument.createRange();

            range.selectNodeContents(npcElement);
            selection.removeAllRanges();
            selection.addRange(range);
        });
    }

    function highlightDeathMessage(message) {
        if (message.classList.contains("gravedigger-message")) {
            return;
        }

        var boldElements = message.querySelectorAll("b");

        if (boldElements.length < 2) {
            return;
        }

        var username = boldElements[0].textContent.trim();
        var npcElement = boldElements[1];
        var npc = npcElement.textContent.trim();

        if (!username || !npc) {
            return;
        }

        message.style.backgroundColor =
            "rgba(255, 120, 120, 0.3)";
        message.style.fontSize = "1.7em";

        makeGravediggerNpcClickable(message, npcElement);

        var currentTarget = getGravediggerTarget();
        var isNewTarget =
            !currentTarget ||
            currentTarget.username !== username;

        message.classList.add("gravedigger-message");

        saveGravediggerTarget({
            username: username,
            npc: npc,
            timestamp: Date.now()
        });

        if (isNewTarget) {
            playGravediggerNotification();
        }
    }

    function highlightMovementMessage(message) {
        if (message.classList.contains("gravedigger-movement")) {
            return;
        }

        var movementMatch = message.textContent.match(
            GRAVEDIGGER_MOVEMENT_PATTERN
        );

        if (!movementMatch) {
            return;
        }

        var direction = movementMatch[2];
        var updated = updateGravediggerTargetPosition(direction);

        message.classList.add("gravedigger-movement");
        message.style.backgroundColor =
            "rgba(120, 180, 255, 0.3)";

        if (updated) {
            var updatedTarget = getGravediggerTarget();

            message.title =
                "Zielposition: " +
                updatedTarget.x + ", " + updatedTarget.y;
        }
    }

    function highlightMessages(frameDocument) {
        var messages = frameDocument.querySelectorAll("p");
        var target = getGravediggerTarget();
        var latestMovementMessage = null;

        for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            var text = message.textContent;

            if (GRAVEDIGGER_PATTERN.test(text)) {
                highlightDeathMessage(message);
                continue;
            }

            if (!target || !target.username) {
                continue;
            }

            var boldElement = message.querySelector("b");

            if (
                !boldElement ||
                boldElement.textContent.trim() !== target.username
            ) {
                continue;
            }

            if (GRAVEDIGGER_MOVEMENT_PATTERN.test(text)) {
                latestMovementMessage = message;
            }
        }

        if (latestMovementMessage) {
            highlightMovementMessage(latestMovementMessage);
        }
    }

    function addMapHighlightStyle(frameDocument) {
        if (frameDocument.querySelector("#gravedigger-map-style")) {
            return;
        }

        var style = frameDocument.createElement("style");
        style.id = "gravedigger-map-style";
        style.textContent = `
            .gravedigger-target-highlight {
                position: relative;
            }

            .gravedigger-target-highlight::after {
                content: "";
                position: absolute;
                inset: 0;
                background: rgba(72, 176, 255, 0.4);
                pointer-events: none;
            }
        `;

        frameDocument.head.appendChild(style);
    }

    function highlightMapTarget() {
        var target = getGravediggerTarget();

        var frameElement = document.querySelector(
            "frame[name=\"mapFrame\"]"
        );

        if (!frameElement) {
            return;
        }

        var frameDocument;

        try {
            frameDocument = frameElement.contentDocument;
        } catch (e) {
            return;
        }

        if (!frameDocument || !frameDocument.body) {
            return;
        }

        addMapHighlightStyle(frameDocument);

        var highlightedTiles = frameDocument.querySelectorAll(
            ".gravedigger-target-highlight"
        );

        for (var i = 0; i < highlightedTiles.length; i++) {
            highlightedTiles[i].classList.remove(
                "gravedigger-target-highlight"
            );
        }

        if (
            !target ||
            typeof target.x !== "number" ||
            typeof target.y !== "number"
        ) {
            return;
        }

        var tile = frameDocument.getElementById(
            "mapx" + target.x + "y" + target.y
        );

        if (tile) {
            tile.classList.add("gravedigger-target-highlight");
        }
    }

    function observeChatFrame() {
        var frameElement = document.querySelector(
            "frame[name=\"chattextFrame\"]"
        );

        if (!frameElement) {
            return;
        }

        var frameDocument;

        try {
            frameDocument = frameElement.contentDocument;
        } catch (e) {
            return;
        }

        if (!frameDocument || !frameDocument.body) {
            return;
        }

        if (frameDocument.body.dataset.gravediggerObserved) {
            return;
        }

        frameDocument.body.dataset.gravediggerObserved = "true";

        var observer = new MutationObserver(function () {
            highlightMessages(frameDocument);
        });

        observer.observe(frameDocument.body, {
            childList: true,
            subtree: true
        });

        highlightMessages(frameDocument);
    }

    getGravediggerTarget();

    observeChatFrame();
    scanItemFrame();
    highlightMapTarget();

    setInterval(function () {
        observeChatFrame();
        scanItemFrame();
        highlightMapTarget();
    }, 500);
})();
