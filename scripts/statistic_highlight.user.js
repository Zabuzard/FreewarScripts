// ==UserScript==
// @name        statistic_highlight
// @namespace   Zabuza
// @description Highlights certain messages in the statistics menu.
// @include     *.freewar.de/freewar/internal/main.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var mainCaption = document.querySelector(".maincaption");
  if (!mainCaption || mainCaption.textContent.trim() !== "Statistiken") { return; }

  var highlightColor = "#ffcccc";

  function highlightRow(row) {
    row.style.backgroundColor = highlightColor;
  }

  function findRowsContaining(text) {
    return Array.from(document.querySelectorAll("p.listrow")).filter(function (row) {
      return row.textContent.indexOf(text) !== -1;
    });
  }

  function findRowsMatching(pattern) {
    return Array.from(document.querySelectorAll("p.listrow")).filter(function (row) {
      return pattern.test(row.textContent);
    });
  }

  function highlightStorage(message, requiredRatio) {
    findRowsContaining(message).forEach(function (row) {
      var match = row.textContent.match(new RegExp(message + "\\s*:\\s*(\\d+)\\s*/\\s*(\\d+)"));
      if (!match) { return; }

      var current = Number(match[1]);
      var capacity = Number(match[2]);
      if (capacity > 0 && current / capacity >= requiredRatio) {
        highlightRow(row);
      }
    });
  }

  highlightStorage("Glodo-Fische im Lager", 0.5);
  highlightStorage("Baru-Getreide im Lager", 0.5);
  highlightStorage("Ölfässer im Lager", 0.5);
  highlightStorage("Sumpfgasflaschen im Lager", 0.5);

  [
    /Turm der inneren Macht auf Stufe 9/,
    /Du kannst jetzt deine Förderung bei der Stiftung abholen\./,
    /Nächste Wissenszauber-Abholung in .+ wieder möglich\./,
    /In .+ wird der Zähler für die Nebelprismen wieder zurückgesetzt\./,
    /Du kannst dich erst in .+ wieder mit Flugkreide bestreuen lassen/
  ].forEach(function (pattern) {
    findRowsMatching(pattern).forEach(highlightRow);
  });
})();
