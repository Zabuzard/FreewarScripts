// ==UserScript==
// @name        quick_heal
// @namespace   Zabuza
// @description Adds a quick-heal symbol next to lifepoints
// @include     *.freewar.de/freewar/internal/item.php*
// @version     1
// ==/UserScript==

(function () {
  var healingItemId = 247183437;

  var lifeRow = document.getElementById("listrow_lifep");
  if (!lifeRow) { return; }

  var lifeLabel = lifeRow.querySelector("b");
  if (!lifeLabel || lifeLabel.textContent.trim() !== "Lebenspunkte:") { return; }

  var lifeDisplay = document.getElementById("itemlpdisp");
  if (!lifeDisplay) { return; }

  var lifePercent = parseFloat(lifeDisplay.getAttribute("data-percent"));
  if (isNaN(lifePercent)) { return; }

  lifeLabel.textContent = "LP";

  var colon = document.createTextNode(": ");
  var healLink = document.createElement("a");

  healLink.href = "item.php?action=activate&act_item_id=" + healingItemId + "&itemcheckid=0";
  healLink.onclick = function () {
    this.href += "&yscroll=" + window.pageYOffset;
    this.href = this.href.replace(
      /(itemcheckid=)[0-9]+/,
      "$1" + Math.floor(((getServerTimeOffset() || 0) + Date.now()) / 1000)
    );
  };

  healLink.textContent = "✚";
  healLink.title = "Heilen";
  healLink.style.color = lifePercent > 50 ? "#888888" : "#66FF66";
  healLink.style.fontSize = "1.5em";

  lifeLabel.appendChild(document.createTextNode(" ("));
  lifeLabel.appendChild(healLink);
  lifeLabel.appendChild(document.createTextNode(")"));

  lifeRow.insertBefore(colon, lifeDisplay);

  function getServerTimeOffset() {
    var frame = window;

    while (frame.parent !== frame) {
      if (frame.parent.frames["reloadChatFrame"]) {
        return frame.parent.frames["reloadChatFrame"].server_time_offset || 0;
      }
      frame = frame.parent;
    }

    return 0;
  }
})();
