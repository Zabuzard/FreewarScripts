// ==UserScript==
// @name        rune_puzzle_solver
// @namespace   Zabuza
// @description Assists solving the rune puzzle in Dranar
// @include     *.freewar.de/freewar/internal/main.php*
// @version     1
// ==/UserScript==

(function () {
  var PUZZLE_TEXT = "Ziel: Am Ende darf maximal ein neutrales Elemente existieren.";
  var SECRET_TEXT = "Geheimnisvolles Element (Diesem Element sieht man nicht an, welcher Gruppe es zuzuordnen ist)";
  var STORAGE_KEY = "rune_puzzle_solver_solution";
  var UNKNOWN_SYMBOL_KEY = "rune_puzzle_solver_unknown_symbol";
  var TIMER_STORAGE_KEY = "rune_puzzle_solver_timer_started_at";
  var GRID_SIZE = 6;
  var BLOCK_ROWS = 3;
  var BLOCK_COLS = 2;
  var HINT_OPACITY = "0.3";
  var SELECTED_BORDER = "2px solid #00aa00";
  var UNSELECTED_BORDER = "2px solid transparent";
  var POSITION_HIGHLIGHT = "rgba(255, 220, 0, 0.4)";
  var POSITION_IMAGE_FILTER = "sepia(1) saturate(5) hue-rotate(350deg) brightness(1.15)";
  var POSITION_BLINK_STYLE_ID = "rps-position-blink-style";
  var DEBUG = false;

  var updateScheduled = false;
  var updating = false;
  var puzzleWasPresent = false;
  var selectedUnknownSymbol = loadUnknownSymbol();
  var timerStartedAt = loadTimerStartedAt();
  var timerInterval = null;

  function log() {
    if (!DEBUG) {
      return;
    }

    var args = Array.prototype.slice.call(arguments);
    args.unshift("[rune_puzzle_solver]");
    console.log.apply(console, args);
  }

  function warn() {
    if (!DEBUG) {
      return;
    }

    var args = Array.prototype.slice.call(arguments);
    args.unshift("[rune_puzzle_solver]");
    console.warn.apply(console, args);
  }

  function getSymbol(img) {
    var match = img.src.match(/\/a([0-9])\.gif(?:[?#].*)?$/);
    return match ? Number(match[1]) : null;
  }

  function getSymbolUrl(symbol) {
    return new URL(
      "../images/misc/minigame/a" + symbol + ".gif",
      document.baseURI
    ).href;
  }

  function loadUnknownSymbol() {
    try {
      var stored = localStorage.getItem(UNKNOWN_SYMBOL_KEY);
      var symbol = Number(stored);

      if (symbol >= 1 && symbol <= 6) {
        log("Loaded selected unknown symbol: a" + symbol);
        return symbol;
      }
    } catch (error) {
      warn("Failed to load selected unknown symbol:", error);
    }

    log("No unknown symbol selected.");
    return 0;
  }

  function saveUnknownSymbol(symbol) {
    selectedUnknownSymbol = symbol;

    try {
      if (symbol >= 1 && symbol <= 6) {
        localStorage.setItem(UNKNOWN_SYMBOL_KEY, String(symbol));
      } else {
        localStorage.removeItem(UNKNOWN_SYMBOL_KEY);
      }

      log("Saved selected unknown symbol:", symbol ? "a" + symbol : "none");
    } catch (error) {
      warn("Failed to save selected unknown symbol:", error);
    }
  }

  function loadTimerStartedAt() {
    try {
      var stored = sessionStorage.getItem(TIMER_STORAGE_KEY);
      var timestamp = Number(stored);

      if (stored && Number.isFinite(timestamp) && timestamp > 0) {
        log("Restored puzzle timer:", new Date(timestamp).toLocaleTimeString());
        return timestamp;
      }
    } catch (error) {
      warn("Failed to restore puzzle timer:", error);
    }

    return null;
  }

  function formatElapsedTime(seconds) {
    var minutes = Math.floor(seconds / 60);
    var remainingSeconds = seconds % 60;

    return minutes + ":" + String(remainingSeconds).padStart(2, "0");
  }

  function updateTimerDisplay() {
    var timer = document.getElementById("rps-timer-status");

    if (!timer || timerStartedAt === null) {
      return;
    }

    var elapsedSeconds = Math.floor((Date.now() - timerStartedAt) / 1000);
    elapsedSeconds = Math.floor(elapsedSeconds / 5) * 5;

    timer.textContent = "⏱ " + formatElapsedTime(elapsedSeconds);
    timer.style.color = elapsedSeconds > 60 ? "orange" : "";
  }

  function startTimer() {
    if (timerStartedAt !== null) {
      updateTimerDisplay();

      if (timerInterval === null) {
        timerInterval = setInterval(function () {
          updateTimerDisplay();
        }, 5000);
      }

      return;
    }

    timerStartedAt = Date.now();

    try {
      sessionStorage.setItem(TIMER_STORAGE_KEY, String(timerStartedAt));
    } catch (error) {
      warn("Failed to save puzzle timer:", error);
    }

    updateTimerDisplay();

    timerInterval = setInterval(function () {
      updateTimerDisplay();
    }, 5000);

    log("Puzzle timer started.");
  }

  function resetTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    timerStartedAt = null;

    try {
      sessionStorage.removeItem(TIMER_STORAGE_KEY);
    } catch (error) {
      warn("Failed to clear saved puzzle timer:", error);
    }

    var timer = document.getElementById("rps-timer-status");

    if (timer) {
      timer.textContent = "⏱ 0:00";
      timer.style.color = "";
    }
  }

  function updateMistakes(grid) {
    var mistakes = 0;

    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === 7) {
          mistakes++;
        }
      }
    }

    var display = document.getElementById("rps-mistakes-status");

    if (!display) {
      return;
    }

    display.textContent = "Fehler: " + mistakes;
    display.style.color = mistakes >= 2
      ? "#ff8585"
      : mistakes === 1
        ? "orange"
        : "";
  }

  function findSecretElement() {
    var elements = document.querySelectorAll("body *");
    var target = null;

    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];

      if (!element.textContent.includes(SECRET_TEXT)) {
        continue;
      }

      var childContainsText = false;

      for (var j = 0; j < element.children.length; j++) {
        if (element.children[j].textContent.includes(SECRET_TEXT)) {
          childContainsText = true;
          break;
        }
      }

      if (!childContainsText) {
        target = element;
        break;
      }
    }

    return target;
  }

  function updateSelectorAppearance(selector) {
    var images = selector.querySelectorAll("img[data-rps-symbol]");

    images.forEach(function (img) {
      var symbol = Number(img.dataset.rpsSymbol);
      var selected = symbol === selectedUnknownSymbol;

      img.style.border = selected ? SELECTED_BORDER : UNSELECTED_BORDER;
      img.style.backgroundColor = selected ? "#e0ffe0" : "transparent";
      img.style.opacity = selected ? "1" : "0.8";
    });
  }

  function updateSolutionStatus(count) {
    var status = document.getElementById("rps-solution-status");

    if (!status) {
      return;
    }

    status.textContent = "";

    var label = document.createElement("span");
    label.textContent = "Lösungen: ";
    status.appendChild(label);

    if (count === 0) {
      status.appendChild(document.createTextNode("keine ❌"));
    } else if (count === null) {
      status.appendChild(document.createTextNode("—"));
    } else {
      status.appendChild(document.createTextNode(String(count)));
    }
  }

  function addUnknownSymbolSelector() {
    var existing = document.getElementById("rps-unknown-selector");
    var target = findSecretElement();

    if (!target) {
      if (existing) {
        existing.remove();
        log("Removed unknown symbol selector: description not found.");
      }

      return;
    }

    if (existing) {
      if (existing.parentElement === target) {
        updateSelectorAppearance(existing);
        return;
      }

      existing.remove();
    }

    var selector = document.createElement("div");
    selector.id = "rps-unknown-selector";
    selector.style.marginTop = "6px";
    selector.style.display = "flex";
    selector.style.flexDirection = "column";
    selector.style.alignItems = "flex-start";
    selector.style.gap = "4px";

    var symbolsRow = document.createElement("div");
    symbolsRow.style.display = "flex";
    symbolsRow.style.alignItems = "center";
    symbolsRow.style.gap = "4px";

    for (var i = 1; i <= 6; i++) {
      var symbol = document.createElement("img");

      symbol.src = getSymbolUrl(i);
      symbol.alt = "a" + i;
      symbol.title = "Das unbekannte Element ist a" + i;
      symbol.dataset.rpsSymbol = String(i);
      symbol.style.cursor = "pointer";
      symbol.style.boxSizing = "border-box";
      symbol.style.padding = "2px";
      symbol.style.width = "24px";
      symbol.style.height = "24px";
      symbol.style.borderRadius = "3px";

      symbol.addEventListener("click", function () {
        var chosenSymbol = Number(this.dataset.rpsSymbol);
        var previousSymbol = selectedUnknownSymbol;

        clearSolution();

        if (previousSymbol !== chosenSymbol) {
          saveUnknownSymbol(chosenSymbol);
          log("Unknown symbol selected:", "a" + chosenSymbol);
        } else {
          saveUnknownSymbol(0);
          log("Unknown symbol deselected:", "a" + chosenSymbol);
        }

        updateSelectorAppearance(selector);
        updateSolutionStatus(null);
        scheduleUpdate();
      });

      symbolsRow.appendChild(symbol);
    }

    var status = document.createElement("div");
    status.id = "rps-solution-status";
    status.style.fontSize = "12px";
    status.style.fontWeight = "bold";

    var timer = document.createElement("div");
    timer.id = "rps-timer-status";
    timer.style.fontSize = "12px";
    timer.textContent = "⏱ 0:00";

    var mistakes = document.createElement("div");
    mistakes.id = "rps-mistakes-status";
    mistakes.style.fontSize = "12px";
    mistakes.textContent = "Fehler: 0";

    selector.appendChild(symbolsRow);
    selector.appendChild(status);
    selector.appendChild(timer);
    selector.appendChild(mistakes);
    target.appendChild(selector);

    updateSelectorAppearance(selector);
    updateSolutionStatus(null);
    updateTimerDisplay();

    log("Unknown symbol selector added.", {
      selectedSymbol: selectedUnknownSymbol || null,
      element: target
    });
  }

  function getGridTable() {
    var tables = document.querySelectorAll("table");

    for (var i = 0; i < tables.length; i++) {
      var rows = tables[i].rows;

      if (rows.length !== GRID_SIZE) {
        continue;
      }

      var valid = true;

      for (var r = 0; r < GRID_SIZE; r++) {
        if (rows[r].cells.length !== GRID_SIZE) {
          valid = false;
          break;
        }

        var img = rows[r].cells[0].querySelector("img");

        if (!img || getSymbol(img) === null) {
          valid = false;
          break;
        }
      }

      if (valid) {
        log("Grid table found:", tables[i]);
        return tables[i];
      }
    }

    log("No 6x6 grid table found.");
    return null;
  }

  function getGrid(table) {
    var grid = [];

    for (var r = 0; r < GRID_SIZE; r++) {
      grid[r] = [];

      for (var c = 0; c < GRID_SIZE; c++) {
        var img = table.rows[r].cells[c].querySelector("img");

        if (!img) {
          warn("Missing image at row", r, "column", c);
          return null;
        }

        var symbol = getSymbol(img);

        if (symbol === null) {
          warn("Unknown image source at row", r, "column", c, img.src);
          return null;
        }

        if (img.dataset.rpsHintSymbol) {
          if (symbol === Number(img.dataset.rpsHintSymbol)) {
            symbol = 0;
          } else {
            log("Game changed previously hinted cell:", r, c, symbol);
            delete img.dataset.rpsHintSymbol;
            delete img.dataset.rpsOriginalSrc;
            delete img.dataset.rpsOriginalOpacity;
          }
        }

        if (symbol === 9) {
          if (selectedUnknownSymbol >= 1 && selectedUnknownSymbol <= 6) {
            grid[r][c] = selectedUnknownSymbol;

            log("Using selected unknown symbol:", {
              row: r,
              column: c,
              symbol: selectedUnknownSymbol
            });
          } else {
            grid[r][c] = 0;
          }
        } else if (symbol === 0 || symbol === 8) {
          grid[r][c] = 0;
        } else if (symbol === 7) {
          grid[r][c] = 7;
        } else if (symbol >= 1 && symbol <= 6) {
          grid[r][c] = symbol;
        } else {
          warn("Unsupported symbol at row", r, "column", c, symbol);
          return null;
        }
      }
    }

    log("Parsed grid:\n" + grid.map(function (row) {
      return row.join(" ");
    }).join("\n"));

    return grid;
  }

  function isValid(grid, row, col, value) {
    for (var i = 0; i < GRID_SIZE; i++) {
      if (grid[row][i] === value || grid[i][col] === value) {
        return false;
      }
    }

    var startRow = Math.floor(row / BLOCK_ROWS) * BLOCK_ROWS;
    var startCol = Math.floor(col / BLOCK_COLS) * BLOCK_COLS;

    for (var r = startRow; r < startRow + BLOCK_ROWS; r++) {
      for (var c = startCol; c < startCol + BLOCK_COLS; c++) {
        if (grid[r][c] === value) {
          return false;
        }
      }
    }

    return true;
  }

  function hasValidClues(grid) {
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        var value = grid[r][c];

        if (value === 0 || value === 7) {
          continue;
        }

        grid[r][c] = 0;
        var valid = isValid(grid, r, c, value);
        grid[r][c] = value;

        if (!valid) {
          warn("Contradictory clue:", {
            row: r,
            column: c,
            value: value
          });
          return false;
        }
      }
    }

    log("All visible clues are consistent.");
    return true;
  }

  function cloneGrid(grid) {
    return grid.map(function (row) {
      return row.slice();
    });
  }

  function countSolutions(grid, limit) {
    var count = 0;
    var firstSolution = null;
    var exploredNodes = 0;

    function search() {
      if (count >= limit) {
        return;
      }

      exploredNodes++;

      var bestRow = -1;
      var bestCol = -1;
      var bestCandidates = null;

      for (var r = 0; r < GRID_SIZE; r++) {
        for (var c = 0; c < GRID_SIZE; c++) {
          if (grid[r][c] !== 0 && grid[r][c] !== 7) {
            continue;
          }

          var candidates = [];

          for (var value = 1; value <= GRID_SIZE; value++) {
            if (isValid(grid, r, c, value)) {
              candidates.push(value);
            }
          }

          if (candidates.length === 0) {
            return;
          }

          if (bestCandidates === null ||
              candidates.length < bestCandidates.length) {
            bestRow = r;
            bestCol = c;
            bestCandidates = candidates;
          }

          if (bestCandidates.length === 1) {
            break;
          }
        }

        if (bestCandidates && bestCandidates.length === 1) {
          break;
        }
      }

      if (bestCandidates === null) {
        count++;

        log("Found solution #" + count + ":\n" +
          grid.map(function (row) {
            return row.join(" ");
          }).join("\n"));

        if (count === 1) {
          firstSolution = cloneGrid(grid);
        }

        return;
      }

      for (var i = 0; i < bestCandidates.length; i++) {
        var previousValue = grid[bestRow][bestCol];
        grid[bestRow][bestCol] = bestCandidates[i];
        search();
        grid[bestRow][bestCol] = previousValue;

        if (count >= limit) {
          return;
        }
      }
    }

    log("Starting solution search. Limit:", limit);

    if (hasValidClues(grid)) {
      search();
    } else {
      log("Skipping search because clues contradict each other.");
    }

    log("Search finished:", {
      solutionsFound: count,
      limit: limit,
      exploredNodes: exploredNodes
    });

    return {
      count: count,
      solution: count === 1 ? firstSolution : null
    };
  }

  function detectUnknownSymbol(table) {
    if (selectedUnknownSymbol !== 0) {
      return false;
    }

    var possibleSymbols = [];
    var previousSelection = selectedUnknownSymbol;

    for (var symbol = 1; symbol <= 6; symbol++) {
      selectedUnknownSymbol = symbol;

      var grid = getGrid(table);

      if (!grid) {
        selectedUnknownSymbol = previousSelection;
        return false;
      }

      var result = countSolutions(cloneGrid(grid), 1);

      if (result.count > 0) {
        possibleSymbols.push(symbol);
      }

      if (possibleSymbols.length > 1) {
        break;
      }
    }

    selectedUnknownSymbol = previousSelection;

    if (possibleSymbols.length !== 1) {
      log("Automatic unknown-symbol detection inconclusive:", possibleSymbols);
      return false;
    }

    var detectedSymbol = possibleSymbols[0];

    log("Automatically detected unknown symbol:", "a" + detectedSymbol);

    clearSolution();
    saveUnknownSymbol(detectedSymbol);

    var selector = document.getElementById("rps-unknown-selector");

    if (selector) {
      updateSelectorAppearance(selector);
    }

    return true;
  }

  function isSolutionCompatible(grid, solution) {
    if (!Array.isArray(solution) || solution.length !== GRID_SIZE) {
      return false;
    }

    for (var r = 0; r < GRID_SIZE; r++) {
      if (!Array.isArray(solution[r]) ||
          solution[r].length !== GRID_SIZE) {
        return false;
      }

      for (var c = 0; c < GRID_SIZE; c++) {
        var value = solution[r][c];

        if (!Number.isInteger(value) || value < 1 || value > 6) {
          return false;
        }

        if (grid[r][c] !== 0 && grid[r][c] !== 7 &&
            grid[r][c] !== value) {
          log("Cached solution conflicts with clue:", {
            row: r,
            column: c,
            clue: grid[r][c],
            cachedValue: value
          });
          return false;
        }
      }
    }

    return true;
  }

  function loadSolution() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        log("No cached solution found.");
        return null;
      }

      var data = JSON.parse(stored);
      var solution = data && data.solution ? data.solution : null;

      log(solution ? "Loaded cached solution." : "Stored data is invalid.");
      return solution;
    } catch (error) {
      warn("Failed to load cached solution:", error);
      return null;
    }
  }

  function saveSolution(solution) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        solution: solution
      }));

      log("Saved unique solution to localStorage.");
    } catch (error) {
      warn("Failed to save solution:", error);
    }
  }

  function clearSolution() {
    try {
      var existed = localStorage.getItem(STORAGE_KEY) !== null;
      localStorage.removeItem(STORAGE_KEY);

      if (existed) {
        log("Cleared cached solution.");
      }
    } catch (error) {
      warn("Failed to clear cached solution:", error);
    }
  }

  function clearUnknownSymbol() {
    if (selectedUnknownSymbol !== 0) {
      log("Clearing selected unknown symbol:", "a" + selectedUnknownSymbol);
    }

    saveUnknownSymbol(0);

    var selector = document.getElementById("rps-unknown-selector");

    if (selector) {
      selector.remove();
    }
  }

  function restoreHint(img) {
    if (!img.dataset.rpsHintSymbol) {
      return;
    }

    var hintSymbol = Number(img.dataset.rpsHintSymbol);
    var currentSymbol = getSymbol(img);

    if (currentSymbol === hintSymbol) {
      if (img.dataset.rpsOriginalSrc !== undefined) {
        img.setAttribute("src", img.dataset.rpsOriginalSrc);
      }

      if (img.dataset.rpsOriginalOpacity !== undefined) {
        img.style.opacity = img.dataset.rpsOriginalOpacity;
      } else {
        img.style.removeProperty("opacity");
      }
    }

    delete img.dataset.rpsHintSymbol;
    delete img.dataset.rpsOriginalSrc;
    delete img.dataset.rpsOriginalOpacity;
  }

  function clearHints(table) {
    var images = table.querySelectorAll("img[data-rps-hint-symbol]");

    if (images.length > 0) {
      log("Clearing", images.length, "hints.");
    }

    images.forEach(function (img) {
      restoreHint(img);
    });
  }

  function clearLegendHighlight() {
    var images = document.querySelectorAll("img[data-rps-legend-highlight]");

    images.forEach(function (img) {
      if (img.dataset.rpsLegendOriginalBorder !== undefined) {
        img.style.border = img.dataset.rpsLegendOriginalBorder;
      } else {
        img.style.removeProperty("border");
      }

      if (img.dataset.rpsLegendOriginalBackground !== undefined) {
        img.style.backgroundColor = img.dataset.rpsLegendOriginalBackground;
      } else {
        img.style.removeProperty("background-color");
      }

      if (img.dataset.rpsLegendOriginalFilter !== undefined) {
        img.style.filter = img.dataset.rpsLegendOriginalFilter;
      } else {
        img.style.removeProperty("filter");
      }

      delete img.dataset.rpsLegendHighlight;
      delete img.dataset.rpsLegendOriginalBorder;
      delete img.dataset.rpsLegendOriginalBackground;
      delete img.dataset.rpsLegendOriginalFilter;
    });
  }

  function highlightLegendTile(table, symbol) {
    clearLegendHighlight();

    if (!symbol) {
      return;
    }

    var gridRect = table.getBoundingClientRect();
    var images = document.querySelectorAll("img");
    var bestImage = null;
    var bestDistance = Infinity;

    for (var i = 0; i < images.length; i++) {
      var img = images[i];

      if (table.contains(img) ||
          img.closest("#rps-unknown-selector")) {
        continue;
      }

      if (getSymbol(img) !== symbol) {
        continue;
      }

      var rect = img.getBoundingClientRect();
      var centerY = rect.top + rect.height / 2;

      if (rect.left < gridRect.right - 2 ||
          centerY < gridRect.top ||
          centerY > gridRect.bottom) {
        continue;
      }

      var distance = rect.left - gridRect.right;

      if (distance < bestDistance) {
        bestDistance = distance;
        bestImage = img;
      }
    }

    if (!bestImage) {
      log("Could not find legend tile a" + symbol + " to highlight.");
      return;
    }

    bestImage.dataset.rpsLegendOriginalBorder = bestImage.style.border;
    bestImage.dataset.rpsLegendOriginalBackground =
      bestImage.style.backgroundColor;
    bestImage.dataset.rpsLegendOriginalFilter = bestImage.style.filter;
    bestImage.dataset.rpsLegendHighlight = String(symbol);

    bestImage.style.backgroundColor = POSITION_HIGHLIGHT;
    bestImage.style.filter = POSITION_IMAGE_FILTER;

    log("Tinted and blinking legend tile:", "a" + symbol, bestImage);
  }

  function findCurrentPositionImage(table) {
    var images = table.querySelectorAll("img");

    for (var i = 0; i < images.length; i++) {
      if (getSymbol(images[i]) === 8) {
        return images[i];
      }
    }

    return null;
  }

  function addPositionBlinkStyle() {
    if (document.getElementById(POSITION_BLINK_STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = POSITION_BLINK_STYLE_ID;
    style.textContent = `
      @keyframes rps-position-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      img[data-rps-position-highlight],
      img[data-rps-legend-highlight] {
        animation: rps-position-blink 1s infinite;
      }
    `;

    document.head.appendChild(style);
  }

  function highlightCurrentPositionImage(table) {
    var img = findCurrentPositionImage(table);

    if (!img || img.dataset.rpsPositionHighlight) {
      return;
    }

    addPositionBlinkStyle();

    img.dataset.rpsPositionOriginalFilter = img.style.filter;
    img.dataset.rpsPositionHighlight = "true";
    img.style.filter = POSITION_IMAGE_FILTER;

    log("Tinted and blinking current-position image.", img);
  }

  function clearCurrentPositionHighlight() {
    var images = document.querySelectorAll("img[data-rps-position-highlight]");

    images.forEach(function (img) {
      if (img.dataset.rpsPositionOriginalFilter !== undefined) {
        img.style.filter = img.dataset.rpsPositionOriginalFilter;
      } else {
        img.style.removeProperty("filter");
      }

      delete img.dataset.rpsPositionHighlight;
      delete img.dataset.rpsPositionOriginalFilter;
    });
  }

  function renderCurrentPosition(table, solution) {
    var img = findCurrentPositionImage(table);

    if (!img) {
      log("No current-position image found.");
      clearLegendHighlight();
      return;
    }

    var row = -1;
    var col = -1;

    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        if (table.rows[r].cells[c].contains(img)) {
          row = r;
          col = c;
          break;
        }
      }

      if (row !== -1) {
        break;
      }
    }

    if (row === -1 || col === -1) {
      warn("Could not determine current-position coordinates.");
      return;
    }

    var symbol = solution[row][col];

    highlightLegendTile(table, symbol);

    log("Highlighted legend for current position:", {
      row: row,
      column: col,
      symbol: symbol
    });
  }

  function renderHints(table, solution) {
    var rendered = 0;

    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        var img = table.rows[r].cells[c].querySelector("img");

        if (!img) {
          continue;
        }

        var symbol = getSymbol(img);

        if (symbol === 8) {
          continue;
        }

        if (img.dataset.rpsHintSymbol &&
            symbol === Number(img.dataset.rpsHintSymbol)) {
          symbol = 0;
        }

        if (symbol !== 0) {
          continue;
        }

        var value = solution[r][c];
        var expectedSrc = getSymbolUrl(value);

        if (img.dataset.rpsHintSymbol &&
            Number(img.dataset.rpsHintSymbol) === value &&
            img.src === expectedSrc &&
            img.style.opacity === HINT_OPACITY) {
          continue;
        }

        if (img.dataset.rpsHintSymbol) {
          restoreHint(img);
        }

        img.dataset.rpsOriginalSrc = img.getAttribute("src");
        img.dataset.rpsOriginalOpacity = img.style.opacity;
        img.dataset.rpsHintSymbol = String(value);

        img.src = expectedSrc;
        img.style.opacity = HINT_OPACITY;
        rendered++;

        log("Rendered hint:", {
          row: r,
          column: c,
          symbol: value
        });
      }
    }

    log("Hint rendering finished. New hints:", rendered);
  }

  function update() {
    if (updating) {
      log("Update skipped: already updating.");
      return;
    }

    updating = true;

    try {
      var bodyText = document.body ? document.body.textContent : "";
      var puzzlePresent = bodyText.includes(PUZZLE_TEXT) &&
        !bodyText.includes("Klicke auf eins der Elemente, um einen neuen Versuch zu starten");

      if (!puzzlePresent) {
        resetTimer();
        clearSolution();
        clearUnknownSymbol();
        clearLegendHighlight();
        clearCurrentPositionHighlight();

        if (puzzleWasPresent) {
          log("Puzzle disappeared.");
        }

        puzzleWasPresent = false;
        return;
      }

      if (!puzzleWasPresent) {
        log("Puzzle detected.");
      }

      puzzleWasPresent = true;

      addUnknownSymbolSelector();

      var table = getGridTable();

      if (!table) {
        warn("Puzzle description found, but no grid table was detected.");
        updateSolutionStatus(null);
        clearSolution();
        clearLegendHighlight();
        clearCurrentPositionHighlight();
        return;
      }

      startTimer();
      highlightCurrentPositionImage(table);

      if (selectedUnknownSymbol === 0) {
        detectUnknownSymbol(table);
      }

      var grid = getGrid(table);

      if (!grid) {
        warn("Could not parse grid.");
        updateSolutionStatus(null);
        return;
      }

      updateMistakes(grid);

      var cachedSolution = loadSolution();
      var result = countSolutions(cloneGrid(grid), 2);

      updateSolutionStatus(result.count);

      if (result.count !== 1) {
        log(result.count === 0
          ? "Puzzle has no valid solutions. Waiting for more clues."
          : "Puzzle has multiple solutions. Waiting for more clues.");

        clearSolution();
        clearHints(table);
        clearLegendHighlight();
        return;
      }

      var solution = result.solution;

      if (isSolutionCompatible(grid, cachedSolution) &&
          JSON.stringify(cachedSolution) === JSON.stringify(solution)) {
        log("Unique solution confirmed; reusing cached solution.");
        solution = cachedSolution;
      } else {
        log("Unique solution found; updating cache.");
        saveSolution(solution);
      }

      renderHints(table, solution);
      renderCurrentPosition(table, solution);
    } catch (error) {
      console.error("[rune_puzzle_solver] Unexpected error:", error);
    } finally {
      updating = false;
    }
  }

  function scheduleUpdate() {
    if (updateScheduled) {
      return;
    }

    updateScheduled = true;

    setTimeout(function () {
      updateScheduled = false;
      update();
    }, 0);
  }

  var observer = new MutationObserver(function (mutations) {
    if (updating) {
      return;
    }

    var relevant = mutations.some(function (mutation) {
      if (mutation.type === "childList") {
        var target = mutation.target;

        if (target.nodeType === Node.ELEMENT_NODE &&
            target.closest("#rps-unknown-selector")) {
          return false;
        }

        var changedNodes = Array.prototype.slice.call(mutation.addedNodes)
          .concat(Array.prototype.slice.call(mutation.removedNodes));

        if (changedNodes.length > 0 && changedNodes.every(function (node) {
          return node.nodeType === Node.ELEMENT_NODE &&
            (node.id === "rps-unknown-selector" ||
             node.closest("#rps-unknown-selector"));
        })) {
          return false;
        }

        return true;
      }

      if (mutation.type === "attributes") {
        var target = mutation.target;

        if (target instanceof HTMLImageElement &&
            (target.dataset.rpsHintSymbol ||
             target.dataset.rpsLegendHighlight ||
             target.dataset.rpsPositionHighlight)) {
          return false;
        }

        if (target.closest &&
            target.closest("#rps-unknown-selector")) {
          return false;
        }

        return target instanceof HTMLImageElement;
      }

      return false;
    });

    if (relevant) {
      log("Relevant DOM mutations detected:", mutations.length);
      scheduleUpdate();
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "style"]
  });

  log("Observer installed.");
  update();
})();
