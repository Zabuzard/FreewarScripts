// ==UserScript==
// @name        necklace_swap
// @namespace   Zabuza
// @description Shows configurable symbols to fast-swap necklaces
// @include     *.freewar.de/freewar/internal/item.php*
// @version     1
// ==/UserScript==

(function () {
  var necklaces = [ // Configure this to your needs
    { id: 247183403, icon: "⌛" },
    { id: 247183421, icon: "❄" },
    { id: 247183401, icon: "🔥" },
    { id: 247183479, icon: "★" }
  ];

  var neckRow = document.getElementById("listrow_neck");
  var neckName = document.getElementById("listrow_neck_name");
  if (!neckRow || !neckName) { return; }
  var neckLink = neckRow.querySelector('a[href="item.php?action=hselect"]');
  if (!neckLink) { return; }

  necklaces.forEach(function (necklace) {
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
    link.title = "Hals wechseln";
    link.style.marginLeft = "4px";

    neckRow.insertBefore(link, neckName);
  });
})();
