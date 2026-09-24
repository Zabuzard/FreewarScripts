// ==UserScript==
// @name        quick_heal
// @namespace   Zabuza
// @description Adds a quick-heal symbol next to lifepoints
// @include     *.freewar.de/freewar/internal/item.php*
// @version     1
// ==/UserScript==

(function () {
  var healingItemId = 1790279161;

  var lifeRow = document.getElementById("listrow_life");
  if (!lifeRow) { return; }

  var lifeLink = lifeRow.querySelector("a");
  if (!lifeLink || lifeLink.textContent.trim() !== "Lebenspunkte") { return; }

  var lifeText = lifeLink.nextSibling;
  if (!lifeText) { return; }

  var lifeMatch = lifeText.textContent.match(/:\s*([\d.]+)\s*\/\s*([\d.]+)/);
  if (!lifeMatch) { return; }

  var currentLife = parseInt(lifeMatch[1].replace(/\./g, ""), 10);
  var maxLife = parseInt(lifeMatch[2].replace(/\./g, ""), 10);

  var healLink = document.createElement("a");
  healLink.href = "item.php?action=activate&act_item_id=" + healingItemId + "&itemcheckid=0";
  healLink.onclick = function () {
    this.href += "&yscroll=" + window.pageYOffset;
    this.href = this.href.replace(
      /(itemcheckid=)[0-9]+/,
      "$1" + Math.floor(((lifeRow.parentNode.frames.reloadChatFrame.server_time_offset || 0) + Date.now()) / 1000)
    );
  };

  healLink.textContent = "✚";
  healLink.title = "Heilen";
  healLink.style.color = currentLife / maxLife > 0.5 ? "#888888" : "#66FF66";
  healLink.style.fontSize = "1.5em";

  lifeLink.parentNode.insertBefore(healLink, lifeText);
})();
