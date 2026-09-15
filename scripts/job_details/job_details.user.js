// ==UserScript==
// @name        job_details
// @namespace   Zabuza
// @description Shows details, such as destinations for jobs, in the menu of the MMORPG freewar.de.
// @include     *.freewar.de/freewar/internal/frset.php*
// @version     1
// ==/UserScript==

var currentJobName = null;
var currentJobPosition = null;

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

function getItemDocument() {
  try {
    var frame = document.querySelector('frame[name="itemFrame"]');
    if (!frame) { return null; }
    return frame.contentDocument;
  } catch (e) {
    console.error("getItemDocument failed:", e);
    return null;
  }
}

function extractJobName() {
  var doc = getMainDocument();
  if (!doc) { return null; }

  if (!doc.querySelector('a[href="?arrive_eval=cancelmission"]')) {
    return null;
  }

  var description = doc.querySelector('td.areadescription');
  if (!description) { return null; }

  var jobHeader = Array.from(description.querySelectorAll('b')).find(function (element) {
    return element.textContent.trim() === 'Aktueller Auftrag:';
  });
  if (!jobHeader) { return null; }

  var jobName = jobHeader.nextElementSibling;
  while (jobName && jobName.tagName !== 'B') {
    jobName = jobName.nextElementSibling;
  }
  if (!jobName) { return null; }

  return jobName.textContent.trim();
}

function getItemFrameJobName() {
  var doc = getItemDocument();
  if (!doc) { return null; }

  var link = doc.querySelector(
    '#listrow_char_mission a[href="item.php?action=missiondesc"]'
  );
  if (!link) { return null; }

  return link.getAttribute('title');
}

function extractPosition() {
  var doc = getMainDocument();
  if (!doc) { return null; }

  if (!doc.querySelector('a[href="?arrive_eval=cancelmission"]')) { return null; }

  var description = doc.querySelector('td.areadescription');
  if (!description) { return null; }

  var text = description.textContent;
  var match = text.match(/Aktueller Auftrag:\s*([\s\S]*?)\s*Belohnung:/);
  if (!match) { return null; }

  var jobText = match[1];
  var position = jobText.match(/Position X:\s*(-?\d+)\s*Y:\s*(-?\d+)/);
  if (!position) { return null; }

  return {
    x: parseInt(position[1], 10),
    y: parseInt(position[2], 10)
  };
}

function displayPosition(position) {
  var doc = getItemDocument();
  if (!doc) { return; }

  var row = doc.querySelector('#listrow_char_mission');
  if (!row) { return; }

  var display = doc.querySelector('#job-position');
  if (display) { return; }

  display = doc.createElement('span');
  display.id = 'job-position';

  display.style.display = 'block';
  display.style.margin = '-10px 2px 12px 7px';
  display.style.padding = '5px 7px';
  display.style.background = '#464646';
  display.style.border = '1px solid #666';
  display.style.borderLeft = '4px solid rgb(252, 252, 114)';
  display.style.borderRadius = '5px';
  display.style.color = '#f5f5f5';
  display.style.fontSize = '12px';
  display.style.fontWeight = 'bold';
  display.style.lineHeight = '1.5';
  display.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.45)';

  display.textContent = 'Pos: ' + position.x + '/' + position.y;

  row.parentNode.insertBefore(display, row.nextSibling);
}

function routine() {
  try {
    var jobName = extractJobName();

    if (jobName) {
      currentJobName = jobName;

      var position = extractPosition();
      if (position) {
        currentJobPosition = position;
      }
    }
    if (!currentJobName || !currentJobPosition) { return; }

    var itemFrameJobName = getItemFrameJobName();
    if (!itemFrameJobName || itemFrameJobName !== currentJobName) { return; }

    displayPosition(currentJobPosition);
  } catch (e) {
    console.error("FreewarJobDetails routine error:", e);
  }
}

setInterval(routine, 100);
routine();
