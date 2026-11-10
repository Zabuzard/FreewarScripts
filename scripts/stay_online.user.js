// ==UserScript==
// @name        stay_online
// @namespace   Zabuza
// @description Automatically refreshes the frame after a random 10–14 minutes to stay logged in (refresh is not visible to others)
// @include     *.freewar.de/freewar/internal/menu.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var delay = (10 + Math.random() * 4) * 60 * 1000;

  setTimeout(function () {
    var link = Array.from(document.getElementsByTagName("a")).find(function (a) {
      return a.textContent.trim() === "Aktualisieren";
    });

    if (link) {
      link.click();
    }
  }, delay);
})();
