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
  if (location.pathname.indexOf("frset.php") !== -1) {
    document.documentElement.style.background = "#282828";

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

    return;
  }

  if (location.pathname.indexOf("friset.php") !== -1) {
    document.documentElement.style.background = "#282828";

    var createWikiFrame = function () {
      var blank = document.createElement("iframe");
      blank.setAttribute("frameborder", "0");
      blank.setAttribute("scrolling", "no");
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

    var style = document.createElement("style");

    style.textContent =
      "html,body{width:100%;height:100%;margin:0;padding:0;overflow:hidden;background:#282828}" +

      ".maintable{position:static!important;width:100%!important;height:100%!important}" +
      ".maintable>tbody>tr{display:block!important;width:100%!important;height:100%!important}" +
      ".left_td{display:block!important;position:static!important;width:100%!important;height:100%!important}" +
      ".right_td{display:block!important;position:static!important;width:100%!important;height:100%!important}" +

      ".left_td iframe[name=\"bannerFrame\"]{" +
        "position:fixed!important;left:0!important;top:0!important;" +
        "width:calc(100% - 300px)!important;height:75px!important;" +
      "}" +

      ".left_td iframe[name=\"mainFrame\"]{" +
        "position:fixed!important;left:0!important;top:75px!important;" +
        "width:calc(100% - 600px)!important;height:calc(100% - 275px)!important;" +
      "}" +

      ".left_td iframe[name=\"chattextFrame\"]{" +
        "position:fixed!important;left:0!important;bottom:35px!important;" +
        "width:calc(100% - 300px)!important;height:165px!important;" +
      "}" +

      ".left_td iframe[name=\"chatformFrame\"]{" +
        "position:fixed!important;left:0!important;bottom:0!important;" +
        "width:calc(100% - 300px)!important;height:35px!important;" +
      "}" +

      ".right_td iframe[name=\"itemFrame\"]{" +
        "position:fixed!important;right:0!important;top:0!important;" +
        "width:300px!important;height:calc(100% - 65px)!important;" +
      "}" +

      ".right_td iframe[name=\"mapFrame\"]{" +
        "position:fixed!important;right:300px!important;top:315px!important;" +
        "width:300px!important;height:295px!important;" +
      "}" +

      ".right_td iframe[name=\"menuFrame\"]{" +
        "position:fixed!important;right:0!important;bottom:0!important;" +
        "width:300px!important;height:65px!important;" +
      "}" +

      "iframe[name$=\"FrameAlt\"]{" +
        "position:absolute!important;left:-10000px!important;top:-10000px!important;" +
      "}" +

      "iframe[name=\"reloadChatFrame\"],iframe[name=\"chatupdateFrame\"]{" +
        "display:none!important;" +
      "}";

    document.head.appendChild(style);

    var wiki = createWikiFrame();

    wiki.style.position = "fixed";
    wiki.style.right = "300px";
    wiki.style.top = "75px";
    wiki.style.width = "300px";
    wiki.style.height = "240px";
    wiki.style.border = "0";
    wiki.style.zIndex = "10";

    document.body.appendChild(wiki);
  }
})();
