// ==UserScript==
// @name        soul_vision
// @namespace   Zabuza
// @description Extends the visibility of soul vision effects on the map (e.g. Seelenkapsel)
// @include     *.freewar.de/freewar/internal/map.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var STORAGE_KEY = "soul_vision_npcs";
  var NPC_EXPIRATION = 5 * 60 * 1000;
  var SCAN_INTERVAL = 200;
  var SOUL_VISION_CLASS = "soul-vision-npcs";
  var SOUL_VISION_COLOR = "#AA44FF";

  var lastSnapshot = "";

  function loadNPCs() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        var parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") { return parsed; }
      }
    } catch (error) {
      // Fall back to cookies below.
    }

    try {
      var match = document.cookie.match(new RegExp("(?:^|; )" + STORAGE_KEY + "=([^;]*)"));

      if (match) { return JSON.parse(decodeURIComponent(match[1])); }
    } catch (error) {
      // No usable stored data.
    }

    return {};
  }

  function saveNPCs(npcs) {
    var value = JSON.stringify(npcs);

    try {
      localStorage.setItem(STORAGE_KEY, value);
      return;
    } catch (error) {
      // Fall back to cookies below.
    }

    try {
      document.cookie = STORAGE_KEY + "=" + encodeURIComponent(value) + "; max-age=" + (NPC_EXPIRATION / 1000) + "; path=/";
    } catch (error) {
      // Storage unavailable.
    }
  }

  function removeSoulVisionMarkers() {
    var markers = document.querySelectorAll("g." + SOUL_VISION_CLASS);

    markers.forEach(function (marker) {
      marker.remove();
    });
  }

  function scanMap() {
    var now = Date.now();
    var npcs = loadNPCs();
    var cells = document.querySelectorAll("table.maptable td[id^='mapx']");

    cells.forEach(function (cell) {
      var match = cell.id.match(/^mapx(-?\d+)y(-?\d+)$/);
      if (!match) { return; }

      var key = match[1] + "," + match[2];
      var svg = cell.querySelector("svg.mapstate");

      if (!svg) { return; }

      var marker = svg.querySelector("g.npcs");

      // NPC marker exists: keep using the NPC information.
      if (marker) {
        var texts = marker.querySelectorAll("text");
        var count = 0;

        texts.forEach(function (text) {
          var value = text.textContent.trim();

          if (/^\d+$/.test(value)) {
            count = Math.max(count, parseInt(value, 10));
          }
        });

        if (count <= 0) { return; }

        var previous = npcs[key];

        if (!previous || count >= previous.count) {
          npcs[key] = {
            x: parseInt(match[1], 10),
            y: parseInt(match[2], 10),
            count: count,
            timestamp: now
          };
        }

        return;
      }

      // No NPC marker, but players or the user are present:
      // remove the cached NPC.
      var players = svg.querySelector("g.players");
      var user = svg.querySelector("path.user");

      if (players || user) {
        delete npcs[key];
      }
    });

    // Remove entries that have expired.
    Object.keys(npcs).forEach(function (key) {
      if (!npcs[key] || !npcs[key].timestamp || now - npcs[key].timestamp >= NPC_EXPIRATION) {
        delete npcs[key];
      }
    });

    var snapshot = JSON.stringify(npcs);

    if (snapshot !== lastSnapshot) {
      saveNPCs(npcs);
      lastSnapshot = snapshot;
    }

    displayNPCs(npcs);
  }

  function displayNPCs(npcs) {
    var cells = document.querySelectorAll("table.maptable td[id^='mapx']");

    cells.forEach(function (cell) {
      var match = cell.id.match(/^mapx(-?\d+)y(-?\d+)$/);
      if (!match) { return; }

      var key = match[1] + "," + match[2];
      var svg = cell.querySelector("svg.mapstate");

      if (!svg) { return; }

      var saved = npcs[key];
      var nativeMarker = svg.querySelector("g.npcs");
      var savedMarker = svg.querySelector("g." + SOUL_VISION_CLASS);

      // A native NPC marker takes precedence.
      if (nativeMarker) {
        if (savedMarker) { savedMarker.remove(); }
        return;
      }

      // No saved NPC: remove any previously displayed marker.
      if (!saved) {
        if (savedMarker) { savedMarker.remove(); }
        return;
      }

      // A saved marker already exists. Update its count if necessary.
      if (savedMarker) {
        var texts = savedMarker.querySelectorAll("text");

        texts.forEach(function (text) {
          text.textContent = saved.count;
        });

        return;
      }

      // Display the cached NPC marker.
      var marker = document.createElementNS("http://www.w3.org/2000/svg", "g");
      marker.setAttribute("data-tilenum", "6");
      marker.setAttribute("class", SOUL_VISION_CLASS);

      var outline = document.createElementNS("http://www.w3.org/2000/svg", "text");
      outline.setAttribute("style", "stroke-width: 2.5px; stroke: " + SOUL_VISION_COLOR + ";");
      outline.setAttribute("x", "1");
      outline.setAttribute("y", "47");
      outline.textContent = saved.count;

      var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("style", "fill: white;");
      text.setAttribute("x", "1");
      text.setAttribute("y", "47");
      text.textContent = saved.count;

      marker.appendChild(outline);
      marker.appendChild(text);
      svg.appendChild(marker);
    });
  }

  removeSoulVisionMarkers();
  scanMap();
  window.setInterval(scanMap, SCAN_INTERVAL);

  var mapObserver = new MutationObserver(function () { scanMap(); });
  var map = document.querySelector("table.maptable");
  if (map) { mapObserver.observe(map, { childList: true, subtree: true, characterData: true, attributes: true }); }
})();
