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
  var MAX_PLAYERS = 55;

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

  function addHint() {
    var hint = document.getElementById(HINT_ID);
    var count = getStoredCount();

    if (count === null || Number(count) > MAX_PLAYERS) {
      if (hint) {
        hint.remove();
      }

      return;
    }

    var requiredPlayers = Math.round(18.88 * Number(count) - 68.95);
    var text = HINT_PREFIX + requiredPlayers;

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
