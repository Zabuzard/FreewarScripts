// ==UserScript==
// @name        stock_profit
// @namespace   Zabuza
// @description Shows the total profit made by selling stocks at the exchange in Freewar.
// @include     *.freewar.de/freewar/internal/main.php*
// @version     1
// ==/UserScript==

(function () {
  var STORAGE_KEY = "stock_profit_total";
  var COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60;
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

  function getPageType() {
    if (document.querySelector('a[href*="arrive_eval=stocksell&corp_id="]')) return "overview";
    if (document.querySelector('form[action*="arrive_eval=stocksell2"] input[name="corp_id"]') &&
      document.querySelector('form[action*="arrive_eval=stocksell2"] select[name="anzahl"]')) return "selling";
    return "other";
  }

  function scanOverview() {
    var links = document.querySelectorAll('a[href*="arrive_eval=stocksell&corp_id="]');
    if (!links.length) return;

    links.forEach(function (link) {
      var match = link.href.match(/[?&]corp_id=(\d+)/);
      if (!match) return;

      var corpId = parseInt(match[1], 10);
      if (corpId < 1 || corpId > 6) return;

      var cell = link.closest("td");
      if (!cell) return;

      var text = cell.innerText;
      var companyStart = text.indexOf("Kurs:");
      if (companyStart === -1) return;

      var section = text.substring(companyStart);
      var courseMatch = section.match(/Kurs:\s*([\d.]+)\s*Goldmünzen/);
      var purchaseMatch = section.match(/Dein durchschnittlicher Einkaufspreis:\s*([\d.]+)\s*Goldmünzen/);
      if (!courseMatch || !purchaseMatch) return;

      var course = parseGold(courseMatch[1]);
      var purchasePrice = parseGold(purchaseMatch[1]);
      if (course === null || purchasePrice === null) return;

      companies[corpId] = { course: course, purchasePrice: purchasePrice };
    });
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
      console.log("[stock_profit] Sold " + amount + " shares of company " + corpId + ": " + profit + " GM profit. Total: " + totalProfit + " GM.");
    });
  }

  function scanPage() {
    var pageType = getPageType();
    if (pageType === "overview") scanOverview();
    else if (pageType === "selling") handleSellingForm();
  }

  var observer = new MutationObserver(scanPage);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  setInterval(scanPage, 200);
  scanPage();
})();
