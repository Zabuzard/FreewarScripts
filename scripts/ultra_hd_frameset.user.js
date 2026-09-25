// ==UserScript==
// @name        ultra_hd_frameset
// @namespace   Zabuza
// @description Adjusts the frameset used by the MMORPG freewar.de to be more suitable for 4K resolutions.
// @include     *.freewar.de/freewar/internal/frset.php*
// @version     1
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
  document.body.style.background = "#282828";

  var frame = function (name) {
    return document.querySelector('frame[name="' + name + '"]');
  };

  var outer = document.getElementsByTagName("frameset")[0];

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
  map.addEventListener("load", function () {
    map.contentDocument.body.style.zoom = "1.1";
  });

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
