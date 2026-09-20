// ==UserScript==
// @name        chat_highlight
// @namespace   Zabuza
// @description Highlights certain chat messages.
// @include     *.freewar.de/freewar/internal/chattext.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var patterns = [
    /.*?Stachel-Kowu belebt das.*?Stachel-Kowu wieder/i,
    /Massive Landqualle aktiviert ein magisches Schutzschild/i,
    /Behüter der Kathedrale zerbricht die Angriffswaffe/i,
    /flimmernde Farbanomalie richtet ihre vier Augen auf/i,
    /nimmt das Item Briefbeschwerer durch einen Beutezauber auf/i,
    /nimmt das Item Plan der Jerodar durch einen Beutezauber auf/i,
    /doch dann siehst du, dass es der Juwelenring der Familie Gruan ist, schön und sauber geputzt/i
  ];

  function highlightMessage(message) {
    var text = message.textContent;

    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].test(text)) {
        message.style.backgroundColor = "rgba(255, 120, 120, 0.3)";
        break;
      }
    }
  }

  function highlightMessages() {
    var messages = document.querySelectorAll("p");

    for (var i = 0; i < messages.length; i++) {
      highlightMessage(messages[i]);
    }
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes;

      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].nodeType === 1 && nodes[j].tagName === "P") {
          highlightMessage(nodes[j]);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  highlightMessages();
})();
