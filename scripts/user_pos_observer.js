(function () {
  var positionPattern = /(?:\(\s*X:\s*(-?\d+)\s+Y:\s*(-?\d+)\s*\)|Position\s+X:\s*(-?\d+)\s+Y:\s*(-?\d+))/g;

  function scanFrame(frameName) {
    var frame = window.frames[frameName];
    if (!frame || !frame.document || !frame.document.body) { return; }

    var walker = frame.document.createTreeWalker(frame.document.body, NodeFilter.SHOW_TEXT);

    var textNodes = [];
    var node;

    while (node = walker.nextNode()) {
      if (node.parentElement && node.parentElement.closest(".user-pos-observer-highlight")) {
        continue;
      }

      if (positionPattern.test(node.nodeValue)) {
        textNodes.push(node);
      }

      positionPattern.lastIndex = 0;
    }

    textNodes.forEach(function (textNode) {
      highlightPositions(textNode);
    });
  }

  function highlightPositions(textNode) {
    var text = textNode.nodeValue;
    var fragment = document.createDocumentFragment();
    var lastIndex = 0;
    var match;

    positionPattern.lastIndex = 0;

    while (match = positionPattern.exec(text)) {
      var x = match[1] !== undefined ? match[1] : match[3];
      var y = match[2] !== undefined ? match[2] : match[4];

      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }

      var span = document.createElement("span");

      span.className = "user-pos-observer-highlight";
      span.style.backgroundColor = "#f4cccc";
      span.style.borderRadius = "2px";
      span.style.padding = "0 2px";
      span.textContent = match[0];
      span.title = "Position: X " + x + " Y " + y;

      fragment.appendChild(span);

      lastIndex = positionPattern.lastIndex;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  function scan() {
    scanFrame("mainFrame");
    scanFrame("itemFrame");
  }

  setInterval(scan, 200);
})();
