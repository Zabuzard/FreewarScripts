// ==UserScript==
// @name        weapon_swap
// @namespace   Zabuza
// @description Shows configurable symbols to fast-swap weapons
// @include     *.freewar.de/freewar/internal/item.php*
// @version     1
// ==/UserScript==

(function () {
  // Configure your weapons here
  var attackWeapon = { name: "schwebender Kristalldolch", id: 804446727 };
  var defenseWeapon = { name: "Goldplattenschild", id: 302894989 };
  var divingSuit = { name: "Taucheranzug", id: 247183416 };

  var weaponRow = document.getElementById("listrow_attackw");
  var defenseRow = document.getElementById("listrow_defensew");
  if (!weaponRow || !defenseRow) { return; }

  var weaponLink = weaponRow.querySelector('a[href="item.php?action=aselect"]');
  var defenseLink = defenseRow.querySelector('a[href="item.php?action=dselect"]');
  if (!weaponLink || !defenseLink) { return; }

  weaponLink.textContent = "A-Waffe";
  defenseLink.textContent = "V-Waffe";

  var weaponLabel = weaponLink.parentNode;
  var defenseLabel = defenseLink.parentNode;

  var weaponColon = weaponLink.nextSibling;
  var defenseName = defenseLabel.nextSibling;
  var weaponName = weaponLabel.nextSibling;

  if (weaponName && weaponName.nodeType === Node.TEXT_NODE) {
    var weaponNameSpan = document.createElement("span");
    weaponNameSpan.style.fontSize = "0.7em";
    weaponNameSpan.textContent = weaponName.nodeValue;
    weaponName.parentNode.replaceChild(weaponNameSpan, weaponName);
    weaponName = weaponNameSpan;
  }

  if (defenseName && defenseName.nodeType === Node.TEXT_NODE) {
    var defenseNameSpan = document.createElement("span");
    defenseNameSpan.style.fontSize = "0.7em";
    defenseNameSpan.textContent = defenseName.nodeValue;
    defenseName.parentNode.replaceChild(defenseNameSpan, defenseName);
    defenseName = defenseNameSpan;
  }

  weaponLabel.insertBefore(document.createTextNode(" ("), weaponColon);

  var swapLink = document.createElement("a");
  swapLink.href = "#";
  swapLink.textContent = "⇄";
  swapLink.title = "Waffen ab-/anlegen";
  swapLink.style.color = "#FFFFFF";
  swapLink.style.fontSize = "1.5em";

  swapLink.onclick = function (event) {
    event.preventDefault();

    var currentAttack = weaponName.textContent.trim();
    var currentDefense = defenseName.textContent.trim();

    var attackRuns = 0;
    var defenseRuns = 0;

    if (currentAttack === "keine" && currentDefense === "keine") {
      attackRuns = 1;
      defenseRuns = 1;
    } else {
      if (currentAttack === attackWeapon.name) {
        attackRuns = 1;
      } else if (currentAttack !== "keine") {
        attackRuns = 2;
      }

      if (currentDefense === defenseWeapon.name) {
        defenseRuns = 1;
      } else if (currentDefense !== "keine") {
        defenseRuns = 2;
      }
    }

    var requests = [];
    for (var i = 0; i < attackRuns; i++) {
      requests.push(activateItem(attackWeapon.id));
    }
    for (var i = 0; i < defenseRuns; i++) {
      requests.push(activateItem(defenseWeapon.id));
    }
    Promise.all(requests).then(function () { window.location.reload(); });
  };

  weaponLabel.insertBefore(swapLink, weaponColon);
  weaponLabel.insertBefore(document.createTextNode(", "), weaponColon);

  var fishLink = document.createElement("a");
  fishLink.href = "#";
  fishLink.textContent = "🐟";
  fishLink.title = "Taucheranzug an-/ablegen";
  fishLink.style.color = "#66CCFF";
  fishLink.style.fontSize = "1.5em";

  fishLink.onclick = function (event) {
    event.preventDefault();

    var currentDefense = defenseName.textContent.trim();
    var id = currentDefense === divingSuit.name ? defenseWeapon.id : divingSuit.id;

    activateItem(id).then(function () { window.location.reload(); });
  };

  weaponLabel.insertBefore(fishLink, weaponColon);
  weaponLabel.insertBefore(document.createTextNode(")"), weaponColon);

  function activateItem(id) {
    var href = new URL("item.php?action=activate&act_item_id=" + id + "&itemcheckid=0", window.location.href);

    href.searchParams.set("yscroll", window.pageYOffset);
    href.searchParams.set("itemcheckid", Math.floor(Date.now() / 1000));

    return fetch(href.href, { credentials: "include" });
  }
})();
