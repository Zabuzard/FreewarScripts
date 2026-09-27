// ==UserScript==
// @name        quallenglibber
// @namespace   Zabuza
// @description Extracts and forwards massive Landqualle relevant events to the Quallenglibber Tool Server
// @include     *.freewar.de/freewar/internal/chattext.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var endpoint = "http://localhost:8628/quallenglibber";
  var lastTimestamp = null;
  var healedPatterns = [
    /massive Landqualle hat sich an die Angriffe von .+ angepasst und heilt sich durch den Angriff vollständig/,
    /massive Landqualle heilt sich komplett an der geschwächten Seele von/,
    /massive Landqualle heilt sich komplett hinter ihrem magischen Schutzschild/
  ];

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

    var match = text.match(/^(.+?) führt einen Schlag gegen massive Landqualle aus, zieht/);
    if (match) {
      var user = match[1].trim();
      fetch(endpoint + "/hit?user=" + encodeURIComponent(user) + "&ts=" + epochMillis, { method: "GET", mode: "no-cors" }).catch(function () {/* Fire-and-forget: ignore connection errors */});
      return;
    }

    for (var i = 0; i < healedPatterns.length; i++) {
      if (healedPatterns[i].test(text)) {
        fetch(endpoint + "/healed?ts=" + epochMillis, { method: "GET", mode: "no-cors" }).catch(function () {/* Fire-and-forget: ignore connection errors */});
        return;
      }
    }

    if (text.indexOf("massive Landqualle aktiviert ein magisches Schutzschild") !== -1) {
      fetch(endpoint + "/protection?active=1&ts=" + epochMillis, { method: "GET", mode: "no-cors" }).catch(function () {/* Fire-and-forget: ignore connection errors */});
      return;
    }
    
    if (text.indexOf("Der magische Schutz von massive Landqualle wurde entfernt") !== -1) {
      fetch(endpoint + "/protection?active=0&ts=" + epochMillis, { method: "GET", mode: "no-cors" }).catch(function () {/* Fire-and-forget: ignore connection errors */});
      return;
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
