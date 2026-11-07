// ==UserScript==
// @name        exit_tool
// @namespace   Zabuza
// @description Adds an exit link ("Zurück") at the top and right edge of tools like Schriftrolle der Lebenenden
// @include     *.freewar.de/freewar/internal/item.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var CONTENT_MARKERS = [
    "Lebende Wesen an der Oberfläche dieser Welt",
    "Lebende Wesen in deinem Umkreis von"
  ];
  var LINK_CLASS = "exit-tool-back-link";
  var STRIP_CLASS = "exit-tool-right-strip";

  function addBackLink() {
    if (!CONTENT_MARKERS.some(function (marker) {
      return document.body.innerText.includes(marker);
    })) {
      return;
    }

    // Find the original "Zurück" link at the bottom.
    var originalLink = Array.from(document.querySelectorAll("a")).find(function (link) {
      return link.textContent.trim().toLowerCase() === "zurück";
    });

    // Find the Lebenspunkte header.
    var topLpHeader = document.getElementById("toplpheader");

    if (!originalLink || !topLpHeader) {
      return;
    }

    // Increase the font size of the original link.
    originalLink.style.fontSize = "20px";

    // Add the top back link if it does not exist yet.
    if (!document.querySelector("." + LINK_CLASS)) {
      var newLink = originalLink.cloneNode(true);
      newLink.classList.add(LINK_CLASS);
      newLink.style.fontSize = "20px";

      // Insert the link directly after the Lebenspunkte header.
      var lineBreak1 = document.createElement("br");
      var lineBreak2 = document.createElement("br");
      var lineBreak3 = document.createElement("br");

      topLpHeader.after(lineBreak1, newLink, lineBreak2, lineBreak3);
    }

    // Add a full-height clickable strip on the right edge.
    if (!document.querySelector("." + STRIP_CLASS)) {
      var rightStrip = originalLink.cloneNode(true);
      rightStrip.textContent = "";
      rightStrip.classList.add(STRIP_CLASS);
      rightStrip.setAttribute("aria-label", "Zurück");
      rightStrip.title = "Zurück";

      rightStrip.style.position = "fixed";
      rightStrip.style.top = "0";
      rightStrip.style.right = "0";
      rightStrip.style.width = "25px";
      rightStrip.style.height = "100vh";
      rightStrip.style.zIndex = "99999";
      rightStrip.style.backgroundColor = "rgb(64, 69, 74)";
      rightStrip.style.borderLeft = "1px solid #526477";
      rightStrip.style.borderRadius = "3px 0 0 3px";
      rightStrip.style.cursor = "pointer";
      rightStrip.style.transition = "background-color 150ms ease, border-color 150ms ease";

      rightStrip.addEventListener("mouseenter", function () {
        rightStrip.style.backgroundColor = "rgb(52, 62, 72)";
        rightStrip.style.borderLeftColor = "#8296aa";
      });

      rightStrip.addEventListener("mouseleave", function () {
        rightStrip.style.backgroundColor = "rgb(64, 69, 74)";
        rightStrip.style.borderLeftColor = "#526477";
      });

      document.body.appendChild(rightStrip);
    }
  }

  var observer = new MutationObserver(function (mutations) {
    // Ignore mutations caused exclusively by our own elements.
    var relevantMutation = mutations.some(function (mutation) {
      return !(
        mutation.type === "childList" &&
        Array.from(mutation.addedNodes).every(function (node) {
          return node.nodeType === Node.ELEMENT_NODE &&
            (
              node.classList.contains(LINK_CLASS) ||
              node.classList.contains(STRIP_CLASS) ||
              node.tagName === "BR"
            );
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
