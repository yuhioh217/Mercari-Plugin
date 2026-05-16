// ==UserScript==
// @name         Mercari Beyblade TW Finder
// @name:zh-TW   Mercari 正版陀螺台灣可買搜尋助手
// @namespace    https://github.com/your-name/mercari-beyblade-tw-finder
// @version      0.1.1
// @description  Auto-search Mercari for newest on-sale official Beyblade listings, then highlight affordable results for Taiwan buyers.
// @description:zh-TW 打開 Mercari 時自動搜尋最新上架、尚未售完、價格不過度溢價的正版陀螺，方便台灣買家挑選。
// @author       Kyle
// @match        https://jp.mercari.com/*
// @match        https://gl.mercari.com/*
// @match        https://tw.mercari.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG_KEY = "mbtf.config.v1";
  const DEFAULT_CONFIG = {
    enabled: true,
    autoRedirect: true,
    keyword: "ベイブレードX タカラトミー",
    originalPriceYen: 1980,
    maxMarkup: 1.35,
    minPriceYen: 300,
    hideProbablyBad: false,
    notifyGoodItems: true,
    scanIntervalMs: 1800,
  };

  const POSITIVE_KEYWORDS = [
    "ベイブレード",
    "beyblade",
    "タカラトミー",
    "takara",
    "tomy",
    "正規",
    "正規品",
    "公式",
  ];

  const NEGATIVE_KEYWORDS = [
    "互換",
    "海外製",
    "海外版",
    "中国",
    "中華",
    "非正規",
    "偽物",
    "模造",
    "レプリカ",
    "コピー",
    "ジャンク",
    "故障",
    "破損",
    "パーツのみ",
    "説明書のみ",
    "箱のみ",
    "スタジアムのみ",
    "売り切れ",
    "sold",
  ];

  const STYLE = `
    .mbtf-panel {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      width: min(360px, calc(100vw - 32px));
      border: 1px solid #d8dde6;
      border-radius: 8px;
      background: #ffffff;
      color: #1f2937;
      box-shadow: 0 12px 36px rgba(15, 23, 42, 0.18);
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .mbtf-panel[aria-expanded="false"] .mbtf-body { display: none; }
    .mbtf-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid #edf0f5;
    }
    .mbtf-title { font-weight: 700; }
    .mbtf-actions { display: flex; gap: 6px; }
    .mbtf-icon-btn {
      width: 30px;
      height: 30px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      color: #0f172a;
      cursor: pointer;
    }
    .mbtf-body { padding: 12px; }
    .mbtf-row {
      display: grid;
      grid-template-columns: 1fr 112px;
      gap: 8px;
      align-items: end;
      margin-bottom: 10px;
    }
    .mbtf-field { display: grid; gap: 4px; }
    .mbtf-field span { color: #475569; font-size: 12px; }
    .mbtf-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 8px;
      color: #111827;
      background: #ffffff;
      font: inherit;
    }
    .mbtf-check {
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 8px 0;
      color: #334155;
    }
    .mbtf-primary {
      width: 100%;
      border: 0;
      border-radius: 6px;
      padding: 9px 10px;
      background: #0f766e;
      color: #ffffff;
      font-weight: 700;
      cursor: pointer;
    }
    .mbtf-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin: 10px 0;
    }
    .mbtf-stat {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 7px;
      text-align: center;
      background: #f8fafc;
    }
    .mbtf-stat strong { display: block; font-size: 16px; color: #0f172a; }
    .mbtf-note { margin: 8px 0 0; color: #64748b; font-size: 12px; }
    .mbtf-good {
      outline: 3px solid #10b981 !important;
      outline-offset: 2px !important;
      border-radius: 8px !important;
      position: relative !important;
    }
    .mbtf-good::after {
      content: "正版候選 / 價格OK";
      position: absolute;
      top: 4px;
      left: 4px;
      z-index: 5;
      border-radius: 4px;
      padding: 3px 6px;
      background: #047857;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      pointer-events: none;
    }
    .mbtf-bad {
      opacity: 0.34 !important;
      filter: grayscale(0.75);
    }
    .mbtf-hidden { display: none !important; }
  `;

  const state = {
    config: loadConfig(),
    seenGoodHrefs: new Set(),
    stats: { scanned: 0, good: 0, bad: 0 },
    panel: null,
  };

  GM_addStyle(STYLE);

  if (!state.config.enabled) {
    renderPanel();
    return;
  }

  maybeRedirectToSearch();
  renderPanel();
  scanResults();
  setInterval(scanResults, state.config.scanIntervalMs);

  function loadConfig() {
    return { ...DEFAULT_CONFIG, ...(GM_getValue(CONFIG_KEY, {}) || {}) };
  }

  function saveConfig(nextConfig) {
    state.config = { ...state.config, ...nextConfig };
    GM_setValue(CONFIG_KEY, state.config);
  }

  function buildSearchUrl() {
    const searchPath = location.hostname === "tw.mercari.com" ? "/zh-hant/search" : "/search";
    const url = new URL(searchPath, location.origin);
    url.searchParams.set("keyword", state.config.keyword.trim() || DEFAULT_CONFIG.keyword);
    url.searchParams.set("status", "on_sale");
    url.searchParams.set("sort", "created_time");
    url.searchParams.set("order", "desc");
    return url.toString();
  }

  function maybeRedirectToSearch() {
    if (!state.config.autoRedirect) return;
    if (sessionStorage.getItem("mbtf.redirected") === "1") return;

    const path = location.pathname;
    const params = new URLSearchParams(location.search);
    const hasKeyword = Boolean(params.get("keyword"));
    const isHome = path === "/" || path === "/tw" || path === "/ja" || path === "/zh-hant";
    const isUnfilteredSearch = path.startsWith("/search") || path.startsWith("/zh-hant/search");

    if (isHome || (isUnfilteredSearch && !hasKeyword)) {
      sessionStorage.setItem("mbtf.redirected", "1");
      location.assign(buildSearchUrl());
    }
  }

  function scanResults() {
    const candidates = getItemAnchors();
    let good = 0;
    let bad = 0;

    candidates.forEach((anchor) => {
      const card = findCard(anchor);
      if (!card || card.dataset.mbtfScanned === "1") return;

      const text = normalizeText(card.innerText || anchor.getAttribute("aria-label") || "");
      const price = extractPrice(text);
      const href = anchor.href;
      const result = evaluateItem(text, price);

      card.dataset.mbtfScanned = "1";
      card.dataset.mbtfPrice = price ? String(price) : "";
      state.stats.scanned += 1;

      if (result.good) {
        good += 1;
        card.classList.add("mbtf-good");
        if (href && !state.seenGoodHrefs.has(href)) {
          state.seenGoodHrefs.add(href);
          notifyGoodItem(text, price, href);
        }
      } else {
        bad += 1;
        card.classList.add("mbtf-bad");
        if (state.config.hideProbablyBad) card.classList.add("mbtf-hidden");
      }
    });

    state.stats.good += good;
    state.stats.bad += bad;
    updateStats();
  }

  function getItemAnchors() {
    const anchors = Array.from(document.querySelectorAll('a[href*="/item/"], a[href*="/shops/product/"]'));
    const unique = new Map();
    anchors.forEach((anchor) => {
      if (!anchor.href) return;
      unique.set(anchor.href, anchor);
    });
    return Array.from(unique.values());
  }

  function findCard(anchor) {
    return (
      anchor.closest("li") ||
      anchor.closest('[data-testid*="item"]') ||
      anchor.closest("article") ||
      anchor
    );
  }

  function normalizeText(value) {
    return value
      .replace(/\s+/g, " ")
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
      .trim()
      .toLowerCase();
  }

  function extractPrice(text) {
    const matches = Array.from(text.matchAll(/(?:¥|￥|円)\s*([0-9,]+)/g));
    const prices = matches
      .map((match) => Number(match[1].replace(/,/g, "")))
      .filter((price) => Number.isFinite(price) && price > 0);

    if (prices.length === 0) return null;
    return Math.min(...prices);
  }

  function evaluateItem(text, price) {
    const hasPositive = POSITIVE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
    const hasNegative = NEGATIVE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
    const maxPrice = Math.round(Number(state.config.originalPriceYen) * Number(state.config.maxMarkup));
    const hasReasonablePrice =
      price !== null &&
      price >= Number(state.config.minPriceYen) &&
      price <= maxPrice;

    return {
      good: hasPositive && !hasNegative && hasReasonablePrice,
      hasPositive,
      hasNegative,
      hasReasonablePrice,
    };
  }

  function notifyGoodItem(text, price, href) {
    if (!state.config.notifyGoodItems || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
      return;
    }
    if (Notification.permission !== "granted") return;

    const title = "Mercari 正版陀螺候選";
    const body = `${price ? `¥${price.toLocaleString("ja-JP")} ` : ""}${text.slice(0, 80)}`;
    const notification = new Notification(title, { body });
    notification.onclick = () => window.open(href, "_blank", "noopener");
  }

  function renderPanel() {
    const panel = document.createElement("section");
    panel.className = "mbtf-panel";
    panel.setAttribute("aria-expanded", "true");
    panel.innerHTML = `
      <div class="mbtf-head">
        <div class="mbtf-title">Mercari 陀螺搜尋助手</div>
        <div class="mbtf-actions">
          <button class="mbtf-icon-btn" type="button" data-action="rescan" title="重新掃描">↻</button>
          <button class="mbtf-icon-btn" type="button" data-action="toggle" title="收合">−</button>
        </div>
      </div>
      <div class="mbtf-body">
        <label class="mbtf-field">
          <span>搜尋關鍵字</span>
          <input class="mbtf-input" data-field="keyword" value="${escapeHtml(state.config.keyword)}">
        </label>
        <div class="mbtf-row">
          <label class="mbtf-field">
            <span>原價基準 JPY</span>
            <input class="mbtf-input" data-field="originalPriceYen" type="number" min="1" step="1" value="${state.config.originalPriceYen}">
          </label>
          <label class="mbtf-field">
            <span>最高倍率</span>
            <input class="mbtf-input" data-field="maxMarkup" type="number" min="1" step="0.05" value="${state.config.maxMarkup}">
          </label>
        </div>
        <label class="mbtf-check">
          <input type="checkbox" data-field="autoRedirect" ${state.config.autoRedirect ? "checked" : ""}>
          打開 Mercari 自動跳到最新上架搜尋
        </label>
        <label class="mbtf-check">
          <input type="checkbox" data-field="hideProbablyBad" ${state.config.hideProbablyBad ? "checked" : ""}>
          隱藏疑似不符合的商品
        </label>
        <label class="mbtf-check">
          <input type="checkbox" data-field="notifyGoodItems" ${state.config.notifyGoodItems ? "checked" : ""}>
          發現候選商品時通知
        </label>
        <button class="mbtf-primary" type="button" data-action="search">套用並搜尋</button>
        <div class="mbtf-stats">
          <div class="mbtf-stat"><strong data-stat="scanned">0</strong><span>掃描</span></div>
          <div class="mbtf-stat"><strong data-stat="good">0</strong><span>候選</span></div>
          <div class="mbtf-stat"><strong data-stat="bad">0</strong><span>略過</span></div>
        </div>
        <p class="mbtf-note">綠框代表「正版關鍵字 + 未售出搜尋 + 價格低於設定上限」的候選。跨境配送仍以商品頁與結帳頁顯示為準。</p>
      </div>
    `;

    panel.addEventListener("change", handlePanelChange);
    panel.addEventListener("click", handlePanelClick);
    document.documentElement.appendChild(panel);
    state.panel = panel;
    updateStats();
  }

  function handlePanelChange(event) {
    const field = event.target?.dataset?.field;
    if (!field) return;

    const target = event.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const nextValue = target.type === "number" ? Number(value) : value;
    saveConfig({ [field]: nextValue });
  }

  function handlePanelClick(event) {
    const action = event.target?.dataset?.action;
    if (!action) return;

    if (action === "toggle") {
      const expanded = state.panel.getAttribute("aria-expanded") !== "false";
      state.panel.setAttribute("aria-expanded", expanded ? "false" : "true");
      event.target.textContent = expanded ? "+" : "−";
    }

    if (action === "rescan") {
      resetScanMarks();
      scanResults();
    }

    if (action === "search") {
      sessionStorage.setItem("mbtf.redirected", "1");
      location.assign(buildSearchUrl());
    }
  }

  function resetScanMarks() {
    document.querySelectorAll("[data-mbtf-scanned]").forEach((element) => {
      element.removeAttribute("data-mbtf-scanned");
      element.classList.remove("mbtf-good", "mbtf-bad", "mbtf-hidden");
    });
    state.stats = { scanned: 0, good: 0, bad: 0 };
    updateStats();
  }

  function updateStats() {
    if (!state.panel) return;
    Object.entries(state.stats).forEach(([key, value]) => {
      const element = state.panel.querySelector(`[data-stat="${key}"]`);
      if (element) element.textContent = String(value);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
