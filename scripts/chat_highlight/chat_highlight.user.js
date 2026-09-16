// ==UserScript==
// @name        chat_highlight
// @namespace   Zabuza
// @description Highlights certain chat messages.
// @include     *.freewar.de/freewar/internal/chattext.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var patterns = [/war da heute drinnen/i];

  function highlightMessages() {
    var messages = document.querySelectorAll("p");

    for (var i = 0; i < messages.length; i++) {
      var message = messages[i];
      var text = message.textContent;

      for (var j = 0; j < patterns.length; j++) {
        if (patterns[j].test(text)) {
          message.style.backgroundColor = "#ffff00";
          break;
        }
      }
    }
  }

  highlightMessages();
})();
