// ==UserScript==
// @name        user_pos_observer
// @namespace   Zabuza
// @description Shows details, such as PvP or secure field status in all menus of the MMORPG freewar.de showing user positions.
// @include     *.freewar.de/freewar/internal/frset.php*
// @require     https://zabuzard.github.io/FreewarScripts/resources/coordinate_resource.js
// @require     https://zabuzard.github.io/FreewarScripts/resources/secure_locations.js
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var STORAGE_KEY = "user-pos-observer";
  var POSITION_STALE_TIME = 5 * 60 * 1000;

  var FRAME_NAMES = [
    "mainFrame",
    "itemFrame"
  ];

  var POSITION_PATTERN = /X:\s*(-?\d+)\s+Y:\s*(-?\d+)/;
  var XP_USERNAME_PATTERN = /^(.+?)\s+\(XP:\s*[\d.]+\)/;
  var BARE_USERNAME_PATTERN = /^(.+?)\s+-\s+\(/;

  function loadPlayerData() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);

      if (value) {
        return JSON.parse(value);
      }
    } catch (e) {}

    return {};
  }

  function savePlayerData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function rememberPosition(username, x, y) {
    var data = loadPlayerData();
    var player = data[username];
    var now = Date.now();

    if (!player) {
      player = {
        pvp: false,
        timestamp: now,
        x: x,
        y: y,
        positionTimestamp: now
      };

      data[username] = player;
      savePlayerData(data);
      return;
    }

    if (player.x !== x || player.y !== y || !player.positionTimestamp) {
      player.x = x;
      player.y = y;
      player.positionTimestamp = now;
    }

    player.timestamp = now;

    data[username] = player;
    savePlayerData(data);
  }

  function getLineInfo(node) {
    var current = node;

    while (current && current.parentNode) {
      var parent = current.parentNode;
      var siblings = parent.childNodes;
      var index = -1;

      for (var i = 0; i < siblings.length; i++) {
        if (siblings[i] === current) {
          index = i;
          break;
        }
      }

      if (index === -1) {
        current = parent;
        continue;
      }

      var start = index;
      var end = index;

      while (start > 0) {
        var previous = siblings[start - 1];

        if (previous.nodeType === Node.ELEMENT_NODE && previous.nodeName === "BR") {
          break;
        }

        start--;
      }

      while (end < siblings.length - 1) {
        var next = siblings[end + 1];

        if (next.nodeType === Node.ELEMENT_NODE && next.nodeName === "BR") {
          break;
        }

        end++;
      }

      if (start !== index || end !== index || parent.nodeName === "BODY" || parent.nodeName === "TD") {
        var nodes = [];

        for (var j = start; j <= end; j++) {
          nodes.push(siblings[j]);
        }

        return {
          parent: parent,
          nodes: nodes
        };
      }

      current = parent;
    }

    return null;
  }

  function getLineText(node) {
    var lineInfo = getLineInfo(node);

    if (!lineInfo) {
      return "";
    }

    var text = "";

    for (var i = 0; i < lineInfo.nodes.length; i++) {
      text += lineInfo.nodes[i].textContent || "";
    }

    return text;
  }

  function getUsername(lineText) {
    var match = XP_USERNAME_PATTERN.exec(lineText);

    if (match) {
      return match[1].trim();
    }

    match = BARE_USERNAME_PATTERN.exec(lineText);

    if (match) {
      return match[1].trim();
    }

    return null;
  }

  function getPosition(text) {
    var match = POSITION_PATTERN.exec(text);

    if (!match) {
      return null;
    }

    return {
      x: parseInt(match[1], 10),
      y: parseInt(match[2], 10)
    };
  }

  function scanPvP(frameDocument) {
    var links = frameDocument.getElementsByTagName("a");
    var data = loadPlayerData();
    var changed = false;

    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var href = link.getAttribute("href") || "";

      if (href.indexOf("fight.php") === -1 || href.indexOf("watchuser") === -1) {
        continue;
      }

      var lineText = getLineText(link);

      if (!lineText) {
        continue;
      }

      var username = getUsername(lineText);

      if (!username) {
        continue;
      }

      if (!data[username]) {
        data[username] = {};
      }

      data[username].pvp = lineText.indexOf("PvP deaktiviert") === -1;
      data[username].timestamp = Date.now();

      changed = true;
    }

    if (changed) {
      savePlayerData(data);
    }
  }

  function removeOldDecoration(element) {
    var areas = element.querySelectorAll(".user-pos-observer-area");
    var swords = element.querySelectorAll(".user-pos-observer-pvp");

    for (var i = 0; i < areas.length; i++) {
      areas[i].remove();
    }

    for (var i = 0; i < swords.length; i++) {
      swords[i].remove();
    }

    element.classList.remove("user-pos-observer-highlight");
    element.style.backgroundColor = "";
    element.style.borderRadius = "";
    element.style.padding = "";
  }

  function decorateCoordinate(element, x, y, username) {
    var areaName = getAreaName(x, y);
    var data = loadPlayerData();
    var player = data[username];
    var isStale = player &&
      player.positionTimestamp &&
      Date.now() - player.positionTimestamp >= POSITION_STALE_TIME;

    removeOldDecoration(element);

    element.classList.add("user-pos-observer-highlight");

    if (!isSecureLocation(x, y)) {
      if (player.pvp) {
        element.style.backgroundColor = isStale ? "#661f1f" : "#4b3566";
      } else {
        element.style.backgroundColor = isStale ? "#665500" : "#444444";
      }
    }

    element.style.borderRadius = "2px";
    element.style.padding = "0 2px";

    if (areaName) {
      var areaElement = element.ownerDocument.createElement("span");

      areaElement.className = "user-pos-observer-area";
      areaElement.textContent = " [" + areaName + "]";

      element.appendChild(areaElement);
    }

    if (player && player.pvp) {
      var swordElement = element.ownerDocument.createElement("span");

      swordElement.className = "user-pos-observer-pvp";
      swordElement.textContent = " ⚔";
      swordElement.style.color = "#ff4444";
      swordElement.title = "PvP aktiv";

      element.appendChild(swordElement);
    }
  }

  function decorateTextNode(textNode) {
    var position = getPosition(textNode.nodeValue);

    if (!position) {
      return;
    }

    var lineText = getLineText(textNode);
    var username = getUsername(lineText);

    if (!username) {
      return;
    }

    rememberPosition(username, position.x, position.y);

    var parent = textNode.parentElement;

    if (
      parent &&
      (
        parent.classList.contains("target-navigation-coordinate") ||
        parent.classList.contains("user-pos-observer-highlight")
      )
    ) {
      decorateCoordinate(parent, position.x, position.y, username);
      return;
    }

    var document = textNode.ownerDocument;
    var text = textNode.nodeValue;
    var positionMatch = POSITION_PATTERN.exec(text);

    if (!positionMatch) {
      return;
    }

    var fragment = document.createDocumentFragment();

    if (positionMatch.index > 0) {
      fragment.appendChild(
        document.createTextNode(
          text.substring(0, positionMatch.index)
        )
      );
    }

    var span = document.createElement("span");

    span.className = "user-pos-observer-highlight";
    span.textContent = positionMatch[0];

    decorateCoordinate(span, position.x, position.y, username);

    fragment.appendChild(span);

    if (positionMatch.index + positionMatch[0].length < text.length) {
      fragment.appendChild(
        document.createTextNode(
          text.substring(positionMatch.index + positionMatch[0].length)
        )
      );
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  function scanPositions(frameDocument) {
    var walker = frameDocument.createTreeWalker(frameDocument.body, NodeFilter.SHOW_TEXT);
    var textNodes = [];
    var node;

    while ((node = walker.nextNode())) {
      var parent = node.parentNode;

      if (!parent) {
        continue;
      }

      if (
        parent.nodeName === "SCRIPT" ||
        parent.nodeName === "STYLE" ||
        parent.nodeName === "TEXTAREA" ||
        parent.nodeName === "INPUT" ||
        parent.nodeName === "BUTTON"
      ) {
        continue;
      }

      if (
        node.nodeValue.indexOf("X:") === -1 ||
        node.nodeValue.indexOf("Y:") === -1
      ) {
        continue;
      }

      textNodes.push(node);
    }

    for (var i = 0; i < textNodes.length; i++) {
      decorateTextNode(textNodes[i]);
    }
  }

  function scanFrame(frameName) {
    var frameElement = document.querySelector("frame[name=\"" + frameName + "\"]");

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
      scanPvP(frameDocument);
    }

    scanPositions(frameDocument);
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
