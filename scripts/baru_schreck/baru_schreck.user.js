// ==UserScript==
// @name        baru_schreck
// @namespace   Zabuza
// @description Extracts and forwards Baru-Schrecke relevant events to the Baru-Schreck Tool Server
// @include     *.freewar.de/freewar/internal/chattext.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var endpoint = "http://localhost:8628/baru-schreck";
  var lastTimestamp = null;

  function processMessage(message) {
    var time = message.querySelector(".chattime");
    if (!time) { return; }

    var timestamp = time.getAttribute("title");
    if (!timestamp || (lastTimestamp !== null && timestamp <= lastTimestamp)) { return; }
    lastTimestamp = timestamp;

    var parts = timestamp.split(/[:.]/);
    var ts = new Date();
    ts.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10), parseInt(parts[3].substring(0, 3), 10));
    var epochMillis = ts.getTime();

    var text = message.cloneNode(true);
    var chatTime = text.querySelector(".chattime");
    if (chatTime) { chatTime.remove(); }
    text = text.textContent.trim();

    var match = text.match(/^(.+?) führt einen Schlag gegen Baru-Schrecke aus, zieht/);
    if (match) {
      var user = match[1].trim();
      fetch(endpoint + "/hit?user=" + encodeURIComponent(user) + "&ts=" + epochMillis, { method: "GET", mode: "no-cors" }).catch(function () {/* Fire-and-forget: ignore connection errors */});
      return;
    }

    if (text === "Baru-Schrecke heilt sich zwischen den Angriffen komplett.") {
      fetch(endpoint + "/healed?ts=" + epochMillis, { method: "GET", mode: "no-cors" }).catch(function () {/* Fire-and-forget: ignore connection errors */});
    }
  }

  function processMessages() {
    var messages = document.querySelectorAll("p");
    if (messages.length === 0) { return; }

    // Establish the newest timestamp already present on page load.
    var latestTimestamp = null;
    for (var i = 0; i < messages.length; i++) {
      var time = messages[i].querySelector(".chattime");

      if (!time) { continue; }
      var timestamp = time.getAttribute("title");

      if (timestamp && (latestTimestamp === null || timestamp > latestTimestamp)) {
        latestTimestamp = timestamp;
      }
    }

    lastTimestamp = latestTimestamp;
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes;

      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].nodeType === 1 && nodes[j].tagName === "P") {
          processMessage(nodes[j]);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  processMessages();
})();
