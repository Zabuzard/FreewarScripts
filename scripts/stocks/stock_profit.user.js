// ==UserScript==
// @name        stock_profit
// @namespace   Zabuza
// @description Shows the total profit made by selling stocks at the exchange in Freewar.
// @include     *.freewar.de/freewar/internal/main.php*
// @version     1
// ==/UserScript==

(function () {
  var STORAGE_KEY = "stock_profit_total";
  var COMPANIES_KEY = "stock_profit_companies";
  var STOCK_HISTORY_KEY = "stock_profit_history";
  var API_URL = "http://limejuice.duckdns.org:8629/freewar/stocks/api";
  var API_INTERVAL = 60 * 1000;
  var COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60;
  var PROFIT_ELEMENT_ID = "stock-profit-total";
  var HISTORY_ELEMENT_CLASS = "stock-profit-history";
  var DEVIATION_ELEMENT_CLASS = "stock-profit-deviation";
  var companies = {};
  var stockHistory = {};
  var lastApiCall = 0;
  var apiRequestInProgress = false;
  var observer = null;

  function getStoredValue(key) {
    try {
      var value = localStorage.getItem(key);
      if (value !== null) return value;
    } catch (e) {}

    var match = document.cookie.match(new RegExp("(?:^|; )" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setStoredValue(key, value) {
    try {
      localStorage.setItem(key, value);
      return;
    } catch (e) {}

    document.cookie = key + "=" + encodeURIComponent(value) + "; max-age=" + COOKIE_MAX_AGE + "; path=/; SameSite=Lax";
  }

  function parseGold(value) {
    var parsed = parseInt(value.replace(/\./g, "").replace(/[^\d-]/g, ""), 10);
    return isNaN(parsed) ? null : parsed;
  }

  function formatGold(value) {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function loadCompanies() {
    try {
      companies = JSON.parse(getStoredValue(COMPANIES_KEY) || "{}");
    } catch (e) {
      companies = {};
    }
  }

  function saveCompanies() {
    setStoredValue(COMPANIES_KEY, JSON.stringify(companies));
  }

  function loadStockHistory() {
    try {
      stockHistory = JSON.parse(getStoredValue(STOCK_HISTORY_KEY) || "{}");
    } catch (e) {
      stockHistory = {};
    }
  }

  function saveStockHistory() {
    setStoredValue(STOCK_HISTORY_KEY, JSON.stringify(stockHistory));
  }

  function getPageType() {
    if (document.querySelector('a[href*="arrive_eval=stocksell&corp_id="]')) return "overview";
    if (document.querySelector('form[action*="arrive_eval=stocksell2"] input[name="corp_id"]') &&
      document.querySelector('form[action*="arrive_eval=stocksell2"] select[name="anzahl"]')) return "selling";
    return "other";
  }

  function scanOverview() {
    var links = document.querySelectorAll('a[href*="arrive_eval=stocksell&corp_id="]');
    if (!links.length) return;

    var cell = links[0].closest("td");
    if (!cell) return;

    var courseNodes = cell.querySelectorAll("b");
    courseNodes.forEach(function (bold) {
      var previous = bold.previousSibling;
      if (previous && previous.nodeType === Node.TEXT_NODE && previous.textContent.includes("Kurs:")) {
        bold.style.color = "#65a9ff";
      }
    });

    var sections = cell.innerHTML.split(/Unternehmen:/);

    sections.forEach(function (section) {
      var companyMatch = section.match(/arrive_eval=watchstock&amp;corp_id=(\d+)/);
      if (!companyMatch) companyMatch = section.match(/arrive_eval=watchstock\?corp_id=(\d+)/);
      if (!companyMatch) return;

      var corpId = parseInt(companyMatch[1], 10);
      if (corpId < 1 || corpId > 6) return;

      var courseMatch = section.match(/Kurs:\s*<b[^>]*>([\d.]+)<\/b>\s*Goldmünzen/);
      var purchaseMatch = section.match(/Dein durchschnittlicher Einkaufspreis:\s*<b[^>]*>([\d.]+)<\/b>\s*Goldmünzen/);
      if (!courseMatch || !purchaseMatch) return;

      var course = parseGold(courseMatch[1]);
      var purchasePrice = parseGold(purchaseMatch[1]);
      if (course === null || purchasePrice === null) return;

      companies[corpId] = { course: course, purchasePrice: purchasePrice };
    });

    saveCompanies();
    updateProfitDisplay(cell);
    updateAllHistoryDisplays(cell);
  }

  function updateProfitDisplay(cell) {
    var totalProfit = parseInt(getStoredValue(STORAGE_KEY) || "0", 10);
    if (isNaN(totalProfit)) totalProfit = 0;

    var profitElement = document.getElementById(PROFIT_ELEMENT_ID);
    if (!profitElement) {
      profitElement = document.createElement("span");
      profitElement.id = PROFIT_ELEMENT_ID;

      var description = cell.firstChild;
      while (description && !(description.nodeType === Node.TEXT_NODE && description.textContent.trim().startsWith("Du stehst vor einem großen Gebäude"))) {
        description = description.nextSibling;
      }

      if (description) {
        var lastDescriptionBreak = description;
        while (lastDescriptionBreak.nextSibling && lastDescriptionBreak.nextSibling.nodeName !== "BR") {
          lastDescriptionBreak = lastDescriptionBreak.nextSibling;
        }

        var insertAfter = lastDescriptionBreak.nextSibling;
        if (insertAfter && insertAfter.nodeName === "BR") {
          insertAfter = insertAfter.nextSibling;
          if (insertAfter && insertAfter.nodeName === "BR") insertAfter = insertAfter.nextSibling;
        }

        cell.insertBefore(profitElement, insertAfter || null);
      } else {
        cell.insertBefore(profitElement, cell.firstChild);
      }

      var firstBreak = document.createElement("br");
      firstBreak.dataset.stockProfitOwned = "true";
      var secondBreak = document.createElement("br");
      secondBreak.dataset.stockProfitOwned = "true";
      cell.insertBefore(firstBreak, profitElement.nextSibling);
      cell.insertBefore(secondBreak, profitElement.nextSibling);
    }

    if (profitElement.dataset.profit !== String(totalProfit)) {
      profitElement.textContent = "Durch Verkauf bisher erwirtschafteter Profit: ";

      var amount = document.createElement("span");
      amount.style.color = "#009900";
      amount.style.fontWeight = "bold";
      amount.textContent = formatGold(totalProfit);
      profitElement.appendChild(amount);

      var currency = document.createElement("strong");
      currency.textContent = " Goldmünzen";
      profitElement.appendChild(currency);

      profitElement.dataset.profit = String(totalProfit);
    }

    var historyLinkId = "stock-profit-history-link";
    var historyLink = document.getElementById(historyLinkId);

    if (!historyLink) {
      var linkBreak = document.createElement("br");
      linkBreak.id = historyLinkId + "-break";
      linkBreak.dataset.stockProfitOwned = "true";

      historyLink = document.createElement("a");
      historyLink.id = historyLinkId;
      historyLink.href = "http://limejuice.duckdns.org:8629/freewar/stocks";
      historyLink.target = "_blank";
      historyLink.rel = "noopener noreferrer";
      historyLink.textContent = "(Kurshistorien)";
      historyLink.dataset.stockProfitOwned = "true";

      profitElement.parentNode.insertBefore(linkBreak, profitElement.nextSibling);
      profitElement.parentNode.insertBefore(historyLink, linkBreak.nextSibling);
    }
  }

  function fetchStockHistory() {
    if (apiRequestInProgress || Date.now() - lastApiCall < API_INTERVAL) return;

    lastApiCall = Date.now();
    apiRequestInProgress = true;

    fetch(API_URL)
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        var updatedHistory = {};

        Object.keys(data).forEach(function (key) {
          var company = data[key];
          var corpId = parseInt(key, 10);
          if (corpId < 1 || corpId > 6 || !company) return;

          var min = Number(company.min);
          var max = Number(company.max);
          var median = Number(company.median);
          if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(median)) return;

          updatedHistory[corpId] = {
            min: min,
            max: max,
            median: median
          };
        });

        stockHistory = updatedHistory;
        saveStockHistory();

        var link = document.querySelector('a[href*="arrive_eval=stocksell&corp_id="]');
        if (link) {
          var cell = link.closest("td");
          if (cell) updateAllHistoryDisplays(cell);
        }
      })
      .catch(function () {})
      .then(function () {
        apiRequestInProgress = false;
      });
  }

  function updateAllHistoryDisplays(cell) {
    if (!cell) return;

    if (observer) observer.disconnect();

    try {
      var sellLinks = cell.querySelectorAll('a[href*="arrive_eval=stocksell&corp_id="]');

      sellLinks.forEach(function (sellLink) {
        var match = sellLink.href.match(/arrive_eval=stocksell&corp_id=(\d+)/);
        if (!match) return;

        var corpId = parseInt(match[1], 10);
        var history = stockHistory[corpId];
        if (!history) return;

        var historyId = "stock-profit-history-" + corpId;
        var historyElement = cell.querySelector("#" + historyId);
        var historyBreak = cell.querySelector("#" + historyId + "-break");
        var historyBreakAfter = cell.querySelector("#" + historyId + "-break-after");

        if (!historyElement) {
          var companyLink = cell.querySelector(
            'a[href*="arrive_eval=watchstock&corp_id=' + corpId + '"]'
          );
          if (!companyLink) return;

          var node = companyLink;
          var purchaseText = null;

          while ((node = node.nextSibling)) {
            if (node.nodeType === Node.ELEMENT_NODE &&
              node.tagName === "A" &&
              node.href.match(/arrive_eval=watchstock&corp_id=\d+/)) {
              break;
            }

            if (node.nodeType === Node.TEXT_NODE &&
              node.textContent.includes("Dein durchschnittlicher Einkaufspreis:")) {
              purchaseText = node;
              break;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
              var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
              var textNode;

              while ((textNode = walker.nextNode())) {
                if (textNode.textContent.includes("Dein durchschnittlicher Einkaufspreis:")) {
                  purchaseText = textNode;
                  break;
                }
              }

              if (purchaseText) break;
            }
          }

          if (!purchaseText) return;

          historyBreak = document.createElement("br");
          historyBreak.id = historyId + "-break";
          historyBreak.dataset.stockProfitOwned = "true";

          historyElement = document.createElement("span");
          historyElement.id = historyId;
          historyElement.className = HISTORY_ELEMENT_CLASS;
          historyElement.dataset.stockProfitOwned = "true";

          historyBreakAfter = document.createElement("br");
          historyBreakAfter.id = historyId + "-break-after";
          historyBreakAfter.dataset.stockProfitOwned = "true";

          purchaseText.parentNode.insertBefore(historyBreak, purchaseText);
          purchaseText.parentNode.insertBefore(historyElement, purchaseText);
          purchaseText.parentNode.insertBefore(historyBreakAfter, purchaseText);
        } else {
          if (!historyBreak) {
            historyBreak = document.createElement("br");
            historyBreak.id = historyId + "-break";
            historyBreak.dataset.stockProfitOwned = "true";
            historyElement.parentNode.insertBefore(historyBreak, historyElement);
          }

          if (!historyBreakAfter) {
            historyBreakAfter = document.createElement("br");
            historyBreakAfter.id = historyId + "-break-after";
            historyBreakAfter.dataset.stockProfitOwned = "true";
            historyElement.parentNode.insertBefore(historyBreakAfter, historyElement.nextSibling);
          }
        }

        var previous = historyBreak.previousSibling;
        while (previous && previous.nodeType === Node.TEXT_NODE && !previous.textContent.trim()) {
          previous = previous.previousSibling;
        }

        if (previous && previous.nodeName === "BR" && previous !== historyBreak) {
          previous.remove();
        }

        var min = Number(history.min);
        var median = Number(history.median);
        var max = Number(history.max);

        historyElement.innerHTML = "Historie: min " + formatGold(min) +
          ", median <b style=\"color: #fca96a;\">" + formatGold(median) + "</b>" +
          ", max " + formatGold(max);

        var historyValues = historyElement.textContent.match(
          /Historie:\s*min\s*([\d.]+),\s*median\s*([\d.]+),\s*max\s*([\d.]+)/
        );
        if (!historyValues) return;

        min = parseGold(historyValues[1]);
        median = parseGold(historyValues[2]);
        max = parseGold(historyValues[3]);

        var company = companies[corpId];
        var currentCourse = company ? Number(company.course) : null;
        var deviation = null;
        var goldDifference = null;

        if (currentCourse !== null && Number.isFinite(currentCourse)) {
          goldDifference = Math.abs(currentCourse - median);

          if (currentCourse > median && max !== median) {
            deviation = ((currentCourse - median) / (max - median)) * 100;
          } else if (currentCourse < median && median !== min) {
            deviation = ((currentCourse - median) / (median - min)) * 100;
          } else if (currentCourse === median) {
            deviation = 0;
          }
        }

        var deviationId = "stock-profit-deviation-" + corpId;
        var deviationElement = cell.querySelector("#" + deviationId);

        if (deviation !== null && goldDifference !== null) {
          if (!deviationElement) {
            deviationElement = document.createElement("span");
            deviationElement.id = deviationId;
            deviationElement.className = DEVIATION_ELEMENT_CLASS;
            deviationElement.dataset.stockProfitOwned = "true";
            historyElement.parentNode.insertBefore(deviationElement, historyElement.nextSibling);
          }

          deviationElement.innerHTML = "";
          var isPositive = deviation > 0;
          var isNegative = deviation < 0;
          var isExtreme = Math.abs(deviation) > 50;

          deviationElement.style.fontWeight = isExtreme ? "bold" : "normal";

          var deviationLabel = document.createTextNode(", Abweichung: ");
          deviationElement.appendChild(deviationLabel);

          var percentage = document.createElement("span");
          percentage.style.color = isPositive
            ? (isExtreme ? "#4ade80" : "#39734d")
            : isNegative
              ? (isExtreme ? "#ff6464" : "#8a4141")
              : "#39734d";
          percentage.textContent = (deviation > 0 ? "+" : "") + Math.round(deviation) + "%";
          deviationElement.appendChild(percentage);

          var goldAmount = document.createElement("span");
          goldAmount.style.color = isExtreme
            ? (isPositive ? "#4ade80" : "#ff6464")
            : "#65a9ff";
          goldAmount.textContent = " (" + formatGold(goldDifference) + "g)";
          deviationElement.appendChild(goldAmount);

          if (deviation < -50 || deviation > 50) {
            var signal = document.createElement("span");
            signal.style.marginLeft = "4px";
            signal.style.display = "inline-block";
            signal.style.width = "13px";
            signal.style.height = "13px";
            signal.style.lineHeight = "12px";
            signal.style.textAlign = "center";
            signal.style.border = "1px solid " + (deviation < -50 ? "#4ade80" : "#ff6464");
            signal.style.borderRadius = "50%";
            signal.style.color = deviation < -50 ? "#4ade80" : "#ff6464";
            signal.style.fontSize = "11px";
            signal.style.fontWeight = "bold";
            signal.textContent = deviation < -50 ? "+" : "−";
            signal.title = deviation < -50
              ? "Aktien kaufen"
              : "Aktien verkaufen";
            deviationElement.appendChild(signal);
          }
        } else if (deviationElement) {
          deviationElement.remove();
        }
      });
    } finally {
      if (observer) {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    }
  }

  function handleSellingForm() {
    var form = document.querySelector('form[action*="arrive_eval=stocksell2"]');
    if (!form || form.dataset.stockProfitBound) return;

    form.dataset.stockProfitBound = "true";

    form.addEventListener("submit", function () {
      var corpInput = form.querySelector('input[name="corp_id"]');
      var amountSelect = form.querySelector('select[name="anzahl"]');
      if (!corpInput || !amountSelect) return;

      var corpId = parseInt(corpInput.value, 10);
      var amount = parseInt(amountSelect.value, 10);
      var company = companies[corpId];
      if (!company || isNaN(amount) || amount <= 0) return;

      var profit = (company.course - company.purchasePrice) * amount;
      var totalProfit = parseInt(getStoredValue(STORAGE_KEY) || "0", 10);
      if (isNaN(totalProfit)) totalProfit = 0;

      totalProfit += profit;
      setStoredValue(STORAGE_KEY, totalProfit);
    });
  }

  function scanPage() {
    var pageType = getPageType();
    if (pageType === "overview") {
      scanOverview();
      fetchStockHistory();
    } else if (pageType === "selling") {
      handleSellingForm();
    }
  }

  loadCompanies();
  loadStockHistory();

  observer = new MutationObserver(function (mutations) {
    var relevantMutation = mutations.some(function (mutation) {
      var target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
      if (!target) return true;

      if (target.closest("#" + PROFIT_ELEMENT_ID)) return false;
      if (target.closest("." + HISTORY_ELEMENT_CLASS)) return false;
      if (target.closest("." + DEVIATION_ELEMENT_CLASS)) return false;
      if (target.closest('[data-stock-profit-owned="true"]')) return false;

      var addedNodes = Array.from(mutation.addedNodes || []);
      if (addedNodes.length && addedNodes.every(function (node) {
        return node.nodeType === Node.ELEMENT_NODE &&
          (node.matches("#" + PROFIT_ELEMENT_ID + ", ." + HISTORY_ELEMENT_CLASS + ", ." + DEVIATION_ELEMENT_CLASS + ', [data-stock-profit-owned="true"]') ||
            node.querySelector("#" + PROFIT_ELEMENT_ID + ", ." + HISTORY_ELEMENT_CLASS + ", ." + DEVIATION_ELEMENT_CLASS + ', [data-stock-profit-owned="true"]'));
      })) return false;

      return true;
    });

    if (relevantMutation) scanPage();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(scanPage, 200);
  scanPage();
})();
