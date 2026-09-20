// ==UserScript==
// @name        aka_limit_display
// @namespace   Zabuza
// @description Shows details for the Akademielimit for Freewar
// @include     *.freewar.de/freewar/internal/item.php*
// @version     1
// ==/UserScript==

(function () {
  var akaElement = document.querySelector("#listrow_aka_battlep");
  var akaLimit = parseInt(akaElement.textContent.replace(/\./g, "").match(/\d+/)[0], 10);

  var xpElement = document.querySelector(".listcaption");
  var xpText = xpElement.textContent.replace(/\./g, "");
  var xp = parseInt(xpText.match(/Erfahrung:\s*(\d+)/)[1], 10);

  var percentage = Math.floor((akaLimit / xp) * 100);

  console.log(percentage + "%");
})();
