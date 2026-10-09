
 // ==UserScript==
 // @name        mobile_landscape_frameset
 // @namespace   Zabuza
 // @description Improves the layout of the mobile (compact) version of Freewar.
 // @include     *.freewar.de/freewar/internal/frcompact.php*
 // @version     2
 // @grant       none
 // ==/UserScript==

(function () {
  var content = document.querySelector(".content");
  if (!content) { return; }

  var style = document.createElement("style");
  style.textContent = `
    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }

    body {
      overflow: auto;
    }

    .content {
      width: 100%;
      font-size: 4em;
      text-align: center;
    }

    .landscape-layout {
      display: grid;
      grid-template-columns: 25% 50% 25%;
      grid-template-rows: minmax(0, 100%);
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-size: initial;
      text-align: initial;
    }

    .landscape-column {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    .landscape-center {
      display: grid;
      grid-template-rows: minmax(0, 5fr) minmax(0, 4fr) minmax(0, 1fr);
    }

    .landscape-panel {
      position: relative;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    .landscape-panel > iframe {
      position: absolute;
      inset: 0;
      display: block;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box;
      border: none;
    }

    .landscape-panel > iframe[name="chatformFrame"] {
      top: auto;
      bottom: 0;
      height: 90px !important;
      z-index: 2;
    }

    .landscape-panel > iframe[name="chattextFrame"] {
      height: calc(100% - 90px) !important;
    }

    .landscape-panel > iframe[name="mapFrameAlt"],
    .landscape-panel > iframe[name="chattextFrameAlt"] {
      z-index: 1;
    }

    .landscape-layout iframe[name="reloadChatFrame"],
    .landscape-layout iframe[name="chatupdateFrame"] {
      display: none !important;
    }

    @media (orientation: portrait) {
      .landscape-layout {
        display: contents;
      }

      .landscape-column {
        display: contents;
      }

      .landscape-panel {
        display: contents;
      }

      .landscape-panel > iframe {
        position: static;
        width: 100% !important;
        height: auto !important;
      }

      .landscape-panel > iframe[name="chatformFrame"] {
        height: 90px !important;
      }

      .landscape-panel > iframe[name="chattextFrame"] {
        height: 250px !important;
      }
    }

    @media (orientation: landscape) {
      body {
        overflow: hidden;
      }
    }
  `;

  document.head.appendChild(style);

  var frames = {};
  [
    "mapFrame",
    "mapFrameAlt",
    "mainFrame",
    "itemFrame",
    "chattextFrame",
    "chattextFrameAlt",
    "chatformFrame",
    "menuFrame",
    "reloadChatFrame",
    "chatupdateFrame"
  ].forEach(function (name) {
    frames[name] = content.querySelector('iframe[name="' + name + '"]');
  });

  function createElement(className) {
    var element = document.createElement("div");
    element.className = className;
    return element;
  }

  var layout = createElement("landscape-layout");
  var leftColumn = createElement("landscape-column landscape-left");
  var centerColumn = createElement("landscape-column landscape-center");
  var rightColumn = createElement("landscape-column landscape-right");

  var mapPanel = createElement("landscape-panel landscape-map");
  var chatPanel = createElement("landscape-panel landscape-chat");
  var menuPanel = createElement("landscape-panel landscape-menu");

  if (frames.mainFrame) { leftColumn.appendChild(frames.mainFrame); }

  if (frames.mapFrame) { mapPanel.appendChild(frames.mapFrame); }
  if (frames.mapFrameAlt) { mapPanel.appendChild(frames.mapFrameAlt); }

  if (frames.chattextFrame) { chatPanel.appendChild(frames.chattextFrame); }
  if (frames.chattextFrameAlt) { chatPanel.appendChild(frames.chattextFrameAlt); }
  if (frames.chatformFrame) { chatPanel.appendChild(frames.chatformFrame); }
  if (frames.reloadChatFrame) { chatPanel.appendChild(frames.reloadChatFrame); }
  if (frames.chatupdateFrame) { chatPanel.appendChild(frames.chatupdateFrame); }

  if (frames.menuFrame) { menuPanel.appendChild(frames.menuFrame); }

  if (frames.itemFrame) { rightColumn.appendChild(frames.itemFrame); }

  centerColumn.appendChild(mapPanel);
  centerColumn.appendChild(chatPanel);
  centerColumn.appendChild(menuPanel);

  layout.appendChild(leftColumn);
  layout.appendChild(centerColumn);
  layout.appendChild(rightColumn);

  content.replaceChildren(layout);

  function resizeFrames() {
    var isLandscape = window.matchMedia("(orientation: landscape)").matches;
    if (!isLandscape) { return; }

    if (frames.chattextFrame) {
      var chatHeight = Math.max(0, chatPanel.clientHeight - 90);

      try {
        var chatDocument = frames.chattextFrame.contentDocument;

        if (chatDocument && chatDocument.documentElement.scrollHeight > chatHeight) {
          frames.chattextFrame.contentWindow.scrollTo(0, 0);
        }
      } catch (error) {
        // Ignore inaccessible frames.
      }
    }
  }

  window.addEventListener("resize", resizeFrames);
  window.addEventListener("orientationchange", resizeFrames);

  resizeFrames();
})();
