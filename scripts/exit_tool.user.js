
// ==UserScript==
// @name        exit_tool
// @namespace   Zabuza
// @description Adds an exit link ("Zurück") at the top of tools like Schriftrolle der Lebenenden, so it can be left easier
// @include     *.freewar.de/freewar/internal/item.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var CONTENT_MARKER = "Lebende Wesen an der Oberfläche dieser Welt";
  var LINK_CLASS = "exit-tool-back-link";

  function addBackLink() {
    if (!document.body.innerText.includes(CONTENT_MARKER)) {
      return;
    }

    // Check whether our link already exists.
    if (document.querySelector("." + LINK_CLASS)) {
      return;
    }

    // Find the original "Zurück" link at the bottom.
    var originalLink = Array.from(document.querySelectorAll("a")).find(function (link) {
      return link.textContent.trim() === "Zurück";
    });

    // Find the Lebenspunkte header.
    var topLpHeader = document.getElementById("toplpheader");

    if (!originalLink || !topLpHeader) {
      return;
    }

    // Clone the original link and mark it as ours.
    var newLink = originalLink.cloneNode(true);
    newLink.classList.add(LINK_CLASS);
    newLink.style.fontSize = "18px";

    // Insert the link directly after the Lebenspunkte header.
    var lineBreak1 = document.createElement("br");
    var lineBreak2 = document.createElement("br");

    topLpHeader.after(lineBreak1, newLink, lineBreak2);
  }

  var observer = new MutationObserver(function (mutations) {
    // Ignore mutations caused exclusively by our own link insertion.
    var relevantMutation = mutations.some(function (mutation) {
      return !(
        mutation.type === "childList" &&
        Array.from(mutation.addedNodes).every(function (node) {
          return node.nodeType === Node.ELEMENT_NODE &&
            (node.classList.contains(LINK_CLASS) || node.tagName === "BR");
        })
      );
    });

    if (relevantMutation) {
      addBackLink();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // Initial check.
  addBackLink();
})();
