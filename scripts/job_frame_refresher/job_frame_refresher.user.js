// ==UserScript==
// @name        job_frame_refresher
// @namespace   Zabuza
// @description Refreshes the item-frame when receiving a new job in the MMORPG freewar.de.
// @include     *.freewar.de/freewar/internal/frset.php*
// @version     1
// ==/UserScript==

function getMainDocument() {
  try {
    var frame = document.querySelector('frame[name="mainFrame"]');
    if (!frame) { return null; }
    return frame.contentDocument;
  } catch (e) {
    console.error("getMainDocument failed:", e);
    return null;
  }
}

function reloadItemFrame() {
  try {
    var frame = document.querySelector('frame[name="itemFrame"]');
    if (frame) {
      //console.log("Reloaded");
      frame.contentWindow.location.reload();
    }
  } catch (e) {
    console.error("reloadItemFrame failed:", e);
  }
}

function routine() {
  try {
    var doc = getMainDocument();
    if (!doc) { return; }

    var jobLink = doc.querySelector('a[href="main.php?arrive_eval=getmission"]');
    if (!jobLink) { return; }

    // Don't attach the listener more than once to the same link.
    if (jobLink.dataset.jobRefreshAttached === "true") {
      return;
    }

    jobLink.dataset.jobRefreshAttached = "true";
    jobLink.addEventListener("click", function() {
      //console.log("Auftrag anfordern clicked");

      setTimeout(function() { reloadItemFrame(); }, 1000);
      setTimeout(function() { reloadItemFrame(); }, 2000);
    });

    //console.log("listener attached");
  } catch (e) {
    console.error("FreewarJobFrameRefresher routine error:", e);
  }
}

setInterval(routine, 100);
routine();
