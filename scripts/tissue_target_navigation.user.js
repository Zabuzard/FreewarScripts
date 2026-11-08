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
    var LAST_TISSUE_SOLD_KEY = "last-tissue-sold-ts";
    var LAST_CHAT_SCANNED_KEY = "last-tissue-chat-scanned-ts";
    var TOTAL_TISSUE_PROFIT_KEY = "total-tissue-profit";
    var TISSUE_PROFIT_DISPLAY_ID = "tissue-target-navigation-profit";
    var TISSUE_PROFIT_USERNAME = "Zabuzard";
    var COOKIE_MAX_AGE = 15 * 60;
    var TARGET_EXPIRATION_TIME = 15 * 60 * 1000;

    var TISSUE_COUNTDOWN_DURATION = 10 * 60 * 1000;
    var TISSUE_COUNTDOWN_ID = "tissue-target-navigation-countdown";
    var TISSUE_COUNTDOWN_TEXT =
        "Dies ist ein Ort des Friedens, Angriffe sind hier unmöglich.";

    var tissueCountdownTimeout = null;
    var tissueCountdownTimestamp = null;

    var FRAME_NAMES = [
        "mainFrame",
        "itemFrame",
        "chattextFrame"
    ];

    var COORDINATE_TOOL_MARKERS = [
        "Lebende Wesen an der Oberfläche dieser Welt",
        "Lebende Wesen in deinem Umkreis von"
    ];

    var TISSUE_TARGET_PATTERN =
        /Derzeit suchen die Forscher dringend eine Gewebeprobe von\s*/;

    var COORDINATE_PATTERN =
        /X:\s*(-?\d+)\s*(?:\/\s*|\s+)Y:\s*(-?\d+)/;

    var TISSUE_SOLD_PATTERN =
        /verkauft eine Gewebeprobe von/;

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

    function saveStoredValue(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            document.cookie =
                key + "=" + encodeURIComponent(value) +
                "; path=/; max-age=7200";
        }
    }

    function getTissueSoldTimestamp() {
        var timestamp = getStoredValue(LAST_TISSUE_SOLD_KEY);

        if (!timestamp) {
            return null;
        }

        var match =
            /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(timestamp);

        if (!match) {
            return null;
        }

        var now = new Date();
        var soldDate = new Date(now);

        soldDate.setHours(
            parseInt(match[1], 10),
            parseInt(match[2], 10),
            parseInt(match[3], 10),
            parseInt((match[4] || "0").substring(0, 3).padEnd(3, "0"), 10)
        );

        // Handle a sale timestamp from the previous day.
        if (soldDate.getTime() > now.getTime() + 10 * 60 * 1000) {
            soldDate.setDate(soldDate.getDate() - 1);
        }

        return soldDate.getTime();
    }

    function removeTissueCountdown(frameDocument) {
        if (tissueCountdownTimeout !== null) {
            clearTimeout(tissueCountdownTimeout);
            tissueCountdownTimeout = null;
        }

        var countdown = frameDocument.getElementById(
            TISSUE_COUNTDOWN_ID
        );

        if (countdown) {
            countdown.remove();
        }
    }

    function formatCountdown(milliseconds) {
        var totalSeconds = Math.ceil(milliseconds / 1000);
        var minutes = Math.floor(totalSeconds / 60);
        var seconds = totalSeconds % 60;

        return (
            String(minutes) + ":" +
            String(seconds).padStart(2, "0")
        );
    }

    function updateTissueCountdown(frameDocument, soldTimestamp) {
        var remaining = TISSUE_COUNTDOWN_DURATION -
            (Date.now() - soldTimestamp);

        if (remaining <= 0) {
            removeTissueCountdown(frameDocument);
            tissueCountdownTimestamp = null;
            return;
        }

        var countdown = frameDocument.getElementById(
            TISSUE_COUNTDOWN_ID
        );

        if (!countdown) {
            var areaDescription =
                frameDocument.querySelector(
                    "table.areadescription tbody td.areadescription"
                );

            if (!areaDescription) {
                return;
            }

            var walker = frameDocument.createTreeWalker(
                areaDescription,
                NodeFilter.SHOW_TEXT
            );

            var node;
            var inserted = false;

            while ((node = walker.nextNode())) {
                var textIndex = node.nodeValue.indexOf(
                    TISSUE_COUNTDOWN_TEXT
                );

                if (textIndex === -1) {
                    continue;
                }

                var afterText = node.splitText(
                    textIndex + TISSUE_COUNTDOWN_TEXT.length
                );

                countdown = frameDocument.createElement("span");
                countdown.id = TISSUE_COUNTDOWN_ID;
                countdown.style.fontSize = "1.3em";
                countdown.style.color = "rgb(123, 145, 120)";
                countdown.style.marginLeft = "0.5em";

                afterText.parentNode.insertBefore(
                    countdown,
                    afterText
                );

                inserted = true;
                break;
            }

            if (!inserted) {
                return;
            }
        }

        countdown.textContent =
            "Nächste Gewebeprobe in " + formatCountdown(remaining) + " min.";

        if (remaining < 30 * 1000) {
            countdown.style.animation =
                "tissue-target-navigation-blink 0.5s ease-in-out infinite";
        } else {
            countdown.style.animation = "";
        }

        var updateInterval;

        if (remaining > 5 * 60 * 1000) {
            updateInterval = 30 * 1000;
        } else if (remaining > 30 * 1000) {
            updateInterval = 5 * 1000;
        } else {
            updateInterval = 1000;
        }

        tissueCountdownTimeout = setTimeout(function () {
            tissueCountdownTimeout = null;
            updateTissueCountdown(frameDocument, soldTimestamp);
        }, updateInterval);
    }

    function scanTissueCountdown(frameDocument) {
        var areaDescription =
            frameDocument.querySelector(
                "table.areadescription tbody td.areadescription"
            );

        if (!areaDescription ||
            areaDescription.innerText.indexOf(
                TISSUE_COUNTDOWN_TEXT
            ) === -1) {
            removeTissueCountdown(frameDocument);
            tissueCountdownTimestamp = null;
            return;
        }

        var soldTimestamp = getTissueSoldTimestamp();

        if (soldTimestamp === null) {
            removeTissueCountdown(frameDocument);
            tissueCountdownTimestamp = null;
            return;
        }

        var remaining = TISSUE_COUNTDOWN_DURATION -
            (Date.now() - soldTimestamp);

        if (remaining <= 0) {
            removeTissueCountdown(frameDocument);
            tissueCountdownTimestamp = null;
            return;
        }

        if (soldTimestamp !== tissueCountdownTimestamp) {
            removeTissueCountdown(frameDocument);
            tissueCountdownTimestamp = soldTimestamp;
        }

        // Recreate the element if a main-frame refresh removed it.
        if (!frameDocument.getElementById(TISSUE_COUNTDOWN_ID)) {
            if (tissueCountdownTimeout !== null) {
                clearTimeout(tissueCountdownTimeout);
                tissueCountdownTimeout = null;
            }

            updateTissueCountdown(frameDocument, soldTimestamp);
        }
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

    function addTissueProfit(gold, experiencePoints, orderPoints) {
        var total = {
            gold: 0,
            experiencePoints: 0,
            orderPoints: 0
        };

        try {
            var stored = localStorage.getItem(TOTAL_TISSUE_PROFIT_KEY);

            if (stored) {
                var parsed = JSON.parse(stored);

                total.gold = Number(parsed.gold) || 0;
                total.experiencePoints =
                    Number(parsed.experiencePoints) || 0;
                total.orderPoints = Number(parsed.orderPoints) || 0;
            }
        } catch (e) {}

        total.gold += gold;
        total.experiencePoints += experiencePoints;
        total.orderPoints += orderPoints;

        try {
            localStorage.setItem(
                TOTAL_TISSUE_PROFIT_KEY,
                JSON.stringify(total)
            );
        } catch (e) {}
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

    function updateTissueProfitDisplay(frameDocument) {
        var areaDescription =
            frameDocument.querySelector(
                "table.areadescription tbody td.areadescription"
            );

        if (!areaDescription) {
            return;
        }

        var total = {
            gold: 0,
            experiencePoints: 0,
            orderPoints: 0
        };

        try {
            var stored = localStorage.getItem(TOTAL_TISSUE_PROFIT_KEY);

            if (stored) {
                var parsed = JSON.parse(stored);

                total.gold = Number(parsed.gold) || 0;
                total.experiencePoints =
                    Number(parsed.experiencePoints) || 0;
                total.orderPoints = Number(parsed.orderPoints) || 0;
            }
        } catch (e) {}

        var display = frameDocument.getElementById(
            TISSUE_PROFIT_DISPLAY_ID
        );

        if (!display) {
            display = frameDocument.createElement("div");
            display.id = TISSUE_PROFIT_DISPLAY_ID;
            display.style.marginBottom = "0.5em";

            areaDescription.appendChild(display);
        }

        display.textContent =
            "Profit: " +
            total.gold.toLocaleString("de-DE") + " G | " +
            total.experiencePoints.toLocaleString("de-DE") + " XP | " +
            total.orderPoints.toLocaleString("de-DE") + " AP";
    }

    function scanMainFrame(frameDocument) {
        var bodyText = frameDocument.body.innerText;

        if (!bodyText || bodyText.indexOf("Gewebeforschung") === -1) {
            removeTissueCountdown(frameDocument);
            tissueCountdownTimestamp = null;
            return;
        }

        updateTissueProfitDisplay(frameDocument);
        scanTissueCountdown(frameDocument);

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

            // Find the top-level node containing the target name.
            var lineStart = textNode;

            while (
                lineStart.parentNode &&
                lineStart.parentNode !== frameDocument.body
            ) {
                lineStart = lineStart.parentNode;
            }

            // Collect text from this row until the next line break.
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

    function scanChatFrame(frameDocument) {
        var messages = frameDocument.querySelectorAll("p");
        var lastScannedTimestamp =
            getStoredValue(LAST_CHAT_SCANNED_KEY);
        var newestTimestamp = lastScannedTimestamp;

        for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            var timestampElement =
                message.querySelector(".chattime");

            if (!timestampElement) {
                continue;
            }

            var timestamp = timestampElement.getAttribute("title");

            if (!timestamp) {
                continue;
            }

            if (
                lastScannedTimestamp &&
                timestamp <= lastScannedTimestamp
            ) {
                continue;
            }

            if (TISSUE_SOLD_PATTERN.test(message.textContent)) {
                saveStoredValue(LAST_TISSUE_SOLD_KEY, timestamp);

                var sellerElement = message.querySelector("i b");
                var saleMatch =
                    /verkauft eine Gewebeprobe von .+? für ([\d.]+) Goldmünzen und erhält ([\d.]+) Erfahrungspunkte sowie ([\d.]+) Auftragspunkte/
                        .exec(message.textContent);

                if (
                    sellerElement &&
                    sellerElement.textContent.trim() === TISSUE_PROFIT_USERNAME &&
                    saleMatch
                ) {
                    addTissueProfit(
                        parseInt(saleMatch[1].replace(/\./g, ""), 10),
                        parseInt(saleMatch[2].replace(/\./g, ""), 10),
                        parseInt(saleMatch[3].replace(/\./g, ""), 10)
                    );
                }
            }

            if (!newestTimestamp || timestamp > newestTimestamp) {
                newestTimestamp = timestamp;
            }
        }

        if (
            newestTimestamp &&
            newestTimestamp !== lastScannedTimestamp
        ) {
            saveStoredValue(LAST_CHAT_SCANNED_KEY, newestTimestamp);
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
        } else if (frameName === "chattextFrame") {
            scanChatFrame(frameDocument);
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
