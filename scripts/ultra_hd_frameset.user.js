// ==UserScript==
// @name        ultra_hd_frameset
// @namespace   Zabuza
// @description Adjusts the frameset used by the MMORPG freewar.de to be more suitable for 4K resolutions.
// @include     *.freewar.de/freewar/internal/frset.php*
// @version     1
// ==/UserScript==

/*
┌──────────────────────────────────────┬──────────────────────┐
│               BANNER                 │                      │
├───────────────────────────┬──────────┤                      │
│                           │          │                      │
│                           │          │                      │
│         MAIN GAME         │   MAP    │      ITEM AREA       │
│                           │          │                      │
│                           │          │                      │
├───────────────────────────┴──────────┤                      │
│                                      │                      │
│                 CHAT                 │                      │
│                                      │                      │
├──────────────────────────────────────┤                      │
│              CHAT INPUT              │                      │
│                                      ├──────────────────────┤
│                                      │        MENU          │
└──────────────────────────────────────┴──────────────────────┘
*/
(function () {
    var frame = function (name) {
        return document.querySelector('frame[name="' + name + '"]');
    };

    var outer = document.getElementsByTagName("frameset")[0];

    var left = document.createElement("frameset");
    left.setAttribute("rows", "*,200");

    var top = document.createElement("frameset");
    top.setAttribute("rows", "75,*");

    var game = document.createElement("frameset");
    game.setAttribute("cols", "*,300");
    game.appendChild(frame("mainFrame"));
    game.appendChild(frame("mapFrame"));

    top.appendChild(frame("bannerFrame"));
    top.appendChild(game);

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

    left.appendChild(top);
    left.appendChild(chat);

    var right = document.createElement("frameset");
    right.setAttribute("rows", "*,65");
    right.appendChild(frame("itemFrame"));
    right.appendChild(frame("menuFrame"));

    outer.setAttribute("cols", "*,360");
    outer.innerHTML = "";
    outer.appendChild(left);
    outer.appendChild(right);
})();