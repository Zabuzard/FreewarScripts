// ==UserScript==
// @name        tissue_target_navigation
// @namespace   Zabuza
// @description Detects tissue hunt targets and activates navigation towards them whenever it sees their coordinates (e.g. in Schriftrolle der Lebenden)
// @include     *.freewar.de/freewar/internal/frset.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
    var STORAGE_KEY = "current-tissue-target";
    var STORAGE_TIMESTAMP_KEY = "current-tissue-target-timestamp";
    var COOKIE_MAX_AGE = 15 * 60;
    var TARGET_EXPIRATION_TIME = 15 * 60 * 1000;

    var FRAME_NAMES = [
        "mainFrame",
        "itemFrame"
    ];

    var COORDINATE_TOOL_MARKERS = [
        "Lebende Wesen an der Oberfläche dieser Welt",
        "Lebende Wesen in deinem Umkreis von"
    ];

    var TISSUE_TARGET_PATTERN =
        /Derzeit suchen die Forscher dringend eine Gewebeprobe von\s*/;

    var COORDINATE_PATTERN =
        /X:\s*(-?\d+)\s*(?:\/\s*|\s+)Y:\s*(-?\d+)/;

    function saveTissueTarget(name) {
        var timestamp = Date.now();

        try {
            localStorage.setItem(STORAGE_KEY, name);
            localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(timestamp));
            return;
        } catch (e) {
            document.cookie =
                STORAGE_KEY + "=" + encodeURIComponent(name) +
                "; path=/; max-age=" + COOKIE_MAX_AGE;

            document.cookie =
                STORAGE_TIMESTAMP_KEY + "=" + encodeURIComponent(timestamp) +
                "; path=/; max-age=" + COOKIE_MAX_AGE;
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

    function getStoredValue(key) {
        try {
            var value = localStorage.getItem(key);

            if (value !== null) {
                return value;
            }
        } catch (e) {}

        return getCookie(key);
    }

    function getTissueTarget() {
        var name = getStoredValue(STORAGE_KEY);
        var timestamp = parseInt(
            getStoredValue(STORAGE_TIMESTAMP_KEY),
            10
        );

        if (!name || !timestamp) {
            return null;
        }

        if (Date.now() - timestamp > TARGET_EXPIRATION_TIME) {
            clearTissueTarget();
            return null;
        }

        return name;
    }

    function clearTissueTarget() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
        } catch (e) {}

        document.cookie =
            STORAGE_KEY + "=; path=/; max-age=0";

        document.cookie =
            STORAGE_TIMESTAMP_KEY + "=; path=/; max-age=0";
    }

    function saveNavigationTarget(x, y) {
        var value = x + "/" + y;
        var timestamp = Date.now();

        try {
            localStorage.setItem(
                "target-navigation-coordinate",
                value
            );
            localStorage.setItem(
                "target-navigation-coordinate-timestamp",
                String(timestamp)
            );
            localStorage.setItem(
                "target-navigation-coordinate-type",
                "tissue"
            );
            return;
        } catch (e) {
            document.cookie =
                "target-navigation-coordinate=" +
                encodeURIComponent(value) +
                "; path=/; max-age=7200";

            document.cookie =
                "target-navigation-coordinate-timestamp=" +
                encodeURIComponent(timestamp) +
                "; path=/; max-age=7200";

            document.cookie =
                "target-navigation-coordinate-type=tissue" +
                "; path=/; max-age=7200";
        }
    }

    function makeTissueTargetClickable(element, name) {
        element.classList.add("tissue-target-navigation");
        element.style.cursor = "pointer";
        element.style.textDecoration = "underline";
        element.style.textDecorationStyle = "dotted";
        element.style.fontSize = "2em";
        element.style.color = "rgb(136, 206, 127)";
        element.title = "Gewebejagd-Ziel speichern: " + name;

        element.addEventListener("click", function () {
            saveTissueTarget(name);
        });
    }

    function ensureBlinkStyle(frameDocument) {
        var styleId = "tissue-target-navigation-animation";

        if (frameDocument.getElementById(styleId)) {
            return;
        }

        var style = frameDocument.createElement("style");
        style.id = styleId;
        style.textContent =
            "@keyframes tissue-target-navigation-blink {" +
            "  0%, 100% { opacity: 1; }" +
            "  50% { opacity: 0.2; }" +
            "}";

        frameDocument.head.appendChild(style);
    }

    function scanMainFrame(frameDocument) {
        var bodyText = frameDocument.body.innerText;

        if (!bodyText || bodyText.indexOf("Gewebeforschung") === -1) {
            return;
        }

        var selectedTarget = getTissueTarget();
        var selectedTargetFound = false;

        if (selectedTarget) {
            ensureBlinkStyle(frameDocument);
        }

        var walker = frameDocument.createTreeWalker(
            frameDocument.body,
            NodeFilter.SHOW_TEXT
        );

        var textNodes = [];
        var node;

        while ((node = walker.nextNode())) {
            if (TISSUE_TARGET_PATTERN.test(node.nodeValue)) {
                textNodes.push(node);
            }
        }

        for (var i = 0; i < textNodes.length; i++) {
            var textNode = textNodes[i];
            var match = TISSUE_TARGET_PATTERN.exec(textNode.nodeValue);

            if (!match) {
                continue;
            }

            // Find the bold element immediately following this text.
            var targetElement = textNode.nextSibling;

            while (
                targetElement &&
                !(targetElement.nodeType === 1 &&
                    targetElement.tagName === "B")
            ) {
                if (
                    targetElement.nodeType === 1 &&
                    targetElement.tagName === "BR"
                ) {
                    targetElement = null;
                    break;
                }

                targetElement = targetElement.nextSibling;
            }

            if (!targetElement) {
                continue;
            }

            var targetName = targetElement.textContent.trim();

            if (!targetName) {
                continue;
            }

            if (targetName === selectedTarget) {
                selectedTargetFound = true;
            }

            if (
                !targetElement.classList.contains(
                    "tissue-target-navigation"
                )
            ) {
                makeTissueTargetClickable(targetElement, targetName);
            }

            if (targetName === selectedTarget) {
                targetElement.style.animation =
                    "tissue-target-navigation-blink 0.5s ease-in-out infinite";
            } else {
                targetElement.style.animation = "";
            }
        }

        if (selectedTarget && !selectedTargetFound) {
            clearTissueTarget();
        }
    }

    function scanItemFrame(frameDocument) {
        var bodyText = frameDocument.body.innerText;

        if (!bodyText || !COORDINATE_TOOL_MARKERS.some(function (marker) {
            return bodyText.includes(marker);
        })) {
            return;
        }

        var targetName = getTissueTarget();

        if (!targetName) {
            return;
        }

        var walker = frameDocument.createTreeWalker(
            frameDocument.body,
            NodeFilter.SHOW_TEXT
        );

        var textNodes = [];
        var node;

        while ((node = walker.nextNode())) {
            if (node.nodeValue.indexOf(targetName) !== -1) {
                textNodes.push(node);
            }
        }

        for (var i = 0; i < textNodes.length; i++) {
            var textNode = textNodes[i];
            var parent = textNode.parentNode;

            if (!parent) {
                continue;
            }

            // The player name and coordinates must belong
            // to the same line.
            var line = parent.parentNode;

            if (!line) {
                continue;
            }

            var lineText = line.textContent;

            if (lineText.indexOf(targetName) === -1) {
                continue;
            }

            var coordinateMatch =
                COORDINATE_PATTERN.exec(lineText);

            if (!coordinateMatch) {
                continue;
            }

            var x = parseInt(coordinateMatch[1], 10);
            var y = parseInt(coordinateMatch[2], 10);

            saveNavigationTarget(x, y);

            return;
        }
    }

    function scanFrame(frameName) {
        var frameElement = document.querySelector(
            "frame[name=\"" + frameName + "\"]"
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

        if (frameName === "mainFrame") {
            scanMainFrame(frameDocument);
        } else if (frameName === "itemFrame") {
            scanItemFrame(frameDocument);
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
