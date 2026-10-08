// ==UserScript==
// @name        rune_puzzle_solver
// @namespace   Zabuza
// @description Assists solving the rune puzzle in Dranar
// @include     *.freewar.de/freewar/internal/main.php*
// @version     3
// ==/UserScript==

(function () {
  var PUZZLE_TEXT = "Ziel: Am Ende darf maximal ein neutrales Elemente existieren.";
  var STORAGE_KEY = "rune_puzzle_solver_solution";
  var GRID_SIZE = 6;
  var BLOCK_ROWS = 2;
  var BLOCK_COLS = 3;
  var HINT_OPACITY = "0.3";

  var updateScheduled = false;
  var updating = false;
  var puzzleWasPresent = false;

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

        // Our hint images represent empty cells, not fixed clues.
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

        // Empty, unknown, neutral and current-position cells
        // are all treated as empty by the solver.
        if (symbol === 0 || symbol === 7 ||
            symbol === 8 || symbol === 9) {
          grid[r][c] = 0;
        } else if (symbol >= 1 && symbol <= 6) {
          grid[r][c] = symbol;
        } else {
          return null;
        }
      }
    }

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

        if (value === 0) {
          continue;
        }

        grid[r][c] = 0;
        var valid = isValid(grid, r, c, value);
        grid[r][c] = value;

        if (!valid) {
          return false;
        }
      }
    }

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

    function search() {
      if (count >= limit) {
        return;
      }

      var bestRow = -1;
      var bestCol = -1;
      var bestCandidates = null;

      // Pick the empty cell with the fewest candidates.
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

      // No empty cells remain: one complete solution found.
      if (bestCandidates === null) {
        count++;

        if (count === 1) {
          firstSolution = cloneGrid(grid);
        }

        return;
      }

      for (var i = 0; i < bestCandidates.length; i++) {
        grid[bestRow][bestCol] = bestCandidates[i];
        search();
        grid[bestRow][bestCol] = 0;

        if (count >= limit) {
          return;
        }
      }
    }

    if (hasValidClues(grid)) {
      search();
    }

    return {
      count: count,
      solution: count === 1 ? firstSolution : null
    };
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
      // Continue without persistence if storage is unavailable.
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

    var hintSymbol = Number(img.dataset.rpsHintSymbol);
    var currentSymbol = getSymbol(img);

    // Restore only if the image is still our hint.
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

        // Only draw hints over genuinely empty a0.gif cells.
        if (symbol !== 0) {
          continue;
        }

        var value = solution[r][c];
        var expectedSrc = new URL(
          "../images/misc/minigame/a" + value + ".gif",
          document.baseURI
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
      var puzzlePresent = document.body &&
        document.body.textContent.includes(PUZZLE_TEXT);

      if (!puzzlePresent) {
        if (puzzleWasPresent) {
          clearSolution();
        }

        puzzleWasPresent = false;
        return;
      }

      puzzleWasPresent = true;

      var table = getGridTable();

      if (!table) {
        clearSolution();
        return;
      }

      var grid = getGrid(table);

      if (!grid) {
        return;
      }

      var cachedSolution = loadSolution();

      // Always prove uniqueness against the current clues.
      var result = countSolutions(cloneGrid(grid), 2);

      if (result.count !== 1) {
        clearSolution();
        clearHints(table);
        return;
      }

      var solution = result.solution;

      // Reuse the cached solution when it matches the unique solution.
      if (isSolutionCompatible(grid, cachedSolution) &&
          JSON.stringify(cachedSolution) === JSON.stringify(solution)) {
        solution = cachedSolution;
      } else {
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

  var observer = new MutationObserver(function (mutations) {
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
