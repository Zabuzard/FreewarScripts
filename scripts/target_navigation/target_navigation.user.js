// ==UserScript==
// @name        target_navigation
// @namespace   Zabuza
// @description Navigates to given target coordinates
// @include     *.freewar.de/freewar/internal/map.php*
// @require     https://zabuzard.github.io/FreewarScripts/resources/coordinate_resource.js
// @version     1
// @grant       none
// ==/UserScript==

(function () {
    var STORAGE_KEY = "target-navigation-coordinate";
    var STORAGE_TIMESTAMP_KEY = "target-navigation-coordinate-timestamp";
    var COOKIE_MAX_AGE = 2 * 60 * 60;
    var TARGET_MAX_AGE = 2 * 60 * 60 * 1000;
    var lastTargetValue = null;

    function parseCoordinates(value) {
        var match = String(value || "").match(/^\s*(-?\d+)\s*(?:[,/ ]+)\s*(-?\d+)\s*$/);
        if (!match) { return null; }

        return {
            x: parseInt(match[1], 10),
            y: parseInt(match[2], 10)
        };
    }

    function getCookie(name) {
        var cookies = document.cookie.split(";");

        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i].trim();
            if (cookie.indexOf(name + "=") !== 0) { continue; }

            return decodeURIComponent(cookie.substring(name.length + 1));
        }

        return null;
    }

    function setCookie(name, value) {
        document.cookie =
            name + "=" + encodeURIComponent(value) +
            "; path=/; max-age=" + COOKIE_MAX_AGE;
    }

    function deleteCookie(name) {
        document.cookie = name + "=; path=/; max-age=0";
    }

    function saveTarget(x, y) {
        var value = x + "/" + y;
        var timestamp = Date.now();

        try {
            localStorage.setItem(STORAGE_KEY, value);
            localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(timestamp));
            return;
        } catch (e) {
            setCookie(STORAGE_KEY, value);
            setCookie(STORAGE_TIMESTAMP_KEY, String(timestamp));
        }
    }

    function clearStoredTarget() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
        } catch (e) {
            deleteCookie(STORAGE_KEY);
            deleteCookie(STORAGE_TIMESTAMP_KEY);
        }

        lastTargetValue = null;
    }

    function readStoredTarget() {
        var value = null;
        var timestamp = null;
        var localStorageAvailable = true;

        try {
            value = localStorage.getItem(STORAGE_KEY);
            timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
        } catch (e) {
            localStorageAvailable = false;
        }

        if (!localStorageAvailable) {
            value = getCookie(STORAGE_KEY);
            timestamp = getCookie(STORAGE_TIMESTAMP_KEY);
        }

        if (!value) { return null; }

        var coordinates = parseCoordinates(value);
        if (!coordinates) { return null; }

        timestamp = parseInt(timestamp, 10);

        if (!timestamp) {
            timestamp = Date.now();

            if (localStorageAvailable) {
                try {
                    localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(timestamp));
                } catch (e) {
                    setCookie(STORAGE_TIMESTAMP_KEY, String(timestamp));
                }
            } else {
                setCookie(STORAGE_TIMESTAMP_KEY, String(timestamp));
            }
        }

        if (Date.now() - timestamp > TARGET_MAX_AGE) {
            if (localStorageAvailable) {
                try {
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
                } catch (e) {
                    deleteCookie(STORAGE_KEY);
                    deleteCookie(STORAGE_TIMESTAMP_KEY);
                }
            } else {
                deleteCookie(STORAGE_KEY);
                deleteCookie(STORAGE_TIMESTAMP_KEY);
            }

            lastTargetValue = null;
            return null;
        }

        return {
            x: coordinates.x,
            y: coordinates.y,
            value: value,
            timestamp: timestamp
        };
    }

    function updateAreaDisplay(x, y) {
        var areaElement = document.querySelector("#target-navigation-area");
        if (!areaElement) { return; }

        var area = getAreaName(x, y);

        areaElement.textContent = area || "";
        areaElement.style.display = area ? "" : "none";
    }

    function clearAreaDisplay() {
        var areaElement = document.querySelector("#target-navigation-area");
        if (!areaElement) { return; }

        areaElement.textContent = "";
        areaElement.style.display = "none";
    }

    function addTargetLine() {
        var positionText = document.querySelector("p.positiontext");
        if (!positionText) { return; }

        if (document.querySelector("#target-navigation-line")) { return; }

        var targetLine = document.createElement("p");
        targetLine.id = "target-navigation-line";
        targetLine.className = "positiontext";
        targetLine.style.marginTop = "-4px";
        targetLine.style.marginBottom = "2px";
        targetLine.style.lineHeight = "14px";
        targetLine.style.borderTop = "none";
        targetLine.style.paddingTop = "1px";

        var label = document.createTextNode("Ziel X/Y: ");
        var input = document.createElement("input");
        var clearButton = document.createElement("button");
        var areaElement = document.createElement("span");

        input.type = "text";
        input.style.width = "10ch";
        input.style.height = "14px";
        input.style.minHeight = "14px";
        input.style.maxHeight = "14px";
        input.style.padding = "0 3px";
        input.style.margin = "0";
        input.style.boxSizing = "border-box";
        input.style.appearance = "none";
        input.style.webkitAppearance = "none";
        input.style.background = "#3d3d3d";
        input.style.border = "1px solid #555555";
        input.style.borderRadius = "0";
        input.style.outline = "none";
        input.style.color = "#cccccc";
        input.style.fontFamily = "inherit";
        input.style.fontSize = "11px";
        input.style.fontWeight = "normal";
        input.style.lineHeight = "12px";
        input.style.verticalAlign = "middle";

        input.addEventListener("change", function () {
            var value = input.value.trim();
            var coordinates = parseCoordinates(value);

            if (!coordinates) {
                clearStoredTarget();
                clearTargetHighlight();
                clearButton.style.display = "none";
                clearAreaDisplay();
                return;
            }

            var normalizedValue = coordinates.x + "/" + coordinates.y;
            input.value = normalizedValue;

            saveTarget(coordinates.x, coordinates.y);
            var storedTarget = readStoredTarget();
            lastTargetValue = storedTarget.value + "|" + storedTarget.timestamp;
            clearButton.style.display = "";
            updateAreaDisplay(coordinates.x, coordinates.y);
            highlightTarget(coordinates.x, coordinates.y);
        });
        input.addEventListener("keydown", function (event) {
            if (event.key !== "Escape") { return; }

            event.preventDefault();

            input.value = "";
            clearStoredTarget();
            clearTargetHighlight();
            clearAreaDisplay();
            clearButton.style.display = "none";
        });

        clearButton.type = "button";
        clearButton.textContent = "×";
        clearButton.title = "Ziel löschen";
        clearButton.style.marginLeft = "2px";
        clearButton.style.padding = "0";
        clearButton.style.width = "15px";
        clearButton.style.height = "14px";
        clearButton.style.minHeight = "14px";
        clearButton.style.maxHeight = "14px";
        clearButton.style.lineHeight = "12px";
        clearButton.style.boxSizing = "border-box";
        clearButton.style.appearance = "none";
        clearButton.style.webkitAppearance = "none";
        clearButton.style.border = "1px solid #555555";
        clearButton.style.borderRadius = "0";
        clearButton.style.background = "#3d3d3d";
        clearButton.style.color = "#999999";
        clearButton.style.fontFamily = "Arial, sans-serif";
        clearButton.style.fontSize = "11px";
        clearButton.style.fontWeight = "normal";
        clearButton.style.cursor = "pointer";
        clearButton.style.verticalAlign = "middle";
        clearButton.style.display = "none";

        clearButton.addEventListener("click", function () {
            input.value = "";
            clearStoredTarget();
            clearTargetHighlight();
            clearButton.style.display = "none";
            clearAreaDisplay();
        });

        areaElement.id = "target-navigation-area";
        areaElement.style.marginLeft = "5px";
        areaElement.style.color = "#999999";
        areaElement.style.fontSize = "11px";
        areaElement.style.fontWeight = "normal";
        areaElement.style.verticalAlign = "middle";
        areaElement.style.display = "none";

        targetLine.appendChild(label);
        targetLine.appendChild(input);
        targetLine.appendChild(clearButton);
        targetLine.appendChild(areaElement);

        positionText.parentNode.insertBefore(targetLine, positionText.nextSibling);
    }

    function addHighlightStyle() {
        if (document.querySelector("#target-navigation-style")) { return; }

        var style = document.createElement("style");
        style.id = "target-navigation-style";
        style.textContent = `
            .target-navigation-highlight {
                position: relative;
                filter: sepia(0.15) saturate(1.1) hue-rotate(0deg) brightness(1.02);
            }

            .target-navigation-highlight::after {
                content: "";
                position: absolute;
                inset: 0;
                background: rgba(255, 0, 0, 0.25);
                pointer-events: none;
            }

            .target-navigation-direction {
                position: relative;
            }

            .target-navigation-direction::after {
                content: "";
                position: absolute;
                pointer-events: none;
                background: rgba(255, 0, 0, 0.35);
            }

            .target-navigation-north::after {
                top: 0;
                left: 0;
                width: 100%;
                height: 15px;
            }

            .target-navigation-south::after {
                bottom: 0;
                left: 0;
                width: 100%;
                height: 15px;
            }

            .target-navigation-west::after {
                top: 0;
                left: 0;
                width: 15px;
                height: 100%;
            }

            .target-navigation-east::after {
                top: 0;
                right: 0;
                width: 15px;
                height: 100%;
            }

            .target-navigation-northwest::after {
                inset: 0;
                background: transparent;
                box-shadow:
                    inset 0 15px 0 rgba(255, 0, 0, 0.35),
                    inset 15px 0 0 rgba(255, 0, 0, 0.35);
            }

            .target-navigation-northeast::after {
                inset: 0;
                background: transparent;
                box-shadow:
                    inset 0 15px 0 rgba(255, 0, 0, 0.35),
                    inset -15px 0 0 rgba(255, 0, 0, 0.35);
            }

            .target-navigation-southwest::after {
                inset: 0;
                background: transparent;
                box-shadow:
                    inset 0 -15px 0 rgba(255, 0, 0, 0.35),
                    inset 15px 0 0 rgba(255, 0, 0, 0.35);
            }

            .target-navigation-southeast::after {
                inset: 0;
                background: transparent;
                box-shadow:
                    inset 0 -15px 0 rgba(255, 0, 0, 0.35),
                    inset -15px 0 0 rgba(255, 0, 0, 0.35);
            }
        `;

        document.head.appendChild(style);
    }

    function clearTargetHighlight() {
        var highlightedTiles = document.querySelectorAll(".target-navigation-highlight");

        for (var i = 0; i < highlightedTiles.length; i++) {
            highlightedTiles[i].classList.remove("target-navigation-highlight");
        }

        var directionTiles = document.querySelectorAll(".target-navigation-direction");

        for (var i = 0; i < directionTiles.length; i++) {
            directionTiles[i].classList.remove(
                "target-navigation-direction",
                "target-navigation-north",
                "target-navigation-south",
                "target-navigation-west",
                "target-navigation-east",
                "target-navigation-northwest",
                "target-navigation-northeast",
                "target-navigation-southwest",
                "target-navigation-southeast"
            );
        }
    }

    function highlightTarget(targetX, targetY) {
        addHighlightStyle();
        clearTargetHighlight();

        var tile = document.getElementById("mapx" + targetX + "y" + targetY);
        if (tile) {
            tile.classList.add("target-navigation-highlight");
            return;
        }

        var positionText = document.querySelector("p.positiontext");
        if (!positionText) { return; }

        var positionMatch = positionText.textContent.match(/X:\s*(-?\d+)\s*Y:\s*(-?\d+)/);
        if (!positionMatch) { return; }

        var playerX = parseInt(positionMatch[1], 10);
        var playerY = parseInt(positionMatch[2], 10);

        if (Math.sign(playerX) !== Math.sign(targetX)) { return; }

        var deltaX = targetX - playerX;
        var deltaY = targetY - playerY;

        var directionX = 0;
        var directionY = 0;

        if (deltaX < -1) {
            directionX = -1;
        } else if (deltaX > 1) {
            directionX = 1;
        }

        if (deltaY < -1) {
            directionY = -1;
        } else if (deltaY > 1) {
            directionY = 1;
        }

        var directionClass = "";

        if (directionX === 0 && directionY < 0) {
            directionClass = "north";
        } else if (directionX === 0 && directionY > 0) {
            directionClass = "south";
        } else if (directionX < 0 && directionY === 0) {
            directionClass = "west";
        } else if (directionX > 0 && directionY === 0) {
            directionClass = "east";
        } else if (directionX < 0 && directionY < 0) {
            directionClass = "northwest";
        } else if (directionX > 0 && directionY < 0) {
            directionClass = "northeast";
        } else if (directionX < 0 && directionY > 0) {
            directionClass = "southwest";
        } else if (directionX > 0 && directionY > 0) {
            directionClass = "southeast";
        }

        if (!directionClass) { return; }

        var rows = document.querySelectorAll(".maptable tr");
        if (rows.length < 3) { return; }

        var centerRow = Math.floor(rows.length / 2);
        var centerColumn = Math.floor(rows[centerRow].children.length / 2);
        var highlightTiles = [];

        if (directionClass === "north") {
            for (var x = centerColumn - 1; x <= centerColumn + 1; x++) {
                highlightTiles.push({ row: 0, column: x, direction: "north" });
            }
        } else if (directionClass === "south") {
            for (var x = centerColumn - 1; x <= centerColumn + 1; x++) {
                highlightTiles.push({ row: rows.length - 1, column: x, direction: "south" });
            }
        } else if (directionClass === "west") {
            for (var y = centerRow - 1; y <= centerRow + 1; y++) {
                highlightTiles.push({ row: y, column: 0, direction: "west" });
            }
        } else if (directionClass === "east") {
            for (var y = centerRow - 1; y <= centerRow + 1; y++) {
                highlightTiles.push({ row: y, column: rows[y].children.length - 1, direction: "east" });
            }
        } else if (directionClass === "northwest") {
            highlightTiles.push(
                { row: 0, column: 0, direction: "northwest" },
                { row: 0, column: 1, direction: "north" },
                { row: 1, column: 0, direction: "west" }
            );
        } else if (directionClass === "northeast") {
            highlightTiles.push(
                { row: 0, column: rows[0].children.length - 1, direction: "northeast" },
                { row: 0, column: rows[0].children.length - 2, direction: "north" },
                { row: 1, column: rows[1].children.length - 1, direction: "east" }
            );
        } else if (directionClass === "southwest") {
            highlightTiles.push(
                { row: rows.length - 1, column: 0, direction: "southwest" },
                { row: rows.length - 1, column: 1, direction: "south" },
                { row: rows.length - 2, column: 0, direction: "west" }
            );
        } else if (directionClass === "southeast") {
            highlightTiles.push(
                { row: rows.length - 1, column: rows[rows.length - 1].children.length - 1, direction: "southeast" },
                { row: rows.length - 1, column: rows[rows.length - 1].children.length - 2, direction: "south" },
                { row: rows.length - 2, column: rows[rows.length - 2].children.length - 1, direction: "east" }
            );
        }

        for (var i = 0; i < highlightTiles.length; i++) {
            var highlight = highlightTiles[i];
            if (!rows[highlight.row]) { continue; }

            var directionTile = rows[highlight.row].children[highlight.column];
            if (!directionTile) { continue; }

            directionTile.classList.add(
                "target-navigation-direction",
                "target-navigation-" + highlight.direction
            );
        }
    }

    function syncTargetFromStorage() {
        var storedTarget = readStoredTarget();
        var input = document.querySelector("#target-navigation-line input");
        var clearButton = document.querySelector("#target-navigation-line button");

        if (!storedTarget) {
            if (lastTargetValue !== null) {
                lastTargetValue = null;

                if (input && document.activeElement !== input) {
                    input.value = "";
                }

                clearTargetHighlight();
                clearAreaDisplay();
            }

            if (clearButton) {
                clearButton.style.display = "none";
            }

            return;
        }

        if (input && document.activeElement !== input) {
            input.value = storedTarget.x + "/" + storedTarget.y;
        }

        if (clearButton) {
            clearButton.style.display = "";
        }

        var targetSignature = storedTarget.value + "|" + storedTarget.timestamp;

        if (targetSignature === lastTargetValue) {
            return;
        }

        lastTargetValue = targetSignature;
        updateAreaDisplay(storedTarget.x, storedTarget.y);
        highlightTarget(storedTarget.x, storedTarget.y);
    }

    var observer = new MutationObserver(function () {
        addTargetLine();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(function () {
        addTargetLine();
        syncTargetFromStorage();
    }, 100);

    addTargetLine();
    syncTargetFromStorage();
})();
