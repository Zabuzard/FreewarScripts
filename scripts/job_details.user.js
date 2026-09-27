// ==UserScript==
// @name        job_details
// @namespace   Zabuza
// @description Shows details, such as destinations for jobs, in the menu of the MMORPG freewar.de.
// @include     *.freewar.de/freewar/internal/frset.php*
// @require     https://zabuzard.github.io/FreewarScripts/resources/coordinate_resource.js
// @version     1
// ==/UserScript==

var STORAGE_KEY = 'FreewarJobDetails';
var COOKIE_KEY = 'FreewarJobDetails';
var STORAGE_MAX_AGE_MS = 3 * 60 * 60 * 1000;

var currentJobDetails = null;
var itemFrameObserver = null;
var observedItemDocument = null;

var jobDetailsStyle = null;
var jobDetailsBaseContent = null;

var ignoredPositions = [
  "127/89", // Blauer Seelenstaub: Brondor
  "55/75", // Zuviele Farben: Laree - Stadt
  "61/104", // Itolos-Leder: Karto - Das Todesmoor
  "54/113" // Das Flammenwurmsekret: Pensal
];
const ignoredHighlights = new Set([
  'Kiste mit Reagenzgläsern',
  "rostigen Werkzeugkoffer",
  "Phasenkugel",
  "Schneeschaufel",
  "Fackel des Auftragshauses",
  "Klopfstock",
  "Brotandro-Virus",
  "Kristall der Miniaturisierung",
  "Portalmaschine",
  "Grotte des Todes",
  "Seelenkapsel",
  "0"
]);
var positionOverrides = {
  "Die Fischspeise": "137/116",
  "Die Wachtelnachzucht": "90/115",
  "Verschneite Wege": "111/83",
  "Die Fischspeise": "137/116",
  "Der kranke Loranier": "65/79",
  "Das Artefakt von Dranar": "105/127",
  "Die Windwiesen": "111/94",
  "Der silberne Ohrring Teil 2": "77/101",
  "Der silberne Ohrring Teil 3": "77/101",
  "Der feine Gestank": "60/111",
  "Die Hungersnot Teil 2": "101/116",
  "Urlaub Teil 2": "118/106",
  "Die Seuche": "98/102",
};

var npcJobs = {
    "Onlo": {
      jobs: ["Der Kugelknochen"],
      positions: [
        [70, 105],
        [70, 108],
        [71, 105],
        [71, 107],
        [72, 106],
        [73, 105],
        [73, 106],
        [74, 104]
      ]
    },
    "Blattalisk": {
      jobs: ["Der diebische Blattalisk"],
      positions: [
        [119, 111],
        [119, 114],
        [119, 115],
        [120, 111],
        [120, 114],
        [121, 111],
        [121, 114],
        [121, 115]
      ]
    },
    "Bürger": {
      jobs: ["Die verwesten Bürger Teil 2"],
      positions: [
        [-185, -94],
        [-193, -98],
        [-196, -96],
        [80, 87],
        [81, 88],
        [81, 89],
        [82, 87],
        [82, 90],
        [84, 88]
      ]
    },
    "Ektofron": {
      jobs: ["Der Ektofronstachel"],
      positions: [
        [50, 84],
        [51, 82],
        [51, 85],
        [55, 88],
        [57, 88],
        [58, 88],
        [58, 91],
        [59, 84],
        [59, 88],
        [59, 92],
        [59, 93],
        [60, 87],
        [60, 88],
        [60, 92]
      ]
    },
    "t-Falter": {
      jobs: ["Falterchaos"],
      positions: [
        [-508, -375],
        [108, 77],
        [109, 76],
        [111, 77],
        [112, 79],
        [113, 79],
        [114, 81],
        [115, 80],
        [116, 79],
        [119, 79]
      ]
    },
    "Kröte": {
      jobs: ["Itolos-Leder"],
      positions: [
        [255, 94],
        [255, 96],
        [256, 95],
        [257, 92],
        [257, 94],
        [258, 95],
        [259, 92],
        [254, 96],
        [258, 93],
        [259, 95],
        [261, 93]
      ]
    },
    "Bro-Virus": {
      jobs: ["Wissenschaftliches Arbeiten"],
      positions: [
        [111, 132],
        [113, 131],
        [115, 131],
        [115, 134]
      ]
    },
    "leb. Ast": {
      jobs: ["Astforschung"],
      positions: [
        [-595, -448],
        [-596, -449],
        [-597, -448],
        [-599, -448]
      ]
    },
    "Ratte": {
      jobs: ["Ratten und Raffzähne"],
      positions: [
        [93, 95],
        [91, 96],
        [93, 97],
        [94, 98],
        [115, 98],
        [114, 99],
        [115, 100],
        [114, 103],
        [113, 104],
        [115, 104],
        [116, 105],
        [115, 106],
        [114, 107],
        [116, 107],
        [118, 107],
        [115, 108],
        [116, 108],
        [117, 108],
        [118, 108]
      ]
    },
    "alt Onlo": {
      jobs: ["Die Wurzel der Oase Teil 2"],
      positions: [
        [99, 126]
      ]
    }
  };

var coordinateLookup = {};

function loadJobDetails() {
  var value;

  try {
    value = window.localStorage.getItem(STORAGE_KEY);

    if (value) {
      var parsed = JSON.parse(value);

      if (parsed && typeof parsed === 'object' &&
          parsed.jobDetails && parsed.timestamp) {
        if (Date.now() - parsed.timestamp <= STORAGE_MAX_AGE_MS) {
          return parsed.jobDetails;
        }

        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch (e) {}

  try {
    var cookies = document.cookie.split(';');

    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].trim();

      if (cookie.indexOf(COOKIE_KEY + '=') === 0) {
        value = decodeURIComponent(
          cookie.substring((COOKIE_KEY + '=').length)
        );

        var parsedCookie = JSON.parse(value);

        if (parsedCookie && typeof parsedCookie === 'object' &&
            parsedCookie.jobDetails && parsedCookie.timestamp) {
          if (Date.now() - parsedCookie.timestamp <= STORAGE_MAX_AGE_MS) {
            return parsedCookie.jobDetails;
          }

          return null;
        }
      }
    }
  } catch (e) {}

  return null;
}

function saveJobDetails(jobDetails) {
  var value = JSON.stringify({
    jobDetails: jobDetails,
    timestamp: Date.now()
  });

  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    return;
  } catch (e) {}

  try {
    document.cookie =
      COOKIE_KEY + '=' + encodeURIComponent(value) + '; path=/';
  } catch (e) {}
}

function parseCoordinateResource() {
  var sections = coordinateResource.match(
    /\{\{Überschriftensimulation 2\|1=\{\{Gebietslink\|([^}]+)\}\}[^}]*\}\}([\s\S]*?)(?=\{\{Überschriftensimulation 2\|1=\{\{Gebietslink\||$)/g
  );

  if (!sections) { return; }

  for (var i = 0; i < sections.length; i++) {
    var section = sections[i];

    var match = section.match(
      /\{\{Überschriftensimulation 2\|1=\{\{Gebietslink\|([^}]+)\}\}[^}]*\}\}([\s\S]*)/
    );

    if (!match) { continue; }

    var areaName = match[1];
    var coordinates = match[2].match(/-?\d+,-?\d+/g);

    if (!coordinates) { continue; }

    for (var j = 0; j < coordinates.length; j++) {
      coordinateLookup[coordinates[j]] = areaName;
    }
  }
}

function getAreaName(position) {
  if (!position) { return null; }

  var coordinate = position.x + ',' + position.y;
  return coordinateLookup[coordinate] || null;
}

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

function getMapDocument() {
  try {
    var frame = document.querySelector('frame[name="mapFrame"]');
    if (!frame) { return null; }
    return frame.contentDocument;
  } catch (e) {
    console.error("getMapDocument failed:", e);
    return null;
  }
}

function getMainFrameJobDetails() {
  var doc = getMainDocument();
  if (!doc) { return null; }

  if (!doc.querySelector('a[href="?arrive_eval=cancelmission"]')) {
    return null;
  }

  var descriptions = doc.querySelectorAll('td.areadescription');
  var description = null;

  for (var i = 0; i < descriptions.length; i++) {
    var boldElements = descriptions[i].querySelectorAll('b');
    var hasJobHeader = false;

    for (var j = 0; j < boldElements.length; j++) {
      if (boldElements[j].textContent.trim() === 'Aktueller Auftrag:') {
        hasJobHeader = true;
        break;
      }
    }

    if (hasJobHeader) {
      description = descriptions[i];
      break;
    }
  }

  if (!description) { return null; }

  var descriptionBoldElements = description.querySelectorAll('b');
  var jobHeader = null;

  for (var k = 0; k < descriptionBoldElements.length; k++) {
    if (descriptionBoldElements[k].textContent.trim() === 'Aktueller Auftrag:') {
      jobHeader = descriptionBoldElements[k];
      break;
    }
  }

  if (!jobHeader) { return null; }

  var jobName = jobHeader.nextElementSibling;
  while (jobName && jobName.tagName !== 'B') {
    jobName = jobName.nextElementSibling;
  }
  if (!jobName) { return null; }

  var text = description.textContent;
  var match = text.match(/Aktueller Auftrag:\s*([\s\S]*?)\s*Belohnung:/);
  if (!match) { return null; }

  var position = match[1].match(/(?:Position|Ort|Stelle) X:\s*(-?\d+)\s*Y:\s*(-?\d+)/);

  var result = {
    name: jobName.textContent.trim(),
    position: null,
    area: null,
    highlights: [],
    reward: {
      gold: 0,
      ap: 0
    },
    expiresAt: null
  };

  if (position && ignoredPositions.indexOf(position[1] + "/" + position[2]) !== -1) {
    position = null;
  }
  if (positionOverrides[result.name]) {
    position = ["", ...positionOverrides[result.name].split("/")];
  }

  if (position) {
    result.position = {
      x: parseInt(position[1], 10),
      y: parseInt(position[2], 10)
    };

    result.area = getAreaName(result.position);
  }

  var rewardGoldMatch = text.match(/Belohnung\s*:[\s\S]*?([\d.]+)\s*Goldmünzen/i);
  if (rewardGoldMatch) {
    result.reward.gold = parseInt(rewardGoldMatch[1].replace(/\./g, ""), 10);
  }

  var rewardApMatch = text.match(/Belohnung\s*:[\s\S]*?(\d+)\s*Auftragspunkt(?:e)?/i);
  if (rewardApMatch) {
    result.reward.ap = parseInt(rewardApMatch[1], 10);
  }

  var bonusMatch = text.match(/Bonus\s*:\s*([\d.]+)\s*Goldmünzen/i);
  if (bonusMatch) {
    result.reward.gold += parseInt(bonusMatch[1].replace(/\./g, ""), 10);
  }

  var timeMatch = text.match(/Du hast noch\s*(\d+)\s*Minuten?,\s*um die Mission zu beenden/i);
  if (timeMatch) {
    result.expiresAt = Date.now() + parseInt(timeMatch[1], 10) * 60 * 1000;
  }

  var element = jobName.nextSibling;

  while (element) {
    if (element.nodeType === 1 && element.tagName === 'B') {
      var value = element.textContent.trim();
      if (value === 'Belohnung') { break; }

      // Ignore progress values such as: <b>0</b> von <b>5</b>
      if (/^\d+$/.test(value)) {
        var next = element.nextSibling;

        while (next && next.nodeType !== 1) {
          next = next.nextSibling;
        }

        if (next && next.tagName === 'B' && /^\d+$/.test(next.textContent.trim())) {
          var separator = element.nextSibling;

          while (separator !== next) {
            if (separator.nodeType === 3 && separator.textContent.trim() === 'von') {
              element = next;
              break;
            }

            separator = separator.nextSibling;
          }

          if (element === next) {
            element = element.nextSibling;
            continue;
          }
        }
      }

      if (value && !ignoredHighlights.has(value)) {
        result.highlights.push(value);
      }
    }

    element = element.nextSibling;
  }

  return result;
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

function getJobDisplayText(jobDetails) {
  var displayText = '';
  var showPosition = true;

  if (jobDetailsBaseContent && jobDetails.position) {
    var positionText = jobDetails.position.x + '/' + jobDetails.position.y;
    if (jobDetailsBaseContent.indexOf(positionText) !== -1) {
      showPosition = false;
    }
  }

  if (showPosition && jobDetails.position) {
    displayText = 'Pos: ' + jobDetails.position.x + '/' + jobDetails.position.y;

    if (jobDetails.area) {
      displayText += ' (' + jobDetails.area + ')';
    }
  }

  if (jobDetails.highlights.length) {
    if (displayText) {
      displayText += ', ';
    }

    displayText += jobDetails.highlights.join(', ');
  }

  if (jobDetails.reward || jobDetails.expiresAt) {
    if (displayText) {
      displayText += ' \\A ';
    }
    displayText += '(';

    var extraText = '';

    if (jobDetails.reward) {
      extraText += '★ ' + jobDetails.reward.ap + ', G ' + jobDetails.reward.gold.toLocaleString("de-DE");
    }

    if (jobDetails.expiresAt) {
      if (extraText) {
        extraText += ', ';
      }

      var remainingMinutes = Math.max(0, Math.round((jobDetails.expiresAt - Date.now()) / 60000));
      extraText += '⏱ ' + remainingMinutes + ' min';
    }

    displayText += extraText + ')';
  }

  return displayText;
}

function displayJobDetails(jobDetails) {
  var doc = getItemDocument();
  if (!doc) { return; }

  var row = doc.querySelector('#listrow_char_mission');
  if (!row) { return; }

  if (jobDetailsBaseContent === null) {
    var computedStyle = doc.defaultView.getComputedStyle(row, '::after');

    var content = computedStyle.content;
    if (!content || content === 'none' || content === 'normal') {
      jobDetailsBaseContent = '';
    } else {
      jobDetailsBaseContent = content;
    }
  }

  var displayText = getJobDisplayText(jobDetails);
  if (!displayText) { return; }

  if (!jobDetailsStyle) {
    jobDetailsStyle = doc.createElement('style');
    jobDetailsStyle.id = 'job-details-style';
    doc.head.appendChild(jobDetailsStyle);
  }

  var css = '#listrow_char_mission::after {' +
      'display: block;' +
      'margin: 12px 2px;' +
      'padding: 5px 7px;' +
      'background: #464646;' +
      'border: 1px solid #666;' +
      'border-left: 4px solid #f99;' +
      'border-radius: 5px;' +
      'color: #f5f5f5;' +
      'font-size: 12px;' +
      'font-weight: bold;' +
      'line-height: 1.5;' +
      'box-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);' +
      'white-space: pre-line;' +
      '}' + '\n';

  var appendedContent = JSON.stringify(displayText).replace(/\\\\A/g, '\\A');
  var finalContent;

  if (jobDetailsBaseContent && appendedContent) {
    finalContent = jobDetailsBaseContent.slice(0, -1) + ' \\A\\A ' + appendedContent.slice(1);
  } else if (jobDetailsBaseContent) {
    finalContent = jobDetailsBaseContent;
  } else {
    finalContent = appendedContent;
  }

  css += '#listrow_char_mission::after { content: ' + finalContent + ' !important; }';

  if (jobDetailsStyle.textContent !== css) {
    jobDetailsStyle.textContent = css;
  }
}

function displayMapHighlight(jobDetails) {
  var mapDoc = getMapDocument();
  if (!mapDoc) { return; }

  if (!jobDetails || !jobDetails.position) {
    return;
  }

  if (!mapDoc.getElementById("fw-job-highlight-style")) {
    var style = mapDoc.createElement("style");
    style.id = "fw-job-highlight-style";
    style.textContent = `
      .fw-job-highlight {
        position: relative;
        filter: sepia(0.15) saturate(1.1) hue-rotate(0deg) brightness(1.02);
      }

      .fw-job-highlight::after {
        content: "";
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 0, 0.25);
        pointer-events: none;
      }

      .fw-job-direction-highlight {
        position: relative;
      }

      .fw-job-direction-highlight::after {
        content: "";
        position: absolute;
        pointer-events: none;
        background: rgba(255, 255, 0, 0.35);
      }

      .fw-job-direction-north::after {
        top: 0;
        left: 0;
        width: 100%;
        height: 15px;
      }

      .fw-job-direction-south::after {
        bottom: 0;
        left: 0;
        width: 100%;
        height: 15px;
      }

      .fw-job-direction-west::after {
        top: 0;
        left: 0;
        width: 15px;
        height: 100%;
      }

      .fw-job-direction-east::after {
        top: 0;
        right: 0;
        width: 15px;
        height: 100%;
      }

      .fw-job-direction-northwest::after {
        inset: 0;
        background: transparent;
        box-shadow:
          inset 0 15px 0 rgba(255, 255, 0, 0.35),
          inset 15px 0 0 rgba(255, 255, 0, 0.35);
      }

      .fw-job-direction-northeast::after {
        inset: 0;
        background: transparent;
        box-shadow:
          inset 0 15px 0 rgba(255, 255, 0, 0.35),
          inset -15px 0 0 rgba(255, 255, 0, 0.35);
      }

      .fw-job-direction-southwest::after {
        inset: 0;
        background: transparent;
        box-shadow:
          inset 0 -15px 0 rgba(255, 255, 0, 0.35),
          inset 15px 0 0 rgba(255, 255, 0, 0.35);
      }

      .fw-job-direction-southeast::after {
        inset: 0;
        background: transparent;
        box-shadow:
          inset 0 -15px 0 rgba(255, 255, 0, 0.35),
          inset -15px 0 0 rgba(255, 255, 0, 0.35);
      }
    `;

    mapDoc.head.appendChild(style);
  }

  var oldDirectionTiles = mapDoc.querySelectorAll(".fw-job-direction-highlight");
  for (var i = 0; i < oldDirectionTiles.length; i++) {
    oldDirectionTiles[i].classList.remove("fw-job-direction-highlight", "fw-job-direction-north", "fw-job-direction-south", "fw-job-direction-west", "fw-job-direction-east", "fw-job-direction-northwest", "fw-job-direction-northeast", "fw-job-direction-southwest", "fw-job-direction-southeast");
  }

  var tile = mapDoc.getElementById("mapx" + jobDetails.position.x + "y" + jobDetails.position.y);
  if (tile) {
    if (!tile.classList.contains("fw-job-highlight")) {
      tile.classList.add("fw-job-highlight");
    }
    return;
  }

  var positionText = mapDoc.querySelector(".positiontext");
  if (!positionText) { return; }

  var positionMatch = positionText.textContent.match(/Position X:\s*(-?\d+)\s*Y:\s*(-?\d+)/);
  if (!positionMatch) { return; }

  var playerX = parseInt(positionMatch[1], 10);
  var playerY = parseInt(positionMatch[2], 10);
  var targetX = jobDetails.position.x;
  var targetY = jobDetails.position.y;

  if (Math.sign(playerX) !== Math.sign(targetX)) { return; } // Overworld versus Dungeon

  var deltaX = targetX - playerX;
  var deltaY = targetY - playerY;

  var directionX = 0;
  var directionY = 0;

  if (deltaX < -1) {
    directionX = -1;
  } else if (deltaX > 1) {
    directionX = 1;
  }

  if (deltaY < -1) {
    directionY = -1;
  } else if (deltaY > 1) {
    directionY = 1;
  }

  var directionClass = "";
  if (directionX === 0 && directionY < 0) {
    directionClass = "north";
  } else if (directionX === 0 && directionY > 0) {
    directionClass = "south";
  } else if (directionX < 0 && directionY === 0) {
    directionClass = "west";
  } else if (directionX > 0 && directionY === 0) {
    directionClass = "east";
  } else if (directionX < 0 && directionY < 0) {
    directionClass = "northwest";
  } else if (directionX > 0 && directionY < 0) {
    directionClass = "northeast";
  } else if (directionX < 0 && directionY > 0) {
    directionClass = "southwest";
  } else if (directionX > 0 && directionY > 0) {
    directionClass = "southeast";
  }
  if (!directionClass) { return; }

  var rows = mapDoc.querySelectorAll(".maptable tr");
  if (rows.length < 3) { return; }

  var centerRow = Math.floor(rows.length / 2);
  var centerColumn = Math.floor(rows[centerRow].children.length / 2);
  var highlightTiles = [];
  if (directionClass === "north") {
    for (var x = centerColumn - 1; x <= centerColumn + 1; x++) {
      highlightTiles.push({ row: 0, column: x, direction: "north" });
    }
  } else if (directionClass === "south") {
    for (var x = centerColumn - 1; x <= centerColumn + 1; x++) {
      highlightTiles.push({ row: rows.length - 1, column: x, direction: "south" });
    }
  } else if (directionClass === "west") {
    for (var y = centerRow - 1; y <= centerRow + 1; y++) {
      highlightTiles.push({ row: y, column: 0, direction: "west" });
    }
  } else if (directionClass === "east") {
    for (var y = centerRow - 1; y <= centerRow + 1; y++) {
      highlightTiles.push({ row: y, column: rows[y].children.length - 1, direction: "east" });
    }
  } else if (directionClass === "northwest") {
    highlightTiles.push(
      { row: 0, column: 0, direction: "northwest" },
      { row: 0, column: 1, direction: "north" },
      { row: 1, column: 0, direction: "west" }
    );
  } else if (directionClass === "northeast") {
    highlightTiles.push(
      { row: 0, column: rows[0].children.length - 1, direction: "northeast" },
      { row: 0, column: rows[0].children.length - 2, direction: "north" },
      { row: 1, column: rows[1].children.length - 1, direction: "east" }
    );
  } else if (directionClass === "southwest") {
    highlightTiles.push(
      { row: rows.length - 1, column: 0, direction: "southwest" },
      { row: rows.length - 1, column: 1, direction: "south" },
      { row: rows.length - 2, column: 0, direction: "west" }
    );
  } else if (directionClass === "southeast") {
    highlightTiles.push(
      { row: rows.length - 1, column: rows[rows.length - 1].children.length - 1, direction: "southeast" },
      { row: rows.length - 1, column: rows[rows.length - 1].children.length - 2, direction: "south" },
      { row: rows.length - 2, column: rows[rows.length - 2].children.length - 1, direction: "east" }
    );
  }

  for (var i = 0; i < highlightTiles.length; i++) {
    var highlight = highlightTiles[i];
    if (!rows[highlight.row]) { continue; }

    var directionTile = rows[highlight.row].children[highlight.column];
    if (!directionTile) { continue; }

    directionTile.classList.add("fw-job-direction-highlight", "fw-job-direction-" + highlight.direction);
  }
}

function displayMapJobNpc(jobDetails) {
  var mapDoc = getMapDocument();
  if (!mapDoc) { return; }
  if (!jobDetails || !jobDetails.name) { return; }

  var styleId = "fw-job-npc-style";
  var style = mapDoc.getElementById(styleId);
  if (!style) {
    style = mapDoc.createElement("style");
    style.id = styleId;
    mapDoc.head.appendChild(style);
  }

  var css = `
    .framemapbg table td {
      position: relative;
    }
  `;

  for (var npcName in npcJobs) {
    if (!npcJobs.hasOwnProperty(npcName)) { continue; }

    var npc = npcJobs[npcName];
    if (npc.jobs.indexOf(jobDetails.name) === -1) { continue; }

    var selectors = [];

    for (var i = 0; i < npc.positions.length; i++) {
      selectors.push("#mapx" + npc.positions[i][0] + "y" + npc.positions[i][1] + " a:after");
    }

    css += `
      ${selectors.join(",\n      ")} {
        content: "${npcName}";
        z-index: 2;
        width: 50px;
        position: absolute;
        left: 0;
        top: 0;
        line-height: 120%;
        font-size: 10px;
        font-weight: 700;
        text-align: center;
        color: #004cff;
        background: #ccc;
        border-bottom: 1px solid #bababa;
        opacity: 0.7;
        -moz-border-radius-bottomleft: 6px;
        -moz-border-radius-bottomright: 6px;
        -webkit-border-bottom-left-radius: 6px;
        -webkit-border-bottom-right-radius: 6px;
      }
    `;
  }
  style.textContent = css;
}

function routine() {
  try {
    var jobDetails = getMainFrameJobDetails();

    if (jobDetails) {
      if (JSON.stringify(jobDetails) !== JSON.stringify(currentJobDetails)) {
        currentJobDetails = jobDetails;
        saveJobDetails(currentJobDetails);
      }
    }

    if (!currentJobDetails) { return; }

    var itemFrameJobName = getItemFrameJobName();
    if (!itemFrameJobName || itemFrameJobName !== currentJobDetails.name) {
      return;
    }

    displayJobDetails(currentJobDetails);
    displayMapHighlight(currentJobDetails);
    displayMapJobNpc(currentJobDetails);
  } catch (e) {
    console.error("FreewarJobDetails routine error:", e);
  }
}

function observeItemFrame() {
  try {
    var doc = getItemDocument();

    if (!doc || !doc.documentElement) {
      return;
    }

    if (observedItemDocument === doc) {
      return;
    }

    if (itemFrameObserver) {
      itemFrameObserver.disconnect();
      itemFrameObserver = null;
    }

    observedItemDocument = doc;

    jobDetailsStyle = null;
    jobDetailsBaseContent = null;

    itemFrameObserver = new MutationObserver(function () {
      routine();
    });

    itemFrameObserver.observe(doc.documentElement, {
      childList: true,
      subtree: true
    });

    routine();
  } catch (e) {
    console.error("observeItemFrame failed:", e);
  }
}

function init() {
  parseCoordinateResource();

  currentJobDetails = loadJobDetails();

  setInterval(function () {
    observeItemFrame();
    routine();
  }, 100);

  observeItemFrame();
  routine();
}

init();
