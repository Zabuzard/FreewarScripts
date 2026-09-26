// ==UserScript==
// @name        target_navigation_detection
// @namespace   Zabuza
// @description Detects target coordinates in Freewar and makes them clickable to activate navigation towards them
// @include     *.freewar.de/freewar/internal/frset.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
    var STORAGE_KEY = "target-navigation-coordinate";
    var STORAGE_TIMESTAMP_KEY = "target-navigation-coordinate-timestamp";
    var COOKIE_MAX_AGE = 2 * 60 * 60;

    var COORDINATE_PATTERN = /X:\s*(-?\d+)\s+Y:\s*(-?\d+)/g;

    var FRAME_NAMES = [
        "mainFrame",
        "chattextFrame",
        "itemFrame"
    ];

    function saveTarget(x, y) {
        var value = x + "/" + y;
        var timestamp = Date.now();

        try {
            localStorage.setItem(STORAGE_KEY, value);
            localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(timestamp));
            return;
        } catch (e) {
            document.cookie =
                STORAGE_KEY + "=" + encodeURIComponent(value) +
                "; path=/; max-age=" + COOKIE_MAX_AGE;

            document.cookie =
                STORAGE_TIMESTAMP_KEY + "=" + encodeURIComponent(timestamp) +
                "; path=/; max-age=" + COOKIE_MAX_AGE;
        }
    }

    function makeCoordinateClickable(match) {
        var element = document.createElement("span");

        element.className = "target-navigation-coordinate";
        element.textContent = match[0];
        element.style.cursor = "pointer";
        element.style.textDecoration = "underline";
        element.style.textDecorationStyle = "dotted";
        element.title = "Navigation zu " + match[1] + "/" + match[2];

        element.addEventListener("click", function () {
            saveTarget(
                parseInt(match[1], 10),
                parseInt(match[2], 10)
            );
        });

        return element;
    }

    function processTextNode(textNode) {
        var text = textNode.nodeValue;

        COORDINATE_PATTERN.lastIndex = 0;

        if (!COORDINATE_PATTERN.test(text)) {
            return;
        }

        COORDINATE_PATTERN.lastIndex = 0;

        var fragment = document.createDocumentFragment();
        var lastIndex = 0;
        var match;

        while ((match = COORDINATE_PATTERN.exec(text)) !== null) {
            if (match.index > lastIndex) {
                fragment.appendChild(
                    document.createTextNode(
                        text.substring(lastIndex, match.index)
                    )
                );
            }

            fragment.appendChild(
                makeCoordinateClickable(match)
            );

            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            fragment.appendChild(
                document.createTextNode(text.substring(lastIndex))
            );
        }

        textNode.parentNode.replaceChild(fragment, textNode);
    }

    function scanFrame(frameName) {
        var frameElement = document.querySelector(
            "frame[name=\"" + frameName + "\"]"
        );

        if (!frameElement) { return; }

        var frameDocument;

        try {
            frameDocument = frameElement.contentDocument;
        } catch (e) {
            return;
        }

        if (!frameDocument || !frameDocument.body) { return; }

        var walker = frameDocument.createTreeWalker(
            frameDocument.body,
            NodeFilter.SHOW_TEXT
        );

        var textNodes = [];
        var node;

        while ((node = walker.nextNode())) {
            var parent = node.parentNode;

            if (!parent) { continue; }

            if (
                parent.nodeName === "SCRIPT" ||
                parent.nodeName === "STYLE" ||
                parent.nodeName === "TEXTAREA" ||
                parent.nodeName === "INPUT" ||
                parent.nodeName === "BUTTON" ||
                parent.nodeName === "A" ||
                parent.classList.contains("target-navigation-coordinate")
            ) {
                continue;
            }

            textNodes.push(node);
        }

        for (var i = 0; i < textNodes.length; i++) {
            processTextNode(textNodes[i]);
        }
    }

    function scanFrames() {
        for (var i = 0; i < FRAME_NAMES.length; i++) {
            scanFrame(FRAME_NAMES[i]);
        }
    }

    scanFrames();

    setInterval(function () {
        scanFrames();
    }, 500);
})();
