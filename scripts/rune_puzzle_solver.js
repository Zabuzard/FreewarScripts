// ==UserScript==
// @name        rune_puzzle_solver
// @namespace   Zabuza
// @description Assists solving the rune puzzle in Dranar
// @include     *.freewar.de/freewar/internal/main.php*
// @version     1
// ==/UserScript==

(function () {
  var PUZZLE_TEXT = "Ziel: Am Ende darf maximal ein neutrales Elemente existieren.";
  var STORAGE_KEY = "rune_puzzle_solver_solution";
  var GRID_SIZE = 6;
  var BLOCK_ROWS = 2;
  var BLOCK_COLS = 3;
  var HINT_OPACITY = "0.3";

  var observer = null;
  var updateScheduled = false;
  var updating = false;

  // Only run on the actual rune puzzle page.
  if (!document.body || !document.body.textContent.includes(PUZZLE_TEXT)) {
    return;
  }

  function getSymbol(img) {
    var match = img.src.match(/\/a([0-9])\.gif(?:[?#].*)?$/);

    return match ? Number(match[1]) : null;
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
        return tables[i];
      }
    }

    return null;
  }

  function getGrid(table) {
    var grid = [];

    for (var r = 0; r < GRID_SIZE; r++) {
      grid[r] = [];

      for (var c = 0; c < GRID_SIZE; c++) {
        var img = table.rows[r].cells[c].querySelector("img");

        if (!img) {
          return null;
        }

        var symbol = getSymbol(img);

        if (symbol === null) {
          return null;
        }

        // Our own hint must still count as an empty cell.
        if (img.dataset.rpsHintSymbol) {
          if (symbol === Number(img.dataset.rpsHintSymbol)) {
            symbol = 0;
          } else {
            // The game changed this cell independently.
            delete img.dataset.rpsHintSymbol;
            delete img.dataset.rpsOriginalSrc;
            delete img.dataset.rpsOriginalOpacity;
          }
        }

        if (symbol === 9) {
          return {
            unknown: true
          };
        }

        // 0 = empty; 8 = current-position marker.
        // Only symbols 1-6 are fixed clues.
        if (symbol === 0 || symbol === 8) {
          grid[r][c] = 0;
        } else if (symbol >= 1 && symbol <= 6) {
          grid[r][c] = symbol;
        } else {
          return null;
        }
      }
    }

    return {
      grid: grid
    };
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

  function solve(grid) {
    var bestRow = -1;
    var bestCol = -1;
    var bestCandidates = null;

    // Choose the empty cell with the fewest possible symbols.
    // This makes backtracking considerably more efficient.
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] !== 0) {
          continue;
        }

        var candidates = [];

        for (var value = 1; value <= GRID_SIZE; value++) {
          if (isValid(grid, r, c, value)) {
            candidates.push(value);
          }
        }

        if (candidates.length === 0) {
          return false;
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
      return true;
    }

    for (var i = 0; i < bestCandidates.length; i++) {
      grid[bestRow][bestCol] = bestCandidates[i];

      if (solve(grid)) {
        return true;
      }
    }

    grid[bestRow][bestCol] = 0;
    return false;
  }

  function cloneGrid(grid) {
    return grid.map(function (row) {
      return row.slice();
    });
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

        if (grid[r][c] !== 0 && grid[r][c] !== value) {
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
        return null;
      }

      var data = JSON.parse(stored);

      return data && data.solution ? data.solution : null;
    } catch (error) {
      return null;
    }
  }

  function saveSolution(solution) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        solution: solution
      }));
    } catch (error) {
      // The solver can still work if storage is unavailable.
    }
  }

  function clearSolution() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore storage errors.
    }
  }

  function restoreHint(img) {
    if (!img.dataset.rpsHintSymbol) {
      return;
    }

    var originalSrc = img.dataset.rpsOriginalSrc;
    var originalOpacity = img.dataset.rpsOriginalOpacity;

    if (originalSrc && img.src === new URL(
        "../images/misc/minigame/a" +
        img.dataset.rpsHintSymbol + ".gif",
        img.src
    ).href) {
      img.src = originalSrc;
    }

    if (originalOpacity !== undefined) {
      img.style.opacity = originalOpacity;
    } else {
      img.style.removeProperty("opacity");
    }

    delete img.dataset.rpsHintSymbol;
    delete img.dataset.rpsOriginalSrc;
    delete img.dataset.rpsOriginalOpacity;
  }

  function clearHints(table) {
    var images = table.querySelectorAll("img[data-rps-hint-symbol]");

    images.forEach(function (img) {
      restoreHint(img);
    });
  }

  function renderHints(table, solution) {
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        var img = table.rows[r].cells[c].querySelector("img");

        if (!img) {
          continue;
        }

        var symbol = getSymbol(img);

        // Hints are only displayed on actual empty cells.
        if (symbol !== 0) {
          continue;
        }

        var value = solution[r][c];
        var expectedSrc = new URL(
          "../images/misc/minigame/a" + value + ".gif",
          img.src
        ).href;

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
      }
    }
  }

  function update() {
    if (updating) {
      return;
    }

    updating = true;

    try {
      if (!document.body ||
          !document.body.textContent.includes(PUZZLE_TEXT)) {
        return;
      }

      var table = getGridTable();

      if (!table) {
        return;
      }

      var result = getGrid(table);

      if (!result) {
        return;
      }

      if (result.unknown) {
        clearSolution();
        clearHints(table);
        return;
      }

      var grid = result.grid;
      var solution = loadSolution();

      if (!isSolutionCompatible(grid, solution)) {
        solution = cloneGrid(grid);

        if (!solve(solution)) {
          clearHints(table);
          return;
        }

        saveSolution(solution);
      }

      renderHints(table, solution);
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

  // Observe dynamic puzzle updates. Our own changes are idempotent:
  // once a hint is correct, rendering it again does not mutate the DOM.
  observer = new MutationObserver(function (mutations) {
    if (updating) {
      return;
    }

    var relevant = mutations.some(function (mutation) {
      if (mutation.type === "childList") {
        return true;
      }

      if (mutation.type === "attributes") {
        return mutation.target instanceof HTMLImageElement;
      }

      return false;
    });

    if (relevant) {
      scheduleUpdate();
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "style"]
  });

  update();
})();
