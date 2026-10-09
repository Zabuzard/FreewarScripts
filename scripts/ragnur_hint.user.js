// ==UserScript==
// @name        ragnur_hint
// @namespace   Zabuza
// @description Displays a hint in the banner when breaking into the cave in Ragnur becomes easy.
// @include     *.freewar.de/freewar/internal/topheader.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var HINT_ID = "ragnur-hint";
  var HINT_PREFIX = "Ragnur: ";
  var STORAGE_KEY = "ragnur_hint_players_online";
  var COOKIE_KEY = "ragnur_hint_players_online";
  var MAX_PLAYERS = 70;

  var FIELD_PLAYER_DATA = [
    [13, 4],
    [20, 5],
    [33, 5],
    [38, 6],
    [47, 6],
    [52, 6],
    [57, 7],
    [63, 7],
    [65, 7],
    [68, 7],
    [74, 8],
    [95, 9],
    [102, 9],
    [114, 10],
    [145, 12],
    [149, 12],
    [151, 12],
    [159, 12],
    [209, 13]
  ];

  function getWorld() {
    var match = window.location.hostname.match(/^([^.]+)\.freewar\.de$/i);

    return match ? match[1] : null;
  }

  function getCookie(name) {
    var prefix = name + "=";
    var cookies = document.cookie.split(";");

    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].trim();

      if (cookie.indexOf(prefix) === 0) {
        return decodeURIComponent(cookie.substring(prefix.length));
      }
    }

    return null;
  }

  function getStoredCount() {
    try {
      var count = localStorage.getItem(STORAGE_KEY);

      if (count !== null && /^\d+$/.test(count)) {
        return count;
      }
    } catch (error) {
      // Fall back to cookies if localStorage is unavailable.
    }

    var cookieCount = getCookie(COOKIE_KEY);

    if (cookieCount !== null && /^\d+$/.test(cookieCount)) {
      return cookieCount;
    }

    return null;
  }

  function saveCount(count) {
    try {
      localStorage.setItem(STORAGE_KEY, count);
      return;
    } catch (error) {
      // Fall back to cookies if localStorage is unavailable.
    }

    document.cookie = COOKIE_KEY + "=" + encodeURIComponent(count) +
      "; path=/; max-age=7200; SameSite=Lax";
  }

  function getFieldPlayers(count) {
    var first = FIELD_PLAYER_DATA[0];
    var last = FIELD_PLAYER_DATA[FIELD_PLAYER_DATA.length - 1];

    if (count < first[0] || count > last[0]) {
      return Math.round(
        -0.0001198 * count * count +
        0.07601 * count +
        2.888
      );
    }

    for (var i = 0; i < FIELD_PLAYER_DATA.length; i++) {
      if (count === FIELD_PLAYER_DATA[i][0]) {
        return FIELD_PLAYER_DATA[i][1];
      }

      if (count < FIELD_PLAYER_DATA[i][0]) {
        var lower = FIELD_PLAYER_DATA[i - 1];
        var upper = FIELD_PLAYER_DATA[i];

        var ratio = (count - lower[0]) / (upper[0] - lower[0]);
        var interpolated = lower[1] +
          ratio * (upper[1] - lower[1]);

        return Math.round(interpolated);
      }
    }

    return last[1];
  }

  function addHint() {
    var hint = document.getElementById(HINT_ID);
    var count = getStoredCount();

    if (count === null || Number(count) > MAX_PLAYERS) {
      if (hint) {
        hint.remove();
      }

      return;
    }

    var fieldPlayers = getFieldPlayers(Number(count));
    var text = HINT_PREFIX + fieldPlayers;

    if (hint && hint.textContent === text) {
      return;
    }

    if (!hint) {
      hint = document.createElement("div");
      hint.id = HINT_ID;

      hint.style.position = "fixed";
      hint.style.bottom = "0px";
      hint.style.left = "5px";
      hint.style.color = "#b8b4b0";
      hint.style.fontSize = "12px";
      hint.style.fontFamily = "Arial, sans-serif";
      hint.style.zIndex = "9999";
      hint.style.pointerEvents = "none";

      document.body.appendChild(hint);
    }

    hint.textContent = text;
  }

  function isHintMutation(mutation) {
    var hint = document.getElementById(HINT_ID);

    if (!hint) {
      return false;
    }

    if (hint.contains(mutation.target)) {
      return true;
    }

    var nodes = [
      ...mutation.addedNodes,
      ...mutation.removedNodes
    ];

    return nodes.length > 0 && nodes.every(function (node) {
      return node === hint || (node.nodeType === 1 && node.contains(hint));
    });
  }

  function updateOnlineCount() {
    var world = getWorld();

    if (!world) {
      return Promise.resolve();
    }

    var url = window.location.protocol + "//" + world +
      ".freewar.de/freewar/players_online.php";

    return fetch(url, { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to fetch online player count.");
        }

        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var lines = doc.body.innerHTML.split("<br>");

        if (lines.length >= 2) {
          var match = lines[1].match(/^\s*(\d+)\s+Spieler online\s*$/i);

          if (match) {
            saveCount(match[1]);
            addHint();
          }
        }
      })
      .catch(function () {
        // Keep the last stored count if the request fails.
      });
  }

  function startObserver() {
    addHint();

    var observer = new MutationObserver(function (mutations) {
      if (mutations.some(function (mutation) {
        return !isHintMutation(mutation);
      })) {
        addHint();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    setInterval(addHint, 200);
  }

  function startOnlineCountRoutine() {
    var requestInProgress = false;

    function pollOnlineCount() {
      if (requestInProgress) {
        return;
      }

      requestInProgress = true;

      updateOnlineCount().then(function () {
        requestInProgress = false;
      });
    }

    setInterval(pollOnlineCount, 60000);
    pollOnlineCount();
  }

  if (document.body) {
    startObserver();
    startOnlineCountRoutine();
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      startObserver();
      startOnlineCountRoutine();
    });
  }
})();
