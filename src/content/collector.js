(() => {
  const PROCESSED_ATTR = "data-xhs-collected";
  const COLLECT_BTN_CLASS = "xhs-collect-btn";
  const EXTENSION_BANNER_ID = "xhs-extension-banner";

  const SELECTORS = {
    commentContainer: [
      ".cmts",
      "#note-container",
      '[class*="comment-container"]',
      '[class*="comments-container"]',
      '[class*="comment-list"]',
      '[class*="reply-list"]',
    ].join(","),
    commentItem: [
      ".parent-comment",
      "div.comment",
      '[class*="comment-item"]',
      '[class*="commentItem"]',
      '[class*="comment-list-item"]',
      '[id^="comment-"]',
      '[class*="reply-item"]',
      '[class*="sub-comment"]',
      '[class*="subComment"]',
    ].join(","),
    commentAuthorRow: [".right", "[class*='menu-wrapper']"].join(","),
  };

  const qsel = (s, ctx) => (ctx || document).querySelector(s);
  const qselAll = (s, ctx) => (ctx || document).querySelectorAll(s);

  function showToast(msg) {
    let el = document.getElementById("xhs-collector-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "xhs-collector-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("active");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("active"), 3000);
  }

  let isScanning = false;
  let scanTimer = null;
  let isExtensionValid = true;

  function stopExtension() {
    isExtensionValid = false;
    showRefreshBanner();
  }

  function showRefreshBanner() {
    if (document.getElementById(EXTENSION_BANNER_ID)) return;
    const banner = document.createElement("div");
    banner.id = EXTENSION_BANNER_ID;
    Object.assign(banner.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "999999",
      background: "#fff3cd",
      color: "#856404",
      padding: "10px 16px",
      fontSize: "14px",
      textAlign: "center",
      borderBottom: "1px solid #ffc107",
      fontFamily: "sans-serif",
    });
    banner.textContent = "RED Collector: 扩展已更新，请刷新页面以继续使用";
    document.body.prepend(banner);
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function stripEmojiText(text) {
    return text
      .replace(/\s*\[[^\]]*\]\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isEmojiImage(img, textEl, commentEl) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w > 0 && w < 40) return true;
    if (h > 0 && h < 40) return true;
    const cls = (img.className || "").toLowerCase();
    if (cls.includes("emoji")) return true;
    const alt = (img.alt || "").trim();
    if (/^\[.+\]$/.test(alt)) return true;
    if ((img.src || "").toLowerCase().includes("emoji")) return true;
    let p = img.parentElement;
    for (let i = 0; i < 3 && p; i++) {
      const pc = (p.className || "").toLowerCase();
      if (pc.includes("emoji")) return true;
      p = p.parentElement;
    }
    if (textEl && textEl !== commentEl && textEl.contains(img)) return true;
    if (commentEl && commentEl !== textEl) {
      const textEl2 = commentEl.querySelector(
        '[class*="text"], [class*="content"], p',
      );
      if (textEl2 && textEl2.contains(img)) return true;
    }
    return false;
  }

  function isAvatarImg(img) {
    const cls = (img.className || "").toLowerCase();
    if (cls.includes("avatar") || cls.includes("head")) return true;
    const src = (img.src || "").toLowerCase();
    if (
      src.includes("sns-avatar") ||
      (src.includes("avatar") && src.includes("xhscdn"))
    )
      return true;
    let p = img.parentElement;
    while (p && p !== document.body) {
      const pc = (p.className || "").toLowerCase();
      if (pc.includes("avatar") || pc.includes("head") || pc.includes("left"))
        return true;
      p = p.parentElement;
    }
    return false;
  }

  function extractCommentData(commentEl) {
    const textEl =
      commentEl.querySelector('[class*="text"], [class*="content"], p') || null;
    const authorEl =
      commentEl.querySelector(".name, a.name") ||
      commentEl.querySelector(
        '[class*="author"], [class*="name"], [class*="user"]',
      ) ||
      commentEl.querySelector("a");
    const timeEl =
      commentEl.querySelector('[class*="time"], [class*="date"]') || commentEl;
    const likeEl = commentEl.querySelector('[class*="like"]') || commentEl;
    const levelEl = commentEl.querySelector('[class*="level"]') || commentEl;

    const rawContent = ((textEl || commentEl).textContent || "")
      .trim()
      .slice(0, 500);
    const content = stripEmojiText(rawContent);
    const author = (authorEl?.textContent || "匿名").trim().slice(0, 50);
    const timeText = (timeEl.textContent || "").trim();
    const likeText = (likeEl.textContent || "").trim();
    const levelText = (levelEl.textContent || "").trim();

    const time = !isNaN(new Date(timeText).getTime())
      ? new Date(timeText).getTime()
      : Date.now();

    const likes = parseInt(likeText.replace(/[^0-9]/g, ""), 10) || 0;
    const level = parseInt(levelText.replace(/[^0-9]/g, ""), 10) || 1;

    const titleEl = document.querySelector("title");
    const noteTitle = titleEl
      ? titleEl.textContent
          .trim()
          .replace(/ - 小红书$/, "")
          .slice(0, 100)
      : "";
    const noteUrl = window.location.href;

    const domId =
      commentEl.id ||
      commentEl.getAttribute("data-comment-id") ||
      commentEl.getAttribute("data-id") ||
      commentEl.dataset?.id ||
      "";
    const id = domId
      ? "xhs_" + domId
      : "xhs_" + hashStr(noteUrl + "|" + author + "|" + content.slice(0, 100));

    const images = [];
    const imgEls = commentEl.querySelectorAll("img");
    for (const img of imgEls) {
      if (isAvatarImg(img)) continue;
      if (isEmojiImage(img, textEl, commentEl)) continue;
      const src = img.src || "";
      if (src && !src.startsWith("data:")) {
        images.push(src);
        if (images.length >= 3) break;
      }
    }

    const replyEl = commentEl.querySelector('[class*="reply"]');
    const replyText = replyEl ? replyEl.textContent.trim() : "";
    const replyCount = parseInt(replyText.replace(/[^0-9]/g, ""), 10) || 0;

    return {
      id,
      content,
      author,
      noteTitle,
      noteUrl,
      time,
      likes,
      level,
      images,
      replyCount,
    };
  }

  function isValidCommentEl(el) {
    if (!el || el.closest(".input, [class*='input-box']")) return false;
    const text = (el.textContent || "").trim();
    if (text.length < 2) return false;
    return !!(
      el.querySelector('.name, a.name, [class*="author"], [class*="name"]') ||
      el.querySelector('[class*="content"], [class*="text"], p')
    );
  }

  function bindCommentHover(commentEl) {
    if (commentEl.dataset.xhsHoverBound) return;
    commentEl.dataset.xhsHoverBound = "true";
    commentEl.addEventListener("mouseenter", () => {
      commentEl.classList.add("xhs-comment-hover");
    });
    commentEl.addEventListener("mouseleave", () => {
      commentEl.classList.remove("xhs-comment-hover");
    });
  }

  function findDotBtn(commentEl) {
    return commentEl.querySelector(
      'button[class*="more"], button[class*="menu"], ' +
        '[class*="more-btn"], [class*="menu-btn"]',
    );
  }

  function injectCollectBtn(commentEl) {
    if (!isExtensionValid) return;
    if (!isValidCommentEl(commentEl)) return;

    const WRAPPER_CLASS = "xhs-collect-wrapper";

    if (commentEl.querySelector(`.${WRAPPER_CLASS}`)) {
      commentEl.setAttribute(PROCESSED_ATTR, "true");
      bindCommentHover(commentEl);
      return;
    }
    if (commentEl.hasAttribute(PROCESSED_ATTR)) {
      commentEl.removeAttribute(PROCESSED_ATTR);
    }

    const data = extractCommentData(commentEl);

    // ── Wrapper: takes the three-dots position in the DOM flow ──
    const wrapper = document.createElement("div");
    wrapper.className = WRAPPER_CLASS;

    // Collect button
    const btn = document.createElement("button");
    btn.className = COLLECT_BTN_CLASS;
    btn.title = "收藏此评论";
    btn.dataset.commentId = data.id;
    wrapper.appendChild(btn);

    // Reply badge
    const replyBadge = document.createElement("span");
    replyBadge.className = "xhs-reply-badge";
    const replyEl = commentEl.querySelector('[class*="reply"]');
    const replyText = replyEl ? replyEl.textContent.trim() : "";
    replyBadge.textContent =
      replyText || (data.replyCount > 0 ? `回复 ${data.replyCount}` : "");
    replyBadge.hidden = !replyBadge.textContent;
    wrapper.appendChild(replyBadge);

    // Category tag (only visible when collected)
    const catTag = document.createElement("span");
    catTag.className = "xhs-cat-tag";
    catTag.hidden = true;
    wrapper.appendChild(catTag);

    // Restore collected state from storage
    Promise.all([
      window.CommentStorage.isCollected(data.id),
      window.CommentStorage.getComment(data.id),
      window.CommentStorage.getCategories(),
    ])
      .then(([collected, comment, categories]) => {
        if (collected) {
          btn.classList.add("collected");
        }
        if (comment && comment.category) {
          const cat = categories.find((c) => c.id === comment.category);
          if (cat) {
            catTag.textContent = cat.name;
            catTag.style.background = cat.color;
            catTag.hidden = false;
          }
        }
      })
      .catch((err) => {
        console.warn("REDC: storage check error", data.id, err);
      });

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!window.CommentStorage.isReady()) {
        showRefreshBanner();
        return;
      }
      const already = await window.CommentStorage.isCollected(data.id);
      if (already) {
        showToast("此评论已收藏");
        return;
      }
      const rect = btn.getBoundingClientRect();
      window.FloatingMenu.show(
        data,
        {
          x: rect.left,
          y: rect.bottom + 4,
        },
        btn,
      );
    });

    // Position: hide three-dots, insert wrapper at the same DOM spot
    const dotBtn = findDotBtn(commentEl);
    if (dotBtn && dotBtn.parentElement) {
      dotBtn.style.display = "none";
      dotBtn.parentElement.insertBefore(wrapper, dotBtn);
    } else {
      if (getComputedStyle(commentEl).position === "static") {
        commentEl.style.position = "relative";
      }
      wrapper.style.position = "absolute";
      wrapper.style.right = "28px";
      wrapper.style.top = "8px";
      commentEl.appendChild(wrapper);
    }

    commentEl.classList.add("xhs-comment-host");
    commentEl.setAttribute(PROCESSED_ATTR, "true");
    bindCommentHover(commentEl);
  }

  function findCommentRoots() {
    const containers = qselAll(SELECTORS.commentContainer);
    if (containers.length) return containers;

    const cmts = qselAll(".cmts");
    if (cmts.length) return cmts;

    const notePanel = qsel(
      '.single-note, [class*="note-detail"], [class*="note-container"], [class*="interaction-container"]',
    );
    return notePanel ? [notePanel] : [document.body];
  }

  function scanComments() {
    if (!isExtensionValid) return;
    if (isScanning) return;
    isScanning = true;
    try {
      const roots = findCommentRoots();
      const seen = new Set();

      for (const container of roots) {
        const all = qselAll(SELECTORS.commentItem, container);
        if (!all || !all.length) continue;

        for (const el of all) {
          if (seen.has(el)) continue;
          seen.add(el);
          try {
            injectCollectBtn(el);
          } catch (e) {
            console.warn("REDC: injectCollectBtn error", e);
          }
        }
      }
    } finally {
      isScanning = false;
    }
  }

  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanScheduled = false;
      scanComments();
    }, 500);
  }

  function observeDOM() {
    const observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }

  function handleScroll() {
    const scrollContainers = document.querySelectorAll(
      '[class*="scroll"], [class*="container"], main, article',
    );
    for (const el of scrollContainers) {
      el.addEventListener("scroll", () => scheduleScan(), { passive: true });
    }
    window.addEventListener("scroll", () => scheduleScan(), { passive: true });
  }

  function watchCollectedStatus() {
    window.addEventListener("xhs-collector-update", () => {
      setTimeout(async () => {
        const btns = document.querySelectorAll(`.${COLLECT_BTN_CLASS}`);
        for (const btn of btns) {
          const commentId = btn.dataset.commentId;
          if (!commentId) continue;
          const collected = await window.CommentStorage.isCollected(commentId);
          btn.classList.toggle("collected", collected);

          const wrapper = btn.closest(".xhs-collect-wrapper");
          if (!wrapper) continue;
          const catTag = wrapper.querySelector(".xhs-cat-tag");
          if (collected) {
            const comment = await window.CommentStorage.getComment(commentId);
            if (comment && comment.category) {
              const cats = await window.CommentStorage.getCategories();
              const cat = cats.find((c) => c.id === comment.category);
              if (cat && catTag) {
                catTag.textContent = cat.name;
                catTag.style.background = cat.color;
                catTag.hidden = false;
              }
            }
          } else if (catTag) {
            catTag.hidden = true;
          }
        }
      }, 100);
    });
  }

  function getNoteIdFromUrl() {
    const m = window.location.pathname.match(/\/explore\/([a-f0-9]+)/);
    return m ? m[1] : null;
  }

  function extractNoteData() {
    const titleEl =
      document.querySelector("title") || document.querySelector("h1");
    const descEl = document.querySelector(
      '[class*="desc"], [class*="content"]',
    );
    const authorEl = document.querySelector(
      '[class*="username"], [class*="author"], [class*="name"]',
    );
    const imgEls = document.querySelectorAll("img");
    const noteId = getNoteIdFromUrl();

    const title = (titleEl?.textContent || document.title || "")
      .trim()
      .replace(/ - 小红书$/, "")
      .slice(0, 200);
    const content = (descEl?.textContent || "").trim().slice(0, 2000);

    const images = [];
    const seen = new Set();
    for (const img of imgEls) {
      if (isAvatarImg(img)) continue;
      const src = img.src || "";
      if (
        src &&
        !src.startsWith("data:") &&
        !seen.has(src) &&
        src.includes("xhscdn.com")
      ) {
        seen.add(src);
        images.push(src);
        if (images.length >= 9) break;
      }
    }

    return {
      id: noteId || "note_" + Date.now(),
      title,
      content,
      author: (authorEl?.textContent || "").trim().slice(0, 50) || "未知作者",
      images,
      url: window.location.href,
    };
  }

  function getCurrentUserId() {
    const pathMatch = window.location.pathname.match(
      /\/user\/profile\/([a-f0-9]+)/i,
    );
    if (pathMatch) return pathMatch[1];
    const links = document.querySelectorAll('a[href*="/user/profile/"]');
    for (const link of links) {
      const href = link.getAttribute("href") || link.href || "";
      const m = href.match(/\/user\/profile\/([a-f0-9]+)/i);
      if (m) return m[1];
    }

    try {
      const state = window.__INITIAL_STATE__;
      const uid =
        state?.user?.userInfo?.userId ||
        state?.user?.userPageData?.basicInfo?.userId ||
        state?.user?.userPageData?.userInfo?.userId;
      if (uid) return String(uid);
    } catch {
      // skip
    }
    return null;
  }

  function isUserLoggedIn() {
    return !!getCurrentUserId();
  }

  const importState = {
    running: false,
    done: false,
    lastToastAt: 0,
    lastSummary: "",
    totalImported: 0,
    roundCount: 0,
  };

  function extractNoteIdFromHref(href) {
    const m = href.match(/\/(?:explore|discovery\/item)\/([a-f0-9]{10,})/i);
    return m ? m[1] : null;
  }

  function extractCardData(cardEl, linkEl) {
    const link =
      linkEl ||
      cardEl.querySelector('a[href*="/explore/"], a[href*="/discovery/item/"]');
    if (!link) return null;
    const href = link.getAttribute("href") || link.href || "";
    const noteId = extractNoteIdFromHref(href);
    if (!noteId) return null;

    const titleEl = cardEl.querySelector(
      '[class*="title"], h3, [class*="note-title"], [class*="Title"]',
    );
    const descEl = cardEl.querySelector(
      '[class*="desc"], [class*="content"], [class*="brief"], [class*="text"], p, [class*="Desc"]',
    );
    const authorEl = cardEl.querySelector(
      '[class*="author"], [class*="name"], [class*="user"], [class*="Author"]',
    );
    const timeEl = cardEl.querySelector(
      '[class*="time"], [class*="date"], time, [class*="Time"]',
    );
    const dateText = timeEl
      ? (timeEl.textContent || timeEl.getAttribute("datetime") || "").trim()
      : "";

    let title = (titleEl?.textContent || "").trim().slice(0, 300);
    if (!title) {
      const innerTitle = cardEl.querySelector("span, div");
      title = (innerTitle?.textContent || "").trim().slice(0, 300);
    }
    title = title || "无标题";

    const content = (descEl?.textContent || "").trim().slice(0, 10000);
    const author =
      (authorEl?.textContent || "").trim().slice(0, 50) || "未知作者";

    const imgEls = cardEl.querySelectorAll("img");
    const images = Array.from(imgEls)
      .filter((img) => !isAvatarImg(img))
      .map((img) => img.src || img.getAttribute("data-src") || "")
      .filter((src) => src && !src.startsWith("data:"));

    let url = "";
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `https://www.xiaohongshu.com${href}`;
    } else {
      url = `https://www.xiaohongshu.com/explore/${noteId}`;
    }
    const date = dateText
      ? new Date(dateText).getTime() || Date.now()
      : Date.now();

    return { id: noteId, title, content, author, images, url, date };
  }

  function extractNoteDirectly(link) {
    const href = link.getAttribute("href") || link.href || "";
    const noteId = extractNoteIdFromHref(href);
    if (!noteId) return null;

    let url = "";
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `https://www.xiaohongshu.com${href}`;
    } else {
      url = `https://www.xiaohongshu.com/explore/${noteId}`;
    }

    let title = link.getAttribute("title") || "";
    if (!title) {
      const img = link.querySelector("img");
      title = img?.alt || img?.getAttribute("alt") || "";
    }
    if (!title) {
      const titleSpan = link.querySelector('[class*="title"], span, div');
      title = titleSpan?.textContent?.trim() || "";
    }
    if (!title) {
      title = link.textContent?.trim() || "";
    }
    title = title.slice(0, 300) || "无标题";

    const img = link.querySelector("img");
    const images = img
      ? [img.src || img.getAttribute("data-src") || ""].filter(
          (s) => s && !s.startsWith("data:"),
        )
      : [];

    return {
      id: noteId,
      title,
      content: "",
      author: "未知作者",
      images,
      url,
      date: Date.now(),
    };
  }

  function getAllNoteLinks() {
    const links = new Map();

    const allAnchors = document.querySelectorAll("a[href]");
    for (const a of allAnchors) {
      const href = a.getAttribute("href") || a.href || "";
      const noteId = extractNoteIdFromHref(href);
      if (noteId && !links.has(noteId)) {
        links.set(noteId, a);
      }
    }

    return links;
  }

  async function scrollAndCollect(source) {
    if (!isExtensionValid || importState.running) return;
    if (!isProfilePage()) return;

    const tab = getProfileTab();
    if (tab !== source) return;

    const currentUserId = getCurrentUserId();
    const pageUserId = window.location.pathname.match(
      /\/user\/profile\/([a-f0-9]+)/i,
    )?.[1];
    if (currentUserId && pageUserId && currentUserId !== pageUserId) return;

    importState.running = true;
    importState.done = false;
    importState.roundCount = 0;

    const label = source === "like" ? "点赞" : "收藏";
    const startTime = Date.now();
    const maxDuration = 40000;
    let lastNoteCount = 0;
    let noNewCount = 0;

    try {
      while (importState.roundCount < 50) {
        const elapsed = Date.now() - startTime;
        if (elapsed > maxDuration) break;

        importState.roundCount++;

        const noteLinks = getAllNoteLinks();
        let newInRound = 0;

        for (const [noteId, link] of noteLinks) {
          let noteData = null;
          const card =
            link.closest(
              '[class*="note-item"], [class*="card"], [class*="feeds"] li, section[class*="note"] > div, li, [class*="Note"], [class*="Card"]',
            ) ||
            link.parentElement?.parentElement ||
            link.parentElement ||
            link;
          noteData = extractCardData(card, link);
          if (!noteData) {
            noteData = extractNoteDirectly(link);
          }
          if (!noteData) continue;

          const data = { ...noteData, source };
          const result = await window.CommentStorage.addSavedNote(data);
          if (result === "new") {
            importState.totalImported++;
            newInRound++;
          }
        }

        const currentNoteCount = noteLinks.size;

        if (currentNoteCount === lastNoteCount) {
          noNewCount++;
          if (noNewCount >= 6) break;
        } else {
          noNewCount = 0;
        }
        lastNoteCount = currentNoteCount;

        const elapsedSec = Math.floor(elapsed / 1000);
        const summary = `扫描中… 页面 ${currentNoteCount} 个，已导入 ${importState.totalImported} 条 (${elapsedSec}s)`;
        const now = Date.now();
        if (now - importState.lastToastAt > 2000) {
          showToast(`RED Collector: ${summary}`);
          importState.lastToastAt = now;
        }

        for (let i = 0; i < 4; i++) {
          window.scrollBy(0, window.innerHeight * 1.5);
          await new Promise((r) => setTimeout(r, 350));
        }
        await new Promise((r) => setTimeout(r, 800));
      }

      await new Promise((r) => setTimeout(r, 1500));
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 1000));

      const finalNoteLinks = getAllNoteLinks();

      let finalImported = 0;
      for (const [noteId] of finalNoteLinks) {
        const exists = await window.CommentStorage.getSavedNote(noteId);
        if (exists) finalImported++;
      }

      const finalSummary = `本轮完成！页面 ${finalNoteLinks.size} 个笔记，已导入 ${finalImported} 条${label}笔记`;
      showToast(`RED Collector: ${finalSummary}`);
    } finally {
      importState.running = false;
      importState.done = true;
    }
  }

  async function importProfileNotes(source) {
    if (importState.running) return;
    importState.done = false;
    await scrollAndCollect(source);
  }

  function isProfilePage() {
    return window.location.pathname.includes("/user/profile/");
  }

  function getProfileTab() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const channel = params.get("channel");
    if (channel === "likes" || tab === "liked") return "like";
    if (channel === "collect" || tab === "fav") return "bookmark";
    return null;
  }

  function observeProfilePage() {
    if (!isProfilePage()) return;
    const tab = getProfileTab();
    if (!tab) return;

    let scanRound = 0;
    const maxScans = 3;
    const initialDelay = 6000;
    const scanInterval = 45000;

    async function runScanRound() {
      scanRound++;
      if (scanRound > maxScans) return;

      const label = tab === "like" ? "点赞" : "收藏";
      showToast(
        `RED Collector: 第 ${scanRound}/${maxScans} 轮扫描${label}笔记，请勿操作…`,
      );

      await importProfileNotes(tab);

      if (scanRound < maxScans && !importState.running) {
        setTimeout(runScanRound, scanInterval);
      }
    }

    setTimeout(runScanRound, initialDelay);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_USER_ID") {
      sendResponse({ userId: getCurrentUserId() });
      return true;
    }
    if (message.type === "EXTRACT_NOTE_DATA") {
      try {
        const data = extractNoteData();
        sendResponse({ data });
      } catch (e) {
        sendResponse({ error: e.message });
      }
      return true;
    }
    return false;
  });

  function observeNoteActions() {
    const noteId = getNoteIdFromUrl();
    if (!noteId) return;

    const checkAndSave = (source) => {
      const data = extractNoteData();
      data.source = source;
      window.CommentStorage.addSavedNote(data).then((result) => {
        if (result === "new") {
          console.log(`REDC: note saved (${source})`);
          showToast(source === "like" ? "已点赞笔记" : "已收藏笔记");
        }
      });
    };

    setTimeout(async () => {
      const likeBtn = document.querySelector(
        '[class*="like"] button, [class*="Like"] button, [class*="heart"]',
      );
      const bookmarkBtn = document.querySelector(
        '[class*="collect"] button, [class*="Collect"] button, [class*="favorite"] button, [class*="star"] button',
      );

      if (
        likeBtn &&
        (likeBtn.classList.contains("active") ||
          likeBtn.classList.contains("on") ||
          likeBtn.getAttribute("aria-checked") === "true")
      ) {
        checkAndSave("like");
      }
      if (
        bookmarkBtn &&
        (bookmarkBtn.classList.contains("active") ||
          bookmarkBtn.classList.contains("on") ||
          bookmarkBtn.getAttribute("aria-checked") === "true")
      ) {
        checkAndSave("bookmark");
      }

      document.addEventListener("click", (e) => {
        const target = e.target.closest(
          '[class*="like"] button, [class*="Like"] button, [class*="heart"], [class*="collect"] button, [class*="Collect"] button, [class*="favorite"]',
        );
        if (!target) return;
        const isLike = target.closest(
          '[class*="like"], [class*="Like"], [class*="heart"]',
        );
        setTimeout(() => checkAndSave(isLike ? "like" : "bookmark"), 500);
      });
    }, 2000);
  }

  async function checkExtensionHealth() {
    for (let i = 0; i <= 10; i++) {
      if (window.CommentStorage.isReady()) {
        isExtensionValid = true;
        return true;
      }
      if (i < 10) await new Promise((r) => setTimeout(r, 1000));
    }
    stopExtension();
    return false;
  }

  async function init() {
    const healthy = await checkExtensionHealth();
    if (!healthy) return;

    const start = () => {
      scanComments();
      observeDOM();
      handleScroll();
      watchCollectedStatus();
      observeNoteActions();
      if (isProfilePage()) {
        observeProfilePage();
      }
      // Keep scanning periodically — XHS loads comments in batches
      let scanCount = 0;
      const interval = setInterval(() => {
        scanComments();
        scanCount++;
        if (scanCount >= 20) clearInterval(interval);
      }, 2000);
    };

    // First pass after a short delay, then retry at increasing intervals
    setTimeout(start, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
