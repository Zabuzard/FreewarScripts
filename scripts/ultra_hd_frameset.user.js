// ==UserScript==
// @name        ultra_hd_frameset
// @namespace   Zabuza
// @description Adjusts the frameset used by the MMORPG freewar.de to be more suitable for 4K resolutions.
// @include     *.freewar.de/freewar/internal/frset.php*
// @include     *.freewar.de/freewar/internal/friset.php*
// @version     2
// ==/UserScript==

/*
┌─────────────────────────────────────────────┬───────────────┐
│                    BANNER                   │               │
├─────────────────────────────────────────────┤               │
│                                     │       │               │
│             MAIN GAME               │       │    ITEM       │
│                                     │       │    AREA       │
│                                     │       │               │
│                                     ├───────┤               │
│                                     │  MAP  │               │
├─────────────────────────────────────┴───────┤               │
│                    CHAT                     ├───────────────┤
├─────────────────────────────────────────────┤     MENU      │
│                 CHAT INPUT                  │               │
└─────────────────────────────────────────────┴───────────────┘
*/

(function () {
  document.documentElement.style.background = "#282828";

  var frame = function (name) {
    return document.querySelector('frame[name="' + name + '"],iframe[name="' + name + '"]');
  };

  var createWikiFrame = function () {
    var blank = document.createElement("iframe");

    blank.setAttribute("src", "data:text/html;charset=utf-8," + encodeURIComponent(
      "<!DOCTYPE html>" +
      "<html>" +
      "<head>" +
      "<style>" +
      "html,body{margin:0;width:100%;height:100%;background:#282828;color:#ddd;font-family:Arial,sans-serif;overflow:hidden}" +
      "#nav{height:28px;background:#282828;box-sizing:border-box}" +
      ".navButton{display:block;width:100%;height:28px;margin:0;padding:0;background:transparent;border:0;cursor:pointer}" +
      "#page{width:100%;height:calc(100% - 28px);border:0;display:block;background:#282828;zoom:0.4}" +
      "</style>" +
      "</head>" +
      "<body>" +
      "<div id='nav'>" +
      "<button class='navButton' id='home' title='Home' style='display:none'></button>" +
      "<button class='navButton' id='wiki' title='FWWiki'></button>" +
      "</div>" +
      "<iframe id='page' src='about:blank'></iframe>" +
      "<script>" +
      "var page=document.getElementById('page');" +
      "var home=document.getElementById('home');" +
      "var wiki=document.getElementById('wiki');" +
      "wiki.onclick=function(){page.src='https://fwwiki.de/index.php/Gesamtkarte';wiki.style.display='none';home.style.display='block';};" +
      "home.onclick=function(){page.src='about:blank';home.style.display='none';wiki.style.display='block';};" +
      "</script>" +
      "</body>" +
      "</html>"
    ));

    return blank;
  };

  var outer = document.getElementsByTagName("frameset")[0];

  /*
   * Alternative iframe layout used by friset.php.
   */
  if (!outer) {
    var banner = frame("bannerFrame");
    var main = frame("mainFrame");
    var map = frame("mapFrame");
    var chatText = frame("chattextFrame");
    var chatForm = frame("chatformFrame");
    var item = frame("itemFrame");
    var menu = frame("menuFrame");

    if (!banner || !main || !map || !chatText || !chatForm || !item || !menu) {
      return;
    }

    var style = document.createElement("style");
    style.textContent =
      "html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#282828}" +
      "#ultra-hd-root{position:fixed;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 300px;grid-template-rows:75px minmax(0,1fr) 200px 35px;overflow:hidden;background:#282828}" +
      ".ultra-hd-frame{position:relative!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;box-sizing:border-box!important}" +
      "#ultra-hd-banner{grid-column:1;grid-row:1;overflow:hidden}" +
      "#ultra-hd-game{grid-column:1;grid-row:2;display:grid;grid-template-columns:minmax(0,1fr) 300px;grid-template-rows:minmax(0,1fr);min-width:0;min-height:0;overflow:hidden}" +
      "#ultra-hd-main{grid-column:1;grid-row:1;position:relative;min-width:0;min-height:0;overflow:hidden}" +
      "#ultra-hd-map-area{grid-column:2;grid-row:1;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:200px 300px;align-content:start;min-width:0;min-height:0;overflow:hidden}" +
      "#ultra-hd-wiki,#ultra-hd-map{position:relative;min-width:0;min-height:0;overflow:hidden}" +
      "#ultra-hd-wiki{grid-row:1}" +
      "#ultra-hd-map{grid-row:2}" +
      "#ultra-hd-chat{grid-column:1;grid-row:3;min-width:0;min-height:0;overflow:hidden}" +
      "#ultra-hd-chat-input{grid-column:1;grid-row:4;min-width:0;min-height:0;overflow:hidden}" +
      "#ultra-hd-item{position:fixed;top:0;right:0;width:300px;bottom:65px;overflow:hidden}" +
      "#ultra-hd-menu{position:fixed;right:0;bottom:0;width:300px;height:65px;overflow:hidden}";

    (document.head || document.documentElement).appendChild(style);

    var root = document.createElement("div");
    root.id = "ultra-hd-root";

    var container = function (id, parent, element) {
      var div = document.createElement("div");
      div.id = id;
      parent.appendChild(div);

      if (element) {
        element.classList.add("ultra-hd-frame");
        div.appendChild(element);
      }

      return div;
    };

    container("ultra-hd-banner", root, banner);

    var game = container("ultra-hd-game", root);
    container("ultra-hd-main", game, main);

    var mapArea = container("ultra-hd-map-area", game);
    container("ultra-hd-wiki", mapArea, createWikiFrame());
    container("ultra-hd-map", mapArea, map);

    container("ultra-hd-chat", root, chatText);
    container("ultra-hd-chat-input", root, chatForm);
    container("ultra-hd-item", document.body, item);
    container("ultra-hd-menu", document.body, menu);

    document.body.appendChild(root);

    var original = document.querySelector(".maintable");

    if (original) {
      original.remove();
    }

    return;
  }

  /*
   * Original frameset layout used by frset.php.
   */
  var left = document.createElement("frameset");
  left.setAttribute("rows", "75,*");

  var banner = frame("bannerFrame");

  var mainArea = document.createElement("frameset");
  mainArea.setAttribute("rows", "*,200");

  var game = document.createElement("frameset");
  game.setAttribute("cols", "*,300");

  var mapArea = document.createElement("frameset");
  mapArea.setAttribute("rows", "200,300");

  var blank = document.createElement("frame");
  blank.setAttribute("src", "data:text/html;charset=utf-8," + encodeURIComponent(
    "<!DOCTYPE html>" +
    "<html>" +
    "<head>" +
    "<style>" +
    "html,body{margin:0;width:100%;height:100%;background:#282828;color:#ddd;font-family:Arial,sans-serif;overflow:hidden}" +
    "#nav{height:28px;background:#282828;box-sizing:border-box}" +
    ".navButton{display:block;width:100%;height:28px;margin:0;padding:0;background:transparent;border:0;cursor:pointer}" +
    "#page{width:100%;height:calc(100% - 28px);border:0;display:block;background:#282828;zoom:0.4}" +
    "</style>" +
    "</head>" +
    "<body>" +
    "<div id='nav'>" +
    "<button class='navButton' id='home' title='Home' style='display:none'></button>" +
    "<button class='navButton' id='wiki' title='FWWiki'></button>" +
    "</div>" +
    "<iframe id='page' src='about:blank'></iframe>" +
    "<script>" +
    "var page=document.getElementById('page');" +
    "var home=document.getElementById('home');" +
    "var wiki=document.getElementById('wiki');" +
    "wiki.onclick=function(){page.src='https://fwwiki.de/index.php/Gesamtkarte';wiki.style.display='none';home.style.display='block';};" +
    "home.onclick=function(){page.src='about:blank';home.style.display='none';wiki.style.display='block';};" +
    "</script>" +
    "</body>" +
    "</html>"
  ));

  var map = frame("mapFrame");
  mapArea.appendChild(blank);
  mapArea.appendChild(map);

  game.appendChild(frame("mainFrame"));
  game.appendChild(mapArea);

  var chat = document.createElement("frameset");
  chat.setAttribute("rows", "*,0");

  var chatVisible = document.createElement("frameset");
  chatVisible.setAttribute("rows", "*,35");
  chatVisible.appendChild(frame("chattextFrame"));
  chatVisible.appendChild(frame("chatformFrame"));

  var chatHidden = document.createElement("frameset");
  chatHidden.setAttribute("rows", "*,0");
  chatHidden.appendChild(frame("reloadChatFrame"));
  chatHidden.appendChild(frame("chatupdateFrame"));

  chat.appendChild(chatVisible);
  chat.appendChild(chatHidden);

  mainArea.appendChild(game);
  mainArea.appendChild(chat);

  left.appendChild(banner);
  left.appendChild(mainArea);

  var right = document.createElement("frameset");
  right.setAttribute("rows", "*,65");
  right.appendChild(frame("itemFrame"));
  right.appendChild(frame("menuFrame"));

  outer.setAttribute("rows", "*");
  outer.setAttribute("cols", "*,300");
  outer.setAttribute("framespacing", "0");
  outer.setAttribute("frameborder", "no");
  outer.setAttribute("border", "0");
  outer.innerHTML = "";
  outer.appendChild(left);
  outer.appendChild(right);
})();
