// ==UserScript==
// @name        mobile_landscape_frameset
// @namespace   Zabuza
// @description Improves the layout of the mobile (compact) version of Freewar.
// @include     *.freewar.de/freewar/internal/frcompact.php*
// @version     1
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
      height: 100%;
      font-size: 4em;
      text-align: center;
    }

    .landscape-layout {
      display: grid;
      grid-template-columns: 40% 35% 25%;
      grid-template-rows: minmax(0, 1fr);
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
      height: 100%;
      overflow: hidden;
    }

    .landscape-column > iframe {
      display: block;
      width: 100% !important;
      height: 100% !important;
      min-width: 0;
      min-height: 0;
      box-sizing: border-box;
      border: none;
    }

    .landscape-center {
      display: grid;
      grid-template-rows: minmax(0, 7fr) minmax(0, 2fr) minmax(0, 1fr);
    }

    .landscape-panel {
      position: relative;
      min-width: 0;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: contain;
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

    .landscape-center iframe {
      overscroll-behavior: contain;
    }

    .landscape-panel > iframe[name="chattextFrame"] {
      height: 100% !important;
    }

    .landscape-panel > iframe[name="mapFrameAlt"],
    .landscape-panel > iframe[name="chattextFrameAlt"] {
      display: none !important;
    }

    .landscape-menu {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-width: 0;
      min-height: 0;
    }

    .landscape-menu-chat,
    .landscape-menu-items {
      position: relative;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    .landscape-menu-chat > iframe,
    .landscape-menu-items > iframe {
      position: absolute;
      inset: 0;
      display: block;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box;
      border: none;
    }

    .landscape-menu-chat > iframe[name="chatformFrame"] {
      position: absolute;
      height: 100% !important;
    }

    .landscape-menu-chat > iframe[name="reloadChatFrame"],
    .landscape-menu-chat > iframe[name="chatupdateFrame"] {
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

      .landscape-panel > iframe,
      .landscape-column > iframe {
        position: static;
        width: 100% !important;
        height: auto !important;
      }

      .landscape-panel > iframe[name="chattextFrame"] {
        height: 250px !important;
      }

      .landscape-menu {
        display: contents;
      }

      .landscape-menu-chat,
      .landscape-menu-items {
        display: contents;
      }

      .landscape-menu-chat > iframe,
      .landscape-menu-items > iframe {
        position: static;
        width: 100% !important;
        height: auto !important;
      }

      .landscape-menu-chat > iframe[name="chatformFrame"] {
        height: 90px !important;
      }
    }

    @media (orientation: landscape) {
      html,
      body {
        overflow: hidden;
      }

      .content {
        height: 100dvh;
        overflow: hidden;
      }

      .landscape-layout {
        height: 100dvh;
      }

      .landscape-left > iframe,
      .landscape-right > iframe {
        height: 100% !important;
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

  [
    "mapFrame",
    "mapFrameAlt",
    "chattextFrame",
    "chattextFrameAlt"
  ].forEach(function (name) {
    if (frames[name]) {
      frames[name].setAttribute("scrolling", "auto");
    }
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
  var menuChatPanel = createElement("landscape-menu-chat");
  var menuItemsPanel = createElement("landscape-menu-items");

  if (frames.mainFrame) { leftColumn.appendChild(frames.mainFrame); }

  if (frames.mapFrame) { mapPanel.appendChild(frames.mapFrame); }
  if (frames.mapFrameAlt) { mapPanel.appendChild(frames.mapFrameAlt); }

  if (frames.chattextFrame) { chatPanel.appendChild(frames.chattextFrame); }
  if (frames.chattextFrameAlt) { chatPanel.appendChild(frames.chattextFrameAlt); }

  if (frames.chatformFrame) { menuChatPanel.appendChild(frames.chatformFrame); }
  if (frames.reloadChatFrame) { menuChatPanel.appendChild(frames.reloadChatFrame); }
  if (frames.chatupdateFrame) { menuChatPanel.appendChild(frames.chatupdateFrame); }

  if (frames.menuFrame) { menuItemsPanel.appendChild(frames.menuFrame); }
  if (frames.itemFrame) { rightColumn.appendChild(frames.itemFrame); }

  menuPanel.appendChild(menuChatPanel);
  menuPanel.appendChild(menuItemsPanel);

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
      var chatHeight = Math.max(0, chatPanel.clientHeight);

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
