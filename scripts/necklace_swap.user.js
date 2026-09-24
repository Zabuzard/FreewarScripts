// ==UserScript==
// @name        necklace_swap
// @namespace   Zabuza
// @description Shows configurable symbols to fast-swap necklaces
// @include     *.freewar.de/freewar/internal/item.php*
// @version     1
// ==/UserScript==

(function () {
  var necklaces = [ // Configure this to your needs
    { id: 247183403, icon: "⌛", color: "#C49A6C" },
    { id: 247183421, icon: "❄", color: "#66CCFF" },
    { id: 247183401, icon: "🔥", color: "#FF6600" },
    { id: 247183479, icon: "★", color: "#FFD700" }
  ];

  var neckRow = document.getElementById("listrow_neck");
  if (!neckRow) { return; }

  var neckLink = neckRow.querySelector('a[href="item.php?action=hselect"]');
  if (!neckLink) { return; }

  var neckName = document.getElementById("listrow_neck_name");
  if (neckName) {
    neckName.style.fontSize = "0.85em";
  }

  var parent = neckLink.parentNode;
  var textNode = neckLink.nextSibling;

  parent.insertBefore(document.createTextNode(" ("), textNode);

  necklaces.forEach(function (necklace, index) {
    var link = document.createElement("a");

    link.href = "item.php?action=activate&act_item_id=" + necklace.id + "&itemcheckid=0";
    link.onclick = function () {
      this.href += "&yscroll=" + window.pageYOffset;
      this.href = this.href.replace(
        /(itemcheckid=)[0-9]+/,
        "$1" + Math.floor(((parent.frames.reloadChatFrame.server_time_offset || 0) + Date.now()) / 1000)
      );
    };

    link.textContent = necklace.icon;
    link.title = "Halsschmuck wechseln";
    link.style.color = necklace.color;
    link.style.fontSize = "1.5em";

    parent.insertBefore(link, textNode);

    if (index < necklaces.length - 1) {
      parent.insertBefore(document.createTextNode(", "), textNode);
    }
  });

  parent.insertBefore(document.createTextNode(")"), textNode);
})();
