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
  var COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60;
  var PROFIT_ELEMENT_ID = "stock-profit-total";
  var companies = {};

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

    var html = cell.innerHTML;
    var sections = html.split(/Unternehmen:/);

    sections.forEach(function (section) {
      var companyMatch = section.match(/arrive_eval=watchstock&amp;corp_id=(\d+)/);
      if (!companyMatch) companyMatch = section.match(/arrive_eval=watchstock\?corp_id=(\d+)/);
      if (!companyMatch) return;

      var corpId = parseInt(companyMatch[1], 10);
      if (corpId < 1 || corpId > 6) return;

      var courseMatch = section.match(/Kurs:\s*<b>([\d.]+)<\/b>\s*Goldmünzen/);
      var purchaseMatch = section.match(/Dein durchschnittlicher Einkaufspreis:\s*<b>([\d.]+)<\/b>\s*Goldmünzen/);
      if (!courseMatch || !purchaseMatch) return;

      var course = parseGold(courseMatch[1]);
      var purchasePrice = parseGold(purchaseMatch[1]);
      if (course === null || purchasePrice === null) return;

      companies[corpId] = { course: course, purchasePrice: purchasePrice };
    });

    saveCompanies();
    updateProfitDisplay(cell);
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

      cell.insertBefore(document.createElement("br"), profitElement.nextSibling);
      cell.insertBefore(document.createElement("br"), profitElement.nextSibling);
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
    if (pageType === "overview") scanOverview();
    else if (pageType === "selling") handleSellingForm();
  }

  loadCompanies();

  var observer = new MutationObserver(function (mutations) {
    var relevantMutation = mutations.some(function (mutation) {
      var target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
      return !target || !target.closest("#" + PROFIT_ELEMENT_ID);
    });

    if (relevantMutation) scanPage();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(scanPage, 200);
  scanPage();
})();
