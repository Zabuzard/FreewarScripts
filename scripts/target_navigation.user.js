// ==UserScript==
// @name        target_navigation
// @namespace   Zabuza
// @description Navigates to given target coordinates
// @include     *.freewar.de/freewar/internal/map.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
    function addTargetLine() {
        var positionText = document.querySelector("p.positiontext");
        if (!positionText) { return; }

        if (document.querySelector("#target-navigation-line")) { return; }
        var targetLine = document.createElement("p");
        targetLine.id = "target-navigation-line";
        targetLine.className = "positiontext";

        var label = document.createTextNode("Ziel X/Y: ");
        var input = document.createElement("input");

        input.type = "text";
        input.placeholder = "123/456";

        input.addEventListener("change", function () {
            var value = input.value.trim();
            var match = value.match(/^\s*(-?\d+)\s*[,/]\s*(-?\d+)\s*$/);
            if (!match) {
                console.log("Ungültige Koordinaten:", value);
                return;
            }

            var x = parseInt(match[1], 10);
            var y = parseInt(match[2], 10);
            console.log("Zielkoordinaten:", x, y);
        });

        targetLine.appendChild(label);
        targetLine.appendChild(input);

        positionText.parentNode.insertBefore(targetLine, positionText.nextSibling);
    }

    var observer = new MutationObserver(function () { addTargetLine(); });
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(function () { addTargetLine(); }, 100);
    addTargetLine();
})();
