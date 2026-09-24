// ==UserScript==
// @name        weapon_swap
// @namespace   Zabuza
// @description Shows configurable symbols to fast-swap weapons
// @include     *.freewar.de/freewar/internal/item.php*
// @version     1
// ==/UserScript==

(function () {
  var weapons = [ // Configure this to your needs
    { id: 804446727, icon: "⇄", color: "#FFFFFF" },
    { id: 247183416, icon: "🐟", color: "#66CCFF" }
  ];

  var weaponRow = document.getElementById("listrow_attackw");
  var defenseRow = document.getElementById("listrow_defensew");
  if (!weaponRow) { return; }

  var weaponLink = weaponRow.querySelector('a[href="item.php?action=aselect"]');
  if (!weaponLink) { return; }

  var weaponName = weaponLink.nextSibling;
  if (weaponName) {
    weaponName.parentNode.style.fontSize = "0.85em";
  }

  if (defenseRow) {
    var defenseLink = defenseRow.querySelector('a[href="item.php?action=dselect"]');
    if (defenseLink) {
      var defenseName = defenseLink.nextSibling;
      if (defenseName) {
        defenseName.parentNode.style.fontSize = "0.85em";
      }
    }
  }

  var parent = weaponLink.parentNode;

  parent.insertBefore(document.createTextNode(" ("), weaponName);

  weapons.forEach(function (weapon, index) {
    var link = document.createElement("a");

    link.href = "item.php?action=activate&act_item_id=" + weapon.id + "&itemcheckid=0";
    link.onclick = function () {
      this.href += "&yscroll=" + window.pageYOffset;
      this.href = this.href.replace(
        /(itemcheckid=)[0-9]+/,
        "$1" + Math.floor(((parent.frames.reloadChatFrame.server_time_offset || 0) + Date.now()) / 1000)
      );
    };

    link.textContent = weapon.icon;
    link.title = "Waffen wechseln";
    link.style.color = weapon.color;
    link.style.fontSize = "1.5em";

    parent.insertBefore(link, weaponName);

    if (index < weapons.length - 1) {
      parent.insertBefore(document.createTextNode(", "), weaponName);
    }
  });

  parent.insertBefore(document.createTextNode(")"), weaponName);
})();
