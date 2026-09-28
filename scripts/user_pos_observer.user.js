// ==UserScript==
// @name        user_pos_observer
// @namespace   Zabuza
// @description Shows details, such as PvP or secure field status, in all menus of the MMORPG freewar.de showing user positions.
// @include     *.freewar.de/freewar/internal/frset.php*
// @require     https://zabuzard.github.io/FreewarScripts/resources/coordinate_resource.js
// @require     https://zabuzard.github.io/FreewarScripts/resources/secure_locations.js
// @version     1
// ==/UserScript==

(function () {
  var positionPattern = /(?:\(\s*X:\s*(-?\d+)\s+Y:\s*(-?\d+)\s*\)|Position\s+X:\s*(-?\d+)\s+Y:\s*(-?\d+)|X:\s*(-?\d+)\s+Y:\s*(-?\d+))/g;

  var FRAME_NAMES = [
    "mainFrame",
    "itemFrame"
  ];

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
        parent.classList.contains("user-pos-observer-highlight")
      ) {
        continue;
      }

      textNodes.push(node);
    }

    for (var i = 0; i < textNodes.length; i++) {
      highlightPositions(textNodes[i]);
    }
  }

  function highlightPositions(textNode) {
    var text = textNode.nodeValue;

    positionPattern.lastIndex = 0;

    if (!positionPattern.test(text)) {
      return;
    }

    positionPattern.lastIndex = 0;

    var document = textNode.ownerDocument;
    var navigationElement = textNode.parentElement
      ? textNode.parentElement.closest(".target-navigation-coordinate")
      : null;

    if (navigationElement) {
      var match = positionPattern.exec(text);

      if (!match) { return; }

      var x = parseInt(
        match[1] !== undefined ? match[1] :
        match[3] !== undefined ? match[3] :
        match[5],
        10
      );

      var y = parseInt(
        match[2] !== undefined ? match[2] :
        match[4] !== undefined ? match[4] :
        match[6],
        10
      );

      var areaName = getAreaName(x, y);

      navigationElement.classList.add(
        "user-pos-observer-highlight"
      );

      navigationElement.style.backgroundColor = isSecureLocation(x, y)
        ? "#444444"
        : "#8b4a4a";
      navigationElement.style.borderRadius = "2px";
      navigationElement.style.padding = "0 2px";

      if (areaName && navigationElement.textContent === match[0]) {
        navigationElement.textContent =
          match[0] + " [" + areaName + "]";
      }

      return;
    }

    var fragment = document.createDocumentFragment();
    var lastIndex = 0;
    var match;

    while ((match = positionPattern.exec(text)) !== null) {
      var x = parseInt(
        match[1] !== undefined ? match[1] :
        match[3] !== undefined ? match[3] :
        match[5],
        10
      );

      var y = parseInt(
        match[2] !== undefined ? match[2] :
        match[4] !== undefined ? match[4] :
        match[6],
        10
      );

      var areaName = getAreaName(x, y);

      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(
            text.substring(lastIndex, match.index)
          )
        );
      }

      var span = document.createElement("span");

      span.className = "user-pos-observer-highlight";
      span.style.backgroundColor = isSecureLocation(x, y)
        ? "#444444"
        : "#8b4a4a";
      span.style.borderRadius = "2px";
      span.style.padding = "0 2px";
      span.textContent = areaName
        ? match[0] + " [" + areaName + "]"
        : match[0];
      span.title = "Position: X " + x + " Y " + y;

      fragment.appendChild(span);

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(
        document.createTextNode(
          text.substring(lastIndex)
        )
      );
    }

    textNode.parentNode.replaceChild(fragment, textNode);
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
