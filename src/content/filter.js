(() => {
  const STORAGE_KEY = "xhs_filter_settings";

  const DEFAULT_SETTINGS = {
    hideRecommend: false,
    hideGuessSearch: true,
    hideNotificationDot: false,
    onlyImageNote: false,
    hideSearchTabs: false,
  };

  let settings = { ...DEFAULT_SETTINGS };
  let observer = null;
  let urlWatcher = null;
  let isApplying = false;
  let cleanBarPositioned = false;

  const STYLE_PREFIX = "xhs-redc-";

  function injectStyle(id, css) {
    const fullId = STYLE_PREFIX + id;
    let el = document.getElementById(fullId);
    if (!el) {
      el = document.createElement("style");
      el.id = fullId;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = css;
  }

  function removeStyle(id) {
    const el = document.getElementById(STYLE_PREFIX + id);
    if (el) el.remove();
  }

  async function loadSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(STORAGE_KEY, (result) => {
          if (chrome.runtime.lastError) { resolve({ ...DEFAULT_SETTINGS }); return; }
          settings = { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY] || {}) };
          resolve(settings);
        });
      } catch { settings = { ...DEFAULT_SETTINGS }; resolve(settings); }
    });
  }

  function isHomePage() {
    const p = location.pathname;
    if (p.includes("/search_result")) return false;
    if (p.startsWith("/user")) return false;
    if (/^\/explore\/[0-9a-fA-F]{16,}/.test(p)) return false;
    return p === "/" || p === "/explore" || p.startsWith("/explore?");
  }

  function onPageTypeChange(fn) {
    let last = location.href;
    const check = () => {
      if (location.href !== last) { last = location.href; fn(); }
    };
    const origPush = history.pushState;
    history.pushState = function (...a) { origPush.apply(this, a); check(); };
    const origReplace = history.replaceState;
    history.replaceState = function (...a) { origReplace.apply(this, a); check(); };
    window.addEventListener("popstate", check);
    return setInterval(check, 400);
  }

  // ── 1. Hide recommend feed ─────────────────────────────────────────────
  function applyHideRecommend() {
    if (!settings.hideRecommend || !isHomePage()) {
      removeStyle("filter-hideRecommend");
      return;
    }
    injectStyle("filter-hideRecommend", `
      .feeds-container,
      .reds-sticky-box,
      .channel-container {
        display: none !important;
      }
    `);
  }

  // ── 2. Hide original search + create clean search bar ──────────────────
  const CLEAN_SEARCH_ID = "xhs-redc-clean-search";

  function applySearchReplace() {
    if (!settings.hideGuessSearch) {
      removeStyle("filter-hideGuessSearch");
      removeCleanSearchBar();
      return;
    }

    // single CSS rule hides everything we need
    injectStyle("filter-hideGuessSearch", `
      #search-input-in-feeds,
      #search-input-in-feeds ~ *,
      .suggestion-section {
        display: none !important;
      }
    `);

    if (isHomePage()) {
      if (cleanBarPositioned) {
        return;
      }
      if (document.getElementById(CLEAN_SEARCH_ID)) {
        const textarea = document.getElementById("search-input-in-feeds");
        if (textarea) {
          repositionCleanSearchBar();
          cleanBarPositioned = true;
        }
      } else {
        injectCleanSearchBar();
      }
    } else {
      removeCleanSearchBar();
      cleanBarPositioned = false;
    }
  }

  function injectCleanSearchBar() {
    if (document.getElementById(CLEAN_SEARCH_ID)) return;

    const textarea = document.getElementById("search-input-in-feeds");
    const container = textarea?.closest(".textarea-container");
    let top = 80, left = "50%", width = 420, height = 40, transform = "translateX(-50%)";

    if (container) {
      const parent = container.parentElement;
      const r = (parent && parent.getBoundingClientRect().width > container.getBoundingClientRect().width)
        ? parent.getBoundingClientRect()
        : container.getBoundingClientRect();
      if (r.width > 100) {
        top = r.top;
        left = r.left + "px";
        width = r.width;
        height = r.height;
        transform = "none";
      }
    } else if (textarea) {
      const r = textarea.getBoundingClientRect();
      if (r.width > 100) {
        top = r.top;
        left = r.left + "px";
        width = r.width;
        height = r.height;
        transform = "none";
      }
    }

    const wrapper = document.createElement("div");
    wrapper.id = CLEAN_SEARCH_ID;
    wrapper.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${left};
      width: ${width}px;
      height: ${height}px;
      transform: ${transform};
      display: flex;
      align-items: center;
      gap: 0;
      background: #fff;
      border-radius: 15px;
      padding: 0 4px 0 16px;
      z-index: 100;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    `;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "搜索小红书";
    input.style.cssText = `
      flex: 1;
      border: none;
      background: transparent;
      font-size: 14px;
      line-height: ${height}px;
      outline: none;
      color: #333;
      height: 100%;
    `;

    const btn = document.createElement("div");
    btn.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    `;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    function doSearch() {
      const kw = input.value.trim();
      if (!kw) return;
      window.location.href = `/search_result?keyword=${encodeURIComponent(kw)}&source=web_user_page`;
    }

    input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
    btn.addEventListener("click", doSearch);

    wrapper.appendChild(input);
    wrapper.appendChild(btn);
    document.body.appendChild(wrapper);

    setTimeout(() => input.focus(), 150);
  }

  function removeCleanSearchBar() {
    const bar = document.getElementById(CLEAN_SEARCH_ID);
    if (bar) bar.remove();
  }

  function repositionCleanSearchBar() {
    const bar = document.getElementById(CLEAN_SEARCH_ID);
    if (!bar) return;
    const textarea = document.getElementById("search-input-in-feeds");
    const container = textarea?.closest(".textarea-container");
    let top = 80, left = "50%", width = 420, height = 40, transform = "translateX(-50%)";
    if (container) {
      const parent = container.parentElement;
      const r = (parent && parent.getBoundingClientRect().width > container.getBoundingClientRect().width)
        ? parent.getBoundingClientRect()
        : container.getBoundingClientRect();
      if (r.width > 100) { top = r.top; left = r.left + "px"; width = r.width; height = r.height; transform = "none"; }
    } else if (textarea) {
      const r = textarea.getBoundingClientRect();
      if (r.width > 100) { top = r.top; left = r.left + "px"; width = r.width; height = r.height; transform = "none"; }
    }
    bar.style.top = top + "px";
    bar.style.left = left;
    bar.style.width = width + "px";
    bar.style.height = height + "px";
    bar.style.transform = transform;
    const input = bar.querySelector("input");
    if (input) input.style.lineHeight = height + "px";
  }

  // ── 3. Hide notification red dots ──────────────────────────────────────
  function applyHideNotificationDot() {
    if (!settings.hideNotificationDot) {
      removeStyle("filter-hideNotificationDot");
      return;
    }
    injectStyle("filter-hideNotificationDot", `
      [class*="red-dot"],
      [class*="redDot"],
      [class*="badge-num"],
      [class*="badgeNum"],
      [class*="unread"],
      [class*="msg-badge"],
      [class*="msgBadge"],
      [class*="notification-dot"],
      [class*="notificationDot"],
      sup[class*="num"],
      sup[class*="count"],
      sup[class*="badge"] {
        display: none !important;
      }
    `);
  }

  // ── 4. Only show image notes (hide video) ──────────────────────────────
  function applyOnlyImageNote() {
    if (!settings.onlyImageNote) {
      removeStyle("filter-onlyImageNote");
      return;
    }
    injectStyle("filter-onlyImageNote", `
      a[href*="/video/"] {
        display: none !important;
      }
    `);
  }

  // ── 5. Hide search result tabs ─────────────────────────────────────────
  function applyHideSearchTabs() {
    if (!settings.hideSearchTabs) {
      removeStyle("filter-hideSearchTabs");
      return;
    }
    injectStyle("filter-hideSearchTabs", `
      .scroll-container.tab-scroll-container,
      .tab-scroll-container,
      [class*="tab-scroll-container"] {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        overflow: hidden !important;
      }
    `);
  }

  // ── Apply all ──────────────────────────────────────────────────────────
  function applyAll() {
    if (isApplying) return;
    isApplying = true;
    try {
      if (!document.getElementById(CLEAN_SEARCH_ID)) cleanBarPositioned = false;
      applyHideRecommend();
      applySearchReplace();
      applyHideNotificationDot();
      applyOnlyImageNote();
      applyHideSearchTabs();
    } finally {
      isApplying = false;
    }
  }

  // ── MutationObserver ───────────────────────────────────────────────────
  function startObserver() {
    if (observer) return;
    let timer = null;
    observer = new MutationObserver((mutations) => {
      if (isApplying) return;
      // skip mutations on our own injected element
      for (const m of mutations) {
        if (m.type === "childList") {
          for (const node of m.addedNodes) {
            if (node.id === CLEAN_SEARCH_ID || node.nodeType !== 1) continue;
            if (node.querySelector?.("#" + CLEAN_SEARCH_ID)) continue;
          }
        }
      }
      clearTimeout(timer);
      timer = setTimeout(applyAll, 300);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // ── Listeners ──────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "FILTER_SETTINGS_CHANGED" && msg.settings) {
      settings = { ...DEFAULT_SETTINGS, ...msg.settings };
      applyAll();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      settings = { ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue || {}) };
      applyAll();
    }
  });

  function startURLWatcher() {
    if (urlWatcher) clearInterval(urlWatcher);
    urlWatcher = onPageTypeChange(applyAll);
  }

  // ── Init ───────────────────────────────────────────────────────────────
  async function init() {
    await loadSettings();
    applyAll();
    startObserver();
    startURLWatcher();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  window.addEventListener("load", () => {
    setTimeout(applyAll, 300);
    setTimeout(applyAll, 800);
    setTimeout(applyAll, 1500);
  });
})();
