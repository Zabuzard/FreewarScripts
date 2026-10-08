// ==UserScript==
// @name        rune_puzzle_solver
// @namespace   Zabuza
// @description Assists solving the rune puzzle in Dranar
// @include     *.freewar.de/freewar/internal/main.php*
// @version     4
// ==/UserScript==

(function () {
  var PUZZLE_TEXT = "Ziel: Am Ende darf maximal ein neutrales Elemente existieren.";
  var STORAGE_KEY = "rune_puzzle_solver_solution";
  var GRID_SIZE = 6;
  var BLOCK_ROWS = 2;
  var BLOCK_COLS = 3;
  var HINT_OPACITY = "0.3";
  var DEBUG = true;

  var updateScheduled = false;
  var updating = false;
  var puzzleWasPresent = false;

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

        // Empty, unknown, neutral and current-position cells
        // are treated as empty by the solver.
        if (symbol === 0 || symbol === 7 ||
            symbol === 8 || symbol === 9) {
          grid[r][c] = 0;
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

        if (value === 0) {
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
        grid[bestRow][bestCol] = bestCandidates[i];
        search();
        grid[bestRow][bestCol] = 0;

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

      log("Restored original image:", img);
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

  function renderHints(table, solution) {
    var rendered = 0;

    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        var img = table.rows[r].cells[c].querySelector("img");

        if (!img) {
          continue;
        }

        var symbol = getSymbol(img);

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
      var puzzlePresent = document.body &&
        document.body.textContent.includes(PUZZLE_TEXT);

      if (!puzzlePresent) {
        if (puzzleWasPresent) {
          log("Puzzle disappeared.");
          clearSolution();
        }

        puzzleWasPresent = false;
        return;
      }

      if (!puzzleWasPresent) {
        log("Puzzle detected.");
      }

      puzzleWasPresent = true;

      var table = getGridTable();

      if (!table) {
        warn("Puzzle description found, but no grid table was detected.");
        clearSolution();
        return;
      }

      var grid = getGrid(table);

      if (!grid) {
        warn("Could not parse grid.");
        return;
      }

      var cachedSolution = loadSolution();

      // Prove uniqueness against the current clues.
      var result = countSolutions(cloneGrid(grid), 2);

      if (result.count !== 1) {
        log(result.count === 0
          ? "Puzzle has no valid solutions. Waiting for more clues."
          : "Puzzle has multiple solutions. Waiting for more clues.");

        clearSolution();
        clearHints(table);
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
        return true;
      }

      if (mutation.type === "attributes") {
        return mutation.target instanceof HTMLImageElement;
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
