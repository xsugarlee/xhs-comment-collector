(() => {
  if (!globalThis.CommentStorage) {
    document.body.innerHTML =
      '<main style="padding:2rem;text-align:center;color:#FF2442;"><h2>Storage 模块加载失败，请刷新重试</h2></main>';
    return;
  }

  const storage = globalThis.CommentStorage;

  // ===== AUTH INITIALIZATION =====
  let currentUser = null;
  let currentSubscription = { plan: "free", active: false, expires_at: null };

  async function initAuth() {
    try {
      window.Auth.initAuthListener();
      const session = await window.Auth.restoreSession();
      if (session) {
        currentUser = session.user;
        currentSubscription = await window.Subscription.getUserSubscription();
        updateAuthUI(true);
      } else {
        updateAuthUI(false);
      }
    } catch (e) {
      console.warn("Auth init failed:", e);
      updateAuthUI(false);
    }
  }

  function updateAuthUI(loggedIn) {
    const toolbarNotLogged = document.getElementById("toolbarAuthNotLogged");
    const toolbarLogged = document.getElementById("toolbarAuthLogged");
    const toolbarAvatar = document.getElementById("toolbarUserAvatar");

    if (loggedIn && currentUser) {
      toolbarNotLogged.style.display = "none";
      toolbarLogged.style.display = "flex";
      toolbarAvatar.textContent = (currentUser.email || "U")[0].toUpperCase();
      toolbarAvatar.title = currentUser.email || "";
    } else {
      toolbarNotLogged.style.display = "flex";
      toolbarLogged.style.display = "none";
    }
  }

  async function handleLogin() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const errorEl = document.getElementById("authError");
    const btn = document.getElementById("authEmailBtn");

    if (!email || !password) {
      errorEl.textContent = "请输入邮箱和密码";
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "登录中...";
    errorEl.style.display = "none";

    try {
      await window.Auth.signInWithEmail(email, password);
      currentUser = (await window.Auth.getSession())?.user;
      currentSubscription = await window.Subscription.getUserSubscription();
      updateAuthUI(true);
      document.getElementById("authModal").close();
    } catch (e) {
      errorEl.textContent = e.message || "登录失败";
      errorEl.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "登录";
    }
  }

  async function handleRegister() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const errorEl = document.getElementById("authError");
    const btn = document.getElementById("authEmailBtn");

    if (!email || !password) {
      errorEl.textContent = "请输入邮箱和密码";
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "注册中...";
    errorEl.style.display = "none";

    try {
      await window.Auth.signUp(email, password);
      errorEl.textContent = "注册成功！请查收确认邮件后登录";
      errorEl.style.color = "#057748";
      errorEl.style.display = "block";
      document.getElementById("authSwitchToRegister").click();
    } catch (e) {
      errorEl.textContent = e.message || "注册失败";
      errorEl.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "注册";
    }
  }

  async function handleGoogleLogin() {
    const errorEl = document.getElementById("authError");
    errorEl.style.display = "none";
    try {
      await window.Auth.signInWithGoogle();
      currentUser = (await window.Auth.getSession())?.user;
      currentSubscription = await window.Subscription.getUserSubscription();
      updateAuthUI(true);
      document.getElementById("authModal").close();
    } catch (e) {
      errorEl.textContent = e.message || "Google 登录失败";
      errorEl.style.display = "block";
    }
  }

  async function handleLogout() {
    try {
      await window.Auth.signOut();
      currentUser = null;
      currentSubscription = { plan: "free", active: false, expires_at: null };
      updateAuthUI(false);
    } catch (e) {
      console.warn("Logout failed:", e);
    }
  }

  async function handleRedeem() {
    const code = document.getElementById("redeemCodeInput").value.trim();
    const errorEl = document.getElementById("redeemError");
    const btn = document.getElementById("btnRedeemConfirm");

    if (!code) {
      errorEl.textContent = "请输入激活码";
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "兑换中...";
    errorEl.style.display = "none";

    try {
      const result = await window.Redeem.redeemCode(code);
      if (result.success) {
        currentSubscription = await window.Subscription.getUserSubscription();
        updateAuthUI(true);
        document.getElementById("redeemModal").close();
        document.getElementById("upgradeModal").close();
        alert("兑换成功！您的 Pro 订阅已生效");
      }
    } catch (e) {
      errorEl.textContent = e.message || "兑换失败";
      errorEl.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "兑换";
    }
  }

  async function handleCreateOrder(planKey) {
    try {
      const result = await window.Payment.createOrder(planKey);
      document.getElementById("paymentNoteCode").textContent = result.note;
      document.getElementById("paymentSection").style.display = "block";
    } catch (e) {
      alert(e.message || "创建订单失败");
    }
  }

  function bindAuthEvents() {
    document
      .getElementById("btnToolbarLogin")
      ?.addEventListener("click", () => {
        document.getElementById("authModal").showModal();
      });
    document.getElementById("authModalClose")?.addEventListener("click", () => {
      document.getElementById("authModal").close();
    });
    document
      .getElementById("authEmailBtn")
      ?.addEventListener("click", handleLogin);
    document
      .getElementById("authGoogleBtn")
      ?.addEventListener("click", handleGoogleLogin);
    document
      .getElementById("btnToolbarLogout")
      ?.addEventListener("click", handleLogout);
    document
      .getElementById("btnToolbarUpgrade")
      ?.addEventListener("click", () => {
        document.getElementById("upgradeModal").showModal();
      });
    document
      .getElementById("toolbarUserAvatar")
      ?.addEventListener("click", () => {
        document.getElementById("upgradeModal").showModal();
      });
    document
      .getElementById("upgradeModalClose")
      ?.addEventListener("click", () => {
        document.getElementById("upgradeModal").close();
      });
    document
      .getElementById("planYearly")
      ?.addEventListener("click", () => handleCreateOrder("pro_yearly"));
    document
      .getElementById("planMonthly")
      ?.addEventListener("click", () => handleCreateOrder("pro_monthly"));
    document.getElementById("btnRedeemCode")?.addEventListener("click", () => {
      document.getElementById("upgradeModal").close();
      document.getElementById("redeemModal").showModal();
    });
    document
      .getElementById("redeemModalClose")
      ?.addEventListener("click", () => {
        document.getElementById("redeemModal").close();
      });
    document
      .getElementById("btnRedeemConfirm")
      ?.addEventListener("click", handleRedeem);
    document
      .getElementById("btnConfirmPayment")
      ?.addEventListener("click", () => {
        alert("请等待管理员确认付款，确认后激活码将自动发送到您的邮箱");
        document.getElementById("upgradeModal").close();
      });

    let isRegisterMode = false;
    document
      .getElementById("authSwitchToRegister")
      ?.addEventListener("click", () => {
        isRegisterMode = !isRegisterMode;
        document.getElementById("authModalTitle").textContent = isRegisterMode
          ? "注册"
          : "登录";
        document.getElementById("authEmailBtn").textContent = isRegisterMode
          ? "注册"
          : "登录";
        document.getElementById("authSwitchToRegister").textContent =
          isRegisterMode ? "已有账号？登录" : "没有账号？注册";
        document.getElementById("authError").style.display = "none";
      });
  }

  let selectedCommentIds = new Set();
  let savedNoteModalState = { noteId: null, source: null, isTrash: false };
  let selectedParsedNoteIds = new Set();
  let selectedTrashIds = new Set();

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function getHighResImageUrl(url) {
    if (!url) return url;
    return url
      .replace(/_thumbnail(\.\w+)$/, "$1")
      .replace(/_small(\.\w+)$/, "$1")
      .replace(/_medium(\.\w+)$/, "$1");
  }

  const els = {
    views: $$(".view"),
    navItems: $$(".nav-item"),
    commentList: $("#commentList"),
    emptyState: $("#emptyState"),
    noteCommentList: $("#noteCommentList"),
    noteEmptyState: $("#noteEmptyState"),
    searchInput: $("#searchInput"),
    categoryFilter: $("#categoryFilter"),
    sortFilter: $("#sortFilter"),
    selectAll: $("#selectAll"),
    mainToolbar: $("#mainToolbar"),
    commentCount: $("#commentCount"),
    btnBatchDelete: $("#btnBatchDelete"),
    badgeAll: $("#badge-all"),
    badgeCategory: $("#badge-category"),
    badgeNote: $("#badge-note"),
    categoryGrid: $("#categoryGrid"),
    categoryCount: $("#categoryCount"),
    catSelectAll: $("#catSelectAll"),
    btnCatBatchDelete: $("#btnCatBatchDelete"),
    statsPanel: $("#statsPanel"),
    btnAddCategory: $("#btnAddCategory"),
    renameModal: $("#renameModal"),
    renameInput: $("#renameInput"),
    modalConfirm: $("#modalConfirm"),
    modalCancel: $("#modalCancel"),
    modalClose: $("#modalClose"),
    renameModalTitle: $("#renameModalTitle"),
    btnOpenXHS: $("#btnOpenXHS"),

    noteModal: $("#noteModal"),
    noteModalInput: $("#noteModalInput"),
    noteModalConfirm: $("#noteModalConfirm"),
    noteModalCancel: $("#noteModalCancel"),
    noteModalClose: $("#noteModalClose"),
    noteTagGrid: $("#noteTagGrid"),
    noteCommentArea: $("#noteCommentArea"),
    noteDetailTitle: $("#noteDetailTitle"),
    noteDetailBack: $("#noteDetailBack"),
    noteCount: $("#noteCount"),
    noteSelectAll: $("#noteSelectAll"),
    btnNoteBatchDelete: $("#btnNoteBatchDelete"),

    badgeParsed: $("#badge-parsed"),
    savedNoteModal: $("#savedNoteModal"),
    savedNoteModalTitle: $("#savedNoteModalTitle"),
    savedNoteModalBody: $("#savedNoteModalBody"),
    savedNoteModalClose: $("#savedNoteModalClose"),
    savedNoteModalRestore: $("#savedNoteModalRestore"),
    savedNoteModalPermanentDelete: $("#savedNoteModalPermanentDelete"),
    savedNoteModalLink: $("#savedNoteModalLink"),
    categoryDetailArea: $("#categoryDetailArea"),
    categoryDetailTitle: $("#categoryDetailTitle"),
    categoryDetailBack: $("#categoryDetailBack"),
    categoryCommentList: $("#categoryCommentList"),

    parsedList: $("#parsedList"),
    parsedEmpty: $("#parsedEmpty"),
    parsedCount: $("#parsedCount"),
    parsedBatchBar: $("#parsedBatchBar"),
    parsedSelectAll: $("#parsedSelectAll"),
    btnParsedBatchDelete: $("#btnParsedBatchDelete"),

    trashList: $("#trashList"),
    trashEmptyState: $("#trashEmptyState"),
    trashCount: $("#trashCount"),
    trashSelectAll: $("#trashSelectAll"),
    btnTrashBatchRestore: $("#btnTrashBatchRestore"),
    btnTrashBatchDelete: $("#btnTrashBatchDelete"),
    btnTrashEmptyAll: $("#btnTrashEmptyAll"),
    badgeTrash: $("#badge-trash"),
    trashTypeFilterSelect: $("#trashTypeFilterSelect"),
  };

  // ---------- Toast ----------
  function showToast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2000);
  }

  // ---------- 安全 HTML 转义 ----------
  function escHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // 比较器
  const pinnedFirstTimeDesc = (a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.collectedAt || 0) - (a.collectedAt || 0);
  };
  const timeAsc = (a, b) => (a.collectedAt || 0) - (b.collectedAt || 0);
  const likesDesc = (a, b) => (b.likes || 0) - (a.likes || 0);

  async function getAllComments() {
    const comments = await storage.getComments();
    return Object.values(comments);
  }

  async function getFilteredSortedComments() {
    const allComments = await getAllComments();
    const catFilter = els.categoryFilter.value;
    const query = els.searchInput.value.trim().toLowerCase();
    const sort = els.sortFilter.value;

    let filtered = [...allComments];
    if (catFilter) filtered = filtered.filter((c) => c.category === catFilter);
    if (query) {
      filtered = filtered.filter(
        (c) =>
          c?.content?.toLowerCase().includes(query) ||
          c?.author?.toLowerCase().includes(query) ||
          c?.noteTitle?.toLowerCase().includes(query),
      );
    }

    if (sort === "time_asc") filtered.sort(timeAsc);
    else if (sort === "likes_desc") filtered.sort(likesDesc);
    else filtered.sort(pinnedFirstTimeDesc);

    return filtered;
  }

  // 生成单条评论卡片 HTML（修复嵌套模板字面量）
  function createCommentCardHtml(c, catMap) {
    const cat = catMap[c.category] || { name: "未分类", color: "#999" };
    const pinnedClass = c.pinned ? "pinned" : "";
    const selectedClass = selectedCommentIds.has(c.id) ? "selected" : "";
    const displayName = c.title || c.author || "匿名";

    const noteLink = c.noteUrl
      ? `<a href="${c.noteUrl}" target="_blank" class="comment-note-link" title="查看原笔记: ${escHtml(c.noteTitle || "")}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>`
      : "";

    let imagesHtml = "";
    if (c.images?.length) {
      let imgs = "";
      for (const src of c.images) {
        imgs += `<img src="${escHtml(src)}" loading="lazy" referrerpolicy="no-referrer" style="background:#f3f4f6;min-height:6rem" />`;
      }
      imagesHtml = `<div class="comment-images">${imgs}</div>`;
    }

    const collectedTime = c.collectedAt
      ? new Date(c.collectedAt).toLocaleString("zh-CN")
      : "";
    const likesHtml = c.likes
      ? `<span class="inline-flex items-center gap-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${c.likes}</span>`
      : "";
    const noteHtml = c.note
      ? `<span class="comment-note-badge" title="点击编辑备注">${escHtml(c.note)}</span>`
      : `<span class="comment-note-badge empty" title="添加备注">+ 备注</span>`;

    const actionsHtml = `<button class="btn-pin ${c.pinned ? "active" : ""}" title="${c.pinned ? "取消置顶" : "置顶"}" data-action="pin" data-id="${c.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg>
        </button>
        <button class="btn-delete" title="删除" data-action="delete" data-id="${c.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>`;

    return `<div class="comment-card ${pinnedClass} ${selectedClass}" data-id="${c.id}">
      <div class="comment-card-head">
        <span class="comment-author">${escHtml(displayName)}</span>
        <span class="comment-note">${escHtml(c.noteTitle || "")}</span>
        <span class="comment-tag" style="background:${cat.color}">${escHtml(cat.name)}</span>
        ${noteLink}
      </div>
      <div class="comment-content">${escHtml(c.content)}</div>
      ${imagesHtml}
      <div class="comment-footer">
        <div class="comment-meta">
          <span class="inline-flex items-center gap-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${collectedTime}</span>
          ${likesHtml}
          ${noteHtml}
        </div>
        <div class="comment-actions">
          ${actionsHtml}
        </div>
      </div>
    </div>`;
  }

  function updateBatchButtons() {
    const size = selectedCommentIds.size;
    els.btnBatchDelete.disabled = size === 0;
    els.btnBatchDelete.innerHTML = `删除 (${size})`;
  }

  async function renderAllComments() {
    const allComments = await getFilteredSortedComments();

    if (els.selectAll) els.selectAll.checked = false;

    els.commentCount.textContent = `共 ${allComments.length} 条`;

    if (allComments.length === 0) {
      els.commentList.innerHTML = "";
      els.emptyState.classList.add("show");
      return;
    }

    els.emptyState.classList.remove("show");

    const categories = await storage.getCategories();
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    const cardsHtml = allComments
      .map((c) => createCommentCardHtml(c, catMap, false))
      .join("");
    els.commentList.innerHTML = cardsHtml;
    attachCommentEvents();
    updateBatchButtons();
  }

  function attachCommentEvents(container) {
    container = container || els.commentList;
    container.querySelectorAll(".comment-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (
          e.target.closest("[data-action]") ||
          e.target.closest(".comment-note-link") ||
          e.target.closest(".comment-note-badge")
        )
          return;
        const id = card.dataset.id;
        if (selectedCommentIds.has(id)) {
          selectedCommentIds.delete(id);
          card.classList.remove("selected");
        } else {
          selectedCommentIds.add(id);
          card.classList.add("selected");
        }
        updateBatchButtons();
      });
    });

    container.addEventListener("click", (e) => {
      const img = e.target.closest(".comment-images img");
      if (img) window.open(img.src, "_blank");
    });

    let editingNoteId = null;
    container.addEventListener("click", async (e) => {
      const badge = e.target.closest(".comment-note-badge");
      if (!badge) return;
      const card = badge.closest(".comment-card");
      if (!card) return;
      const id = card.dataset.id;
      const current = badge.textContent === "+ 备注" ? "" : badge.textContent;
      editingNoteId = id;
      els.noteModalInput.value = current;
      els.noteModal.showModal();
      setTimeout(() => els.noteModalInput.focus(), 100);
    });

    async function saveNoteModal() {
      const note = els.noteModalInput.value.trim();
      if (editingNoteId) {
        await storage.setNote(editingNoteId, note);
        editingNoteId = null;
        renderAllComments();
        renderNoteView();
        refreshBadges();
      }
      els.noteModal.close();
    }
    const closeNoteModal = () => {
      editingNoteId = null;
      els.noteModal.close();
    };
    els.noteModalConfirm.addEventListener("click", saveNoteModal);
    els.noteModalCancel.addEventListener("click", closeNoteModal);
    els.noteModalClose.addEventListener("click", closeNoteModal);
    els.noteModal.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveNoteModal();
      if (e.key === "Escape") closeNoteModal();
    });
    els.noteModal.addEventListener("close", () => {
      editingNoteId = null;
    });

    els.commentList.querySelectorAll('[data-action="pin"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        await storage.togglePin(btn.dataset.id);
        await renderAllComments();
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (confirm("确定要删除此评论吗？")) {
          await storage.moveCommentToTrash(btn.dataset.id);
          selectedCommentIds.delete(btn.dataset.id);
          updateBatchButtons();
          await renderAllComments();
          await renderNoteView();
          await refreshBadges();
          showToast("已移至回收站");
        }
      });
    });
  }

  // 分类视图 - 提取重命名处理函数（降低嵌套深度）
  async function handleRenameClick(btn, categories) {
    const id = btn.dataset.id;
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    showRenameModal(cat.name, async (newName) => {
      await storage.renameCategory(id, newName);
      await renderCategoryView();
      await refreshCategoryFilter();
      await refreshStatsIfVisible();
    });
  }

  function createCategoryCardHtml(cat, count) {
    return `<div class="category-card" data-id="${cat.id}">
      <div class="category-card-name">
        <span class="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style="background:${cat.color}"></span>
        <span class="flex-1 truncate">${escHtml(cat.name)}</span>
      </div>
      <div class="text-xs text-gray-500 mb-1">${count} 条评论</div>
      <div class="category-card-actions">
        <button data-action="rename" data-id="${cat.id}">重命名</button>
        <button class="btn-delete-cat" data-action="delete-cat" data-id="${cat.id}">删除</button>
      </div>
    </div>`;
  }

  let currentNoteText = null;

  const selectedNoteTags = new Set();
  const tagColors = [
    "#FF2442",
    "#FF9500",
    "#FFCC00",
    "#34C759",
    "#007AFF",
    "#5856D6",
    "#AF52DE",
    "#FF6B6B",
    "#10B981",
    "#F59E0B",
  ];

  function getTagColor(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++)
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    return tagColors[Math.abs(hash) % tagColors.length];
  }

  function updateNoteBatchButtons() {
    const any = selectedNoteTags.size > 0;
    els.btnNoteBatchDelete.disabled = !any;
  }

  async function renderNoteView() {
    const categories = await storage.getCategories();
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
    const comments = await storage.getComments();
    const noteList = Object.values(comments).filter((c) => c.note);
    const grid = els.noteTagGrid;
    const empty = els.noteEmptyState;
    const area = els.noteCommentArea;

    area.hidden = true;
    currentNoteText = null;
    selectedNoteTags.clear();
    updateNoteBatchButtons();
    if (els.noteSelectAll) els.noteSelectAll.checked = false;

    const tagMap = {};
    for (const c of noteList) {
      const t = c.note.trim();
      if (!t) continue;
      if (!tagMap[t]) tagMap[t] = { text: t, comments: [] };
      tagMap[t].comments.push(c);
    }
    const tags = Object.values(tagMap);
    els.noteCount.textContent = `共 ${tags.length} 个标签`;

    if (noteList.length === 0) {
      grid.innerHTML = "";
      empty.classList.add("show");
      return;
    }
    empty.classList.remove("show");
    tags.sort((a, b) => b.comments.length - a.comments.length);

    grid.innerHTML = tags
      .map((t) => {
        const color = getTagColor(t.text);
        return `<div class="note-badge" data-note="${escHtml(t.text)}" style="background:${color}">
          <span class="note-badge-text">${escHtml(t.text)}</span>
          <span class="note-badge-count">${t.comments.length}</span>
          <button class="note-badge-del" data-del-note="${escHtml(t.text)}" title="删除备注">&times;</button>
        </div>`;
      })
      .join("");

    grid.querySelectorAll(".note-badge").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".note-badge-del")) return;
        if (e.target.closest(".note-badge-check")) return;
        const noteText = el.dataset.note;
        showNoteComments(noteText, catMap);
      });
    });

    grid.querySelectorAll(".note-badge-del").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const noteText = btn.dataset.delNote;
        if (!confirm(`确定要删除备注 "${noteText}" 吗？`)) return;
        try {
          const allComments = Object.values(await storage.getComments());
          let count = 0;
          for (const c of allComments) {
            if (c.note?.trim() === noteText) {
              c.note = "";
              await storage.putComment(c.id, c);
              count++;
            }
          }
          await renderNoteView();
          await refreshBadges();
          showToast(`已删除 ${count} 条评论的备注`);
        } catch (err) {
          showToast("删除失败：" + err.message);
        }
      });
    });

    if (els.noteSelectAll) {
      els.noteSelectAll.addEventListener("change", () => {
        const checked = els.noteSelectAll.checked;
        selectedNoteTags.clear();
        if (checked) tags.forEach((t) => selectedNoteTags.add(t.text));
        grid.querySelectorAll(".note-badge").forEach((el) => {
          el.classList.toggle("selected", checked);
        });
        updateNoteBatchButtons();
      });
    }

    els.btnNoteBatchDelete.onclick = async () => {
      if (selectedNoteTags.size === 0) return;
      if (!confirm(`确定要删除选中的 ${selectedNoteTags.size} 个备注吗？`))
        return;
      try {
        const allComments = Object.values(await storage.getComments());
        let count = 0;
        for (const c of allComments) {
          if (selectedNoteTags.has(c.note?.trim())) {
            c.note = "";
            await storage.putComment(c.id, c);
            count++;
          }
        }
        await renderNoteView();
        await refreshBadges();
        showToast(`已删除 ${count} 条评论的备注`);
      } catch (err) {
        showToast("删除失败：" + err.message);
      }
    };
  }

  async function showNoteComments(noteText, catMap) {
    if (!noteText) return;

    const allComments = Object.values(await storage.getComments());
    const comments = allComments.filter((c) => c.note?.trim() === noteText);

    const sortedComments = comments.toSorted(
      (a, b) => (b.collectedAt || 0) - (a.collectedAt || 0),
    );

    els.noteCommentArea.hidden = false;
    els.noteDetailTitle.textContent = `"${noteText}" - 共 ${sortedComments.length} 条评论`;
    els.noteCommentList.innerHTML = sortedComments
      .map((c) => createCommentCardHtml(c, catMap))
      .join("");

    attachCommentEvents(els.noteCommentList);

    els.noteTagGrid.querySelectorAll(".note-badge").forEach((el) => {
      el.classList.toggle("active", el.dataset.note === noteText);
    });
  }

  function buildSavedNoteModalBody(note) {
    let mediaHtml = "";
    if (note.isVideo) {
      const playerUrl = chrome.runtime.getURL("src/video-player.html");
      const encodedVideoUrl = note.videoUrl
        ? encodeURIComponent(note.videoUrl)
        : "";
      const encodedTitle = encodeURIComponent(note.title || "");
      const encodedSource = encodeURIComponent(note.url || "");
      const fullPlayerUrl = note.videoUrl
        ? `${playerUrl}?url=${encodedVideoUrl}&title=${encodedTitle}&source=${encodedSource}`
        : "#";

      if (note.videoUrl) {
        mediaHtml = `<a href="${fullPlayerUrl}" target="_blank" class="saved-note-video-cover" style="display:block;text-decoration:none">
          <div class="video-play-icon">▶</div>
          <img src="${escHtml(note.images?.[0] || "")}" alt="视频封面" referrerpolicy="no-referrer" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:0.5rem;background:#f3f4f6" />
        </a>`;
      } else if (note.images?.length) {
        mediaHtml = `<a href="${escHtml(note.url || "#")}" target="_blank" class="saved-note-video-cover" style="display:block;text-decoration:none">
          <div class="video-play-icon">▶</div>
          <img src="${escHtml(note.images[0])}" alt="视频封面" referrerpolicy="no-referrer" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:0.5rem;background:#f3f4f6" />
        </a>`;
      } else {
        mediaHtml = '<div class="saved-note-noimg">视频笔记</div>';
      }
    } else if (note.images?.length) {
      let imgs = "";
      for (const src of note.images) {
        imgs += `<div class="saved-note-img-item"><a href="${escHtml(src)}" target="_blank" rel="noopener noreferrer"><img src="${escHtml(src)}" alt="笔记图片" referrerpolicy="no-referrer" style="background:#f3f4f6;min-height:6rem" /></a></div>`;
      }
      mediaHtml = `<div class="saved-note-images">${imgs}</div>`;
    } else {
      mediaHtml = '<div class="saved-note-noimg">暂无图片</div>';
    }
    const dateLabel = note.savedAt
      ? new Date(note.savedAt).toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    const authorHtml = note.author
      ? `<span class="text-xs text-gray-500">${escHtml(note.author)}</span>`
      : "";
    const timeHtml = dateLabel
      ? `<span class="text-xs text-gray-400 ml-2">${dateLabel}</span>`
      : "";
    const contentHtml = note.content
      ? `<div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${escHtml(note.content)}</div>`
      : '<div class="text-sm text-gray-400">暂无正文</div>';

    return `<div class="saved-note-detail-card">
      <div class="saved-note-body-row">
        <div class="saved-note-img-col">${mediaHtml}</div>
        <div class="saved-note-text-col">
          <div class="flex items-center gap-1 mb-2">${authorHtml}${timeHtml}</div>
          ${contentHtml}
        </div>
      </div>
    </div>`;
  }

  async function showSavedNoteDetail(noteId, source, isTrash = false) {
    const note = isTrash
      ? (await storage.getTrashNotesBySource(source)).find(
          (n) => n.id === noteId,
        )
      : await storage.getSavedNote(noteId);
    if (!note) return;

    savedNoteModalState = { noteId, source, isTrash };
    els.savedNoteModalTitle.textContent = note.title || "无标题";
    els.savedNoteModalBody.innerHTML = buildSavedNoteModalBody(note);

    if (els.savedNoteModalRestore) els.savedNoteModalRestore.hidden = !isTrash;
    if (els.savedNoteModalPermanentDelete)
      els.savedNoteModalPermanentDelete.hidden = !isTrash;

    const link = els.savedNoteModalLink;
    if (note.url) {
      link.href = note.url;
      link.hidden = false;
    } else {
      link.hidden = true;
    }

    els.savedNoteModal.showModal();
  }

  const selectedCatIds = new Set();

  function updateCatBatchButtons() {
    const size = selectedCatIds.size;
    els.btnCatBatchDelete.disabled = size === 0;
    els.btnCatBatchDelete.innerHTML = `删除 (${size})`;
  }

  async function renderCategoryView() {
    const categories = await storage.getCategories();

    selectedCatIds.clear();
    updateCatBatchButtons();
    if (els.catSelectAll) els.catSelectAll.checked = false;
    els.categoryDetailArea.hidden = true;

    els.categoryCount.textContent = `共 ${categories.length} 个分类`;

    els.categoryGrid.innerHTML = categories
      .map((cat) => {
        return `<div class="cat-badge" data-id="${cat.id}" style="background:${cat.color}">
          <span class="cat-badge-dot" style="background:rgba(255,255,255,0.4)"></span>
          <span class="cat-badge-name">${escHtml(cat.name)}</span>
          <button class="cat-badge-del" data-del-id="${cat.id}" title="删除分类">&times;</button>
        </div>`;
      })
      .join("");

    els.categoryGrid.querySelectorAll(".cat-badge").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".cat-badge-del")) return;
        const catId = el.dataset.id;
        showCategoryComments(catId, categories);
      });
    });

    els.categoryGrid.querySelectorAll(".cat-badge-del").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.delId;
        if (id === "default") {
          alert("默认分类不能删除");
          return;
        }
        if (!confirm("确定要删除此分类吗？")) return;
        await storage.moveCategoryToTrash(id);
        await renderCategoryView();
        await refreshCategoryFilter();
        await refreshBadges();
        await refreshStatsIfVisible();
        showToast("已移至回收站");
      });
    });

    if (els.catSelectAll) {
      els.catSelectAll.addEventListener("change", () => {
        const checked = els.catSelectAll.checked;
        selectedCatIds.clear();
        if (checked) categories.forEach((c) => selectedCatIds.add(c.id));
        els.categoryGrid.querySelectorAll(".cat-badge").forEach((el) => {
          el.classList.toggle("selected", checked);
        });
        updateCatBatchButtons();
      });
    }

    els.btnCatBatchDelete.onclick = async () => {
      if (selectedCatIds.size === 0) return;
      if (selectedCatIds.has("default")) {
        alert("默认分类不能删除");
        return;
      }
      if (!confirm(`确定要删除选中的 ${selectedCatIds.size} 个分类吗？`))
        return;
      for (const id of selectedCatIds) {
        await storage.moveCategoryToTrash(id);
      }
      showToast("已移至回收站");
      await renderCategoryView();
      await refreshCategoryFilter();
      await refreshBadges();
      await refreshStatsIfVisible();
    };
  }

  // 统计页面（无嵌套模板字面量问题）
  function getPercentiles(sortedValues) {
    const len = sortedValues.length;
    if (len === 0) return { p25: 1, p50: 1, p75: 1 };
    return {
      p25: Math.max(sortedValues[Math.floor(len * 0.25)], 1),
      p50: Math.max(sortedValues[Math.floor(len * 0.5)], 1),
      p75: Math.max(sortedValues[Math.floor(len * 0.75)], 1),
    };
  }

  function calculateStreak(dayCounts, firstDate, today) {
    let streak = 0;
    for (let d = new Date(today); d >= firstDate; d.setDate(d.getDate() - 1)) {
      if (dayCounts[d.toISOString().slice(0, 10)]) streak++;
      else break;
    }
    return streak;
  }

  function getColorLevel(count, p25, p50, p75) {
    if (count === 0) return 0;
    if (count <= p25) return 1;
    if (count <= p50) return 2;
    if (count <= p75) return 3;
    return 4;
  }

  function renderGraphHTML(options) {
    const {
      dayCounts,
      maxCount,
      totalActive,
      streak,
      cols,
      rows,
      step,
      firstDate,
      lastDate,
      today,
      currentYear,
    } = options;
    const sortedCounts = Object.values(dayCounts)
      .filter(Boolean)
      .sort((a, b) => a - b);
    const { p25, p50, p75 } = getPercentiles(sortedCounts);
    const colors = ["#ebedf0", "#fecdd3", "#fda4af", "#fb7185", "#be123c"];

    let html = `<div class="flex items-center gap-4 mb-4 text-xs text-gray-500">`;
    html += `<span>📊 活跃天数 <strong class="text-gray-900">${totalActive}</strong></span>`;
    html += `<span>🔥 单日最多 <strong class="text-gray-900">${maxCount}</strong></span>`;
    html += `<span>⛓️ 当前连续 <strong class="text-gray-900">${streak}</strong> 天</span>`;
    html += `</div><div style="position:relative;padding-left:28px;min-height:${rows * step + 20}px">`;

    let lastMonth = "";
    for (let c = 0; c < cols; c++) {
      const d = new Date(firstDate);
      d.setDate(d.getDate() + c * 7);
      if (d.getFullYear() !== currentYear) continue;
      const month = d.toLocaleDateString("zh-CN", { month: "short" });
      if (month !== lastMonth) {
        html += `<span style="position:absolute;top:0;left:${c * step + 28}px;font-size:10px;color:#9ca3af;white-space:nowrap">${month}</span>`;
        lastMonth = month;
      }
    }

    const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];
    for (let r = 0; r < rows; r++) {
      const y = 16 + r * step;
      html += `<span style="position:absolute;top:${y + 1}px;left:0;width:24px;text-align:right;font-size:10px;color:#9ca3af">${weekLabels[r]}</span>`;
      for (let c = 0; c < cols; c++) {
        const d = new Date(firstDate);
        d.setDate(d.getDate() + c * 7 + r);
        if (d > lastDate) continue;
        const key = d.toISOString().slice(0, 10);
        const count = dayCounts[key] || 0;
        const level = getColorLevel(count, p25, p50, p75);
        const title = count > 0 ? `${key} · ${count} 条评论` : key;
        html += `<div style="position:absolute;top:${y}px;left:${c * step + 28}px;width:13px;height:13px;border-radius:2px;background:${colors[level]};cursor:default" title="${title}"></div>`;
      }
    }

    html += `<div style="position:absolute;bottom:-2px;right:0;display:flex;align-items:center;gap:2px;font-size:10px;color:#9ca3af">`;
    html += `<span>少</span>`;
    for (let i = 0; i < 5; i++) {
      html += `<div style="width:10px;height:10px;border-radius:1px;background:${colors[i]}"></div>`;
    }
    html += `<span>多</span></div></div>`;
    return html;
  }

  async function drawContributionGraph() {
    const container = document.getElementById("contributionGraph");
    if (!container) return;

    const step = 16;
    const rows = 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayCounts = {};
    const allComments = Object.values(await storage.getComments());
    for (const c of allComments) {
      if (!c.collectedAt) continue;
      const key = new Date(c.collectedAt).toISOString().slice(0, 10);
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    }

    const currentYear = today.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const firstDate = new Date(yearStart);
    firstDate.setDate(firstDate.getDate() - firstDate.getDay());

    const yearEnd = new Date(currentYear, 11, 31);
    const lastDate = new Date(yearEnd);
    if (lastDate.getDay() !== 6) {
      lastDate.setDate(lastDate.getDate() + (6 - lastDate.getDay()));
    }

    const totalDays = Math.round((lastDate - firstDate) / 86400000) + 1;
    const cols = Math.ceil(totalDays / 7);

    const values = Object.values(dayCounts).filter(Boolean);
    const maxCount = values.length > 0 ? Math.max(...values) : 0;
    const totalActive = values.length;
    const streak = calculateStreak(dayCounts, firstDate, today);

    const html = renderGraphHTML({
      dayCounts,
      maxCount,
      totalActive,
      streak,
      cols,
      rows,
      step,
      firstDate,
      lastDate,
      today,
      currentYear,
    });
    container.innerHTML = html;
  }

  function buildWordCloud(words) {
    if (!words.length) return '<p class="text-sm text-gray-500">暂无数据</p>';
    const maxFreq = Math.max(...words.map((w) => w.count));
    const minFreq = Math.min(...words.map((w) => w.count));
    const range = maxFreq - minFreq || 1;
    const colorPalette = [
      {
        light: "hsl(350,90%,80%)",
        base: "hsl(350,85%,60%)",
        dark: "hsl(350,80%,40%)",
      },
      {
        light: "hsl(217,90%,78%)",
        base: "hsl(217,85%,55%)",
        dark: "hsl(217,80%,38%)",
      },
      {
        light: "hsl(160,80%,78%)",
        base: "hsl(160,75%,50%)",
        dark: "hsl(160,70%,35%)",
      },
      {
        light: "hsl(38,92%,78%)",
        base: "hsl(38,88%,52%)",
        dark: "hsl(38,82%,38%)",
      },
      {
        light: "hsl(261,90%,78%)",
        base: "hsl(261,85%,58%)",
        dark: "hsl(261,80%,40%)",
      },
      {
        light: "hsl(330,88%,80%)",
        base: "hsl(330,82%,58%)",
        dark: "hsl(330,76%,40%)",
      },
      {
        light: "hsl(186,88%,78%)",
        base: "hsl(186,82%,50%)",
        dark: "hsl(186,76%,35%)",
      },
      {
        light: "hsl(82,80%,72%)",
        base: "hsl(82,75%,48%)",
        dark: "hsl(82,70%,35%)",
      },
    ];
    const sorted = [...words].sort((a, b) => b.count - a.count);
    let html = '<div class="word-cloud">';
    for (let i = 0; i < sorted.length; i++) {
      const w = sorted[i];
      const ratio = (w.count - minFreq) / range;
      const size = 0.7 + ratio * 0.6;
      const palette = colorPalette[i % colorPalette.length];
      const color =
        ratio > 0.6 ? palette.dark : ratio > 0.3 ? palette.base : palette.light;
      const opacity = 0.4 + ratio * 0.6;
      const maxLen = Math.ceil(10 / size);
      const displayText =
        w.text.length > maxLen ? w.text.slice(0, maxLen) + "…" : w.text;
      html += `<span style="font-size:${size}rem;color:${color};opacity:${opacity};font-weight:${ratio > 0.5 ? 700 : 400}" class="inline-block px-1" title="${escHtml(w.text)}">${escHtml(displayText)}</span>`;
    }
    return html + "</div>";
  }

  async function renderStats() {
    const stats = await storage.getStats();
    const categories = await storage.getCategories();
    const comments = await storage.getComments();
    const savedNotes = await storage.getSavedNotes();
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
    const maxCount = Math.max(...Object.values(stats.categoryCounts), 1);
    const catEntries = Object.entries(stats.categoryCounts);

    const commentNotes = Object.values(comments).filter((c) => c.note);

    const wordFreq = {};
    for (const c of Object.values(comments)) {
      const words = (c.content || "")
        .split(/[\s,，。、！？;；：""''（）\(\)\[\]【】]+/)
        .filter((w) => w.length >= 2);
      for (const w of words) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    }
    for (const n of Object.values(savedNotes)) {
      const words = ((n.title || "") + " " + (n.content || ""))
        .split(/[\s,，。、！？;；：""''（）\(\)\[\]【】]+/)
        .filter((w) => w.length >= 2);
      for (const w of words) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    }
    const wordCloud = Object.entries(wordFreq)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    let distributionHtml = "";
    for (const [catId, count] of catEntries) {
      const cat = catMap[catId] || { name: "未分类", color: "#999" };
      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
      distributionHtml += `<div class="flex items-center gap-3">
        <div class="w-20 text-sm text-gray-700 truncate">${escHtml(cat.name)}</div>
        <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all" style="width:${pct}%;background:${cat.color}"></div>
        </div>
        <div class="w-8 text-right text-sm text-gray-500 font-medium">${count}</div>
      </div>`;
    }

    const statsHtml = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card-value">${stats.totalComments}</div><div class="stat-card-label">总评论数</div></div>
      <div class="stat-card"><div class="stat-card-value">${stats.totalNotes}</div><div class="stat-card-label">关联笔记</div></div>
      <div class="stat-card"><div class="stat-card-value">${stats.totalCategories}</div><div class="stat-card-label">分类数</div></div>
      <div class="stat-card"><div class="stat-card-value">${commentNotes.length}</div><div class="stat-card-label">备注管理</div></div>
      <div class="stat-card"><div class="stat-card-value">${stats.totalParsedNotes}</div><div class="stat-card-label">图文解析</div></div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div class="bg-white border border-gray-200 rounded-xl p-5">
        <h4 class="text-base font-semibold text-gray-900 mb-3">分类分布</h4>
        <div class="space-y-2.5">${distributionHtml}</div>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-5">
        <h4 class="text-base font-semibold text-gray-900 mb-3">关键词云</h4>
        ${buildWordCloud(wordCloud)}
      </div>
    </div>
    <div class="bg-white border border-gray-200 rounded-xl p-5 mt-6">
      <h4 class="text-base font-semibold text-gray-900 mb-3">收集热力图</h4>
      <div id="contributionGraph"></div>
    </div>`;
    els.statsPanel.innerHTML = statsHtml;
    await drawContributionGraph();
  }

  async function refreshStatsIfVisible() {
    const statsView = document.getElementById("view-stats");
    if (statsView && statsView.classList.contains("active")) {
      await renderStats();
    }
  }

  // 通用刷新
  async function refreshBadges() {
    const comments = await storage.getComments();
    const total = Object.keys(comments).length;
    els.badgeAll.textContent = total;
    let catTotal = 0;
    for (const id of Object.keys(comments)) {
      if (comments[id].category) catTotal++;
    }
    els.badgeCategory.textContent = catTotal;
    const noteCount = Object.values(comments).filter((c) => c.note).length;
    els.badgeNote.textContent = noteCount;
    const savedNotes = await storage.getSavedNotes();
    const notes = Object.values(savedNotes);
    const parsedCount = notes.filter((n) => n.source === "parsed").length;
    if (els.badgeParsed) els.badgeParsed.textContent = parsedCount;
    const totalTrashCount = await storage.getTrashCount();
    if (els.badgeTrash) els.badgeTrash.textContent = totalTrashCount;
  }

  async function refreshCategoryFilter() {
    const categories = await storage.getCategories();
    const currentVal = els.categoryFilter.value;
    els.categoryFilter.innerHTML =
      '<option value="">全部分类</option>' +
      categories
        .map((c) => `<option value="${c.id}">${escHtml(c.name)}</option>`)
        .join("");
    els.categoryFilter.value = currentVal;
    const catSelect = document.getElementById("categorySelect");
    if (catSelect) {
      const valueEl = catSelect.querySelector(".custom-select-value");
      const content = catSelect.querySelector(".custom-select-content");
      const selected =
        els.categoryFilter.options[els.categoryFilter.selectedIndex];
      if (valueEl) valueEl.textContent = selected?.textContent || "全部分类";
      if (content) {
        content.innerHTML = "";
        Array.from(els.categoryFilter.options).forEach((opt) => {
          const div = document.createElement("div");
          div.className =
            "custom-select-option" + (opt.selected ? " selected" : "");
          div.dataset.value = opt.value;
          div.textContent = opt.textContent;
          content.appendChild(div);
        });
      }
    }
  }

  function showRenameModal(currentName, onConfirm, modalTitle) {
    els.renameModalTitle.textContent =
      modalTitle || (currentName ? "重命名分类" : "新建分类");
    els.renameInput.value = currentName || "";
    els.renameModal.showModal();
    setTimeout(() => els.renameInput.focus(), 100);

    const cleanup = () => {
      els.renameModal.close();
      els.modalConfirm.onclick = null;
      els.modalCancel.onclick = null;
      els.modalClose.onclick = null;
    };
    const handleConfirm = () => {
      const val = els.renameInput.value.trim();
      if (val) {
        onConfirm(val);
        cleanup();
      }
    };
    els.modalConfirm.onclick = handleConfirm;
    els.modalCancel.onclick = cleanup;
    els.modalClose.onclick = cleanup;
    els.renameModal.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter") handleConfirm();
        if (e.key === "Escape") cleanup();
      },
      { once: true },
    );
  }

  async function handleBatchDelete() {
    if (selectedCommentIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedCommentIds.size} 条评论吗？`))
      return;
    for (const id of selectedCommentIds) {
      await storage.moveCommentToTrash(id);
    }
    showToast("已移至回收站");
    selectedCommentIds.clear();
    updateBatchButtons();
    await renderAllComments();
    await refreshBadges();
    await refreshStatsIfVisible();
  }

  let currentView = "all";

  // ── Filter settings ──
  const FILTER_STORAGE_KEY = "xhs_filter_settings";
  const FILTER_DEFS = [
    {
      key: "hideRecommend",
      label: "隐藏推荐内容",
      desc: "隐藏首页推荐信息流内容",
    },
    {
      key: "hideGuessSearch",
      label: "隐藏搜索推荐",
      desc: "搜索框禁止显示推荐关键词、猜你想搜、历史搜索记录",
    },
    {
      key: "hideNotificationDot",
      label: "隐藏通知红点",
      desc: "隐藏导航栏的通知小红点",
    },
    {
      key: "onlyImageNote",
      label: "仅展示图文 (屏蔽视频)",
      desc: "在信息流中隐藏视频笔记，只显示图文笔记",
    },
    {
      key: "hideSearchTabs",
      label: "隐藏搜索标签栏",
      desc: "隐藏搜索结果页面顶部的标签筛选栏",
    },
  ];

  function navigate(view) {
    currentView = view;
    els.navItems.forEach((n) =>
      n.classList.toggle("active", n.dataset.view === view),
    );
    els.views.forEach((v) =>
      v.classList.toggle("active", v.id === "view-" + view),
    );
    els.mainToolbar.classList.toggle("toolbar-hidden", view !== "all");
    if (view === "all") renderAllComments();
    else if (view === "note") renderNoteView();
    else if (view === "category") renderCategoryView();
    else if (view === "stats") renderStats();
    else if (view === "parser") {
      selectedParsedNoteIds.clear();
      renderParserView();
    } else if (view === "filter") {
      renderFilterView();
    } else if (view === "trash") {
      selectedTrashIds.clear();
      renderTrashView();
    }
  }

  function loadFilterSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(FILTER_STORAGE_KEY, (r) => {
          resolve(r[FILTER_STORAGE_KEY] || {});
        });
      } catch {
        resolve({});
      }
    });
  }

  function saveFilterSettings(settings) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [FILTER_STORAGE_KEY]: settings }, resolve);
      } catch {
        resolve();
      }
    });
  }

  async function notifyXhsTabs(settings) {
    try {
      const tabs = await chrome.tabs.query({ url: "*://*.xiaohongshu.com/*" });
      for (const tab of tabs) {
        chrome.tabs
          .sendMessage(tab.id, { type: "FILTER_SETTINGS_CHANGED", settings })
          .catch(() => {});
      }
    } catch (e) {
      console.warn("filter notify:", e);
    }
  }

  async function renderFilterView() {
    const container = document.getElementById("filterToggles");
    if (!container) return;
    const settings = await loadFilterSettings();

    container.innerHTML = FILTER_DEFS.map((f) => {
      const on = settings[f.key] ? " active" : "";
      return `<div class="filter-row">
        <div class="filter-row-info">
          <div class="filter-row-label">${f.label}</div>
          <div class="filter-row-desc">${f.desc}</div>
        </div>
        <button class="filter-toggle${on}" data-key="${f.key}" aria-pressed="${!!settings[f.key]}"></button>
      </div>`;
    }).join("");

    for (const btn of container.querySelectorAll(".filter-toggle")) {
      btn.addEventListener("click", async () => {
        const key = btn.dataset.key;
        const on = btn.classList.toggle("active");
        btn.setAttribute("aria-pressed", on);
        settings[key] = on;
        await saveFilterSettings(settings);
        notifyXhsTabs(settings);
      });
    }
  }

  function getTrashDaysRemaining(deletedAt) {
    if (!deletedAt) return 30;
    const elapsed = Date.now() - deletedAt;
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    const remaining = Math.max(
      0,
      Math.ceil((maxAge - elapsed) / (24 * 60 * 60 * 1000)),
    );
    return remaining;
  }

  function createTrashItemHtml(item) {
    const days = getTrashDaysRemaining(item.deletedAt);
    const daysClass = days <= 3 ? "urgent" : "";
    const deletedDate = item.deletedAt
      ? new Date(item.deletedAt).toLocaleDateString("zh-CN")
      : "";

    let title = "";
    let content = "";
    if (item.type === "comment") {
      title = item.author || "未知作者";
      content = item.content || "";
    } else if (item.type === "category") {
      title = item.name || "未命名分类";
      content = item.color ? `颜色: ${item.color}` : "";
    } else if (item.type === "parsed") {
      title = item.title || "未命名笔记";
      content = item.content || "";
      if (!content && item.images && item.images.length) {
        content = `${item.images.length} 张图片`;
      }
    }

    return `<div class="trash-item" data-trash-id="${escHtml(item.trashId)}" data-type="${item.type}">
      <input type="checkbox" class="trash-item-checkbox w-3.5 h-3.5 accent-rose-500 cursor-pointer" data-trash-id="${escHtml(item.trashId)}" />
      <div class="trash-item-body">
        <div class="trash-item-header">
          <span class="trash-item-type type-${item.type}">${item.typeName}</span>
          <span class="trash-item-title">${escHtml(title)}</span>
        </div>
        <div class="trash-item-content">${escHtml(content)}</div>
        <div class="trash-item-meta">
          <span>删除于 ${deletedDate}</span>
          <span class="trash-item-days ${daysClass}">剩余 ${days} 天</span>
        </div>
      </div>
      <div class="trash-item-actions">
        <button class="trash-action-btn restore-btn" data-action="restore" data-trash-id="${escHtml(item.trashId)}" data-type="${item.type}" title="还原">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </button>
        <button class="trash-action-btn purge-btn" data-action="purge" data-trash-id="${escHtml(item.trashId)}" data-type="${item.type}" title="彻底删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>`;
  }

  function updateTrashBatchButtons() {
    const size = selectedTrashIds.size;
    if (els.btnTrashBatchRestore) {
      els.btnTrashBatchRestore.disabled = size === 0;
      els.btnTrashBatchRestore.textContent =
        size > 0 ? `还原 (${size})` : "批量还原";
    }
    if (els.btnTrashBatchDelete) {
      els.btnTrashBatchDelete.disabled = size === 0;
      els.btnTrashBatchDelete.textContent =
        size > 0 ? `删除 (${size})` : "批量删除";
    }
  }

  async function renderTrashView() {
    const typeFilter = els.trashTypeFilterSelect
      ? els.trashTypeFilterSelect.value
      : "";
    const allItems = await storage.getAllTrashItems();
    const filtered = typeFilter
      ? allItems.filter((item) => item.type === typeFilter)
      : allItems;

    if (els.trashCount) els.trashCount.textContent = `共 ${filtered.length} 条`;
    if (els.trashSelectAll) els.trashSelectAll.checked = false;
    updateTrashBatchButtons();

    if (filtered.length === 0) {
      if (els.trashList) els.trashList.innerHTML = "";
      if (els.trashEmptyState) els.trashEmptyState.classList.add("show");
      return;
    }

    if (els.trashEmptyState) els.trashEmptyState.classList.remove("show");
    if (els.trashList) {
      els.trashList.innerHTML = filtered.map(createTrashItemHtml).join("");
      attachTrashEvents();
    }
  }

  function attachTrashEvents() {
    if (!els.trashList) return;

    els.trashList.querySelectorAll(".trash-item-checkbox").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.trashId;
        const card = cb.closest(".trash-item");
        if (cb.checked) {
          selectedTrashIds.add(id);
          card.classList.add("selected");
        } else {
          selectedTrashIds.delete(id);
          card.classList.remove("selected");
        }
        updateTrashBatchButtons();
      });
    });

    els.trashList.addEventListener("click", async (e) => {
      const restoreBtn = e.target.closest('[data-action="restore"]');
      if (restoreBtn) {
        const id = restoreBtn.dataset.trashId;
        const type = restoreBtn.dataset.type;
        await storage.restoreTrashItem(id, type);
        selectedTrashIds.delete(id);
        await renderTrashView();
        await refreshBadges();
        if (currentView === "all") await renderAllComments();
        else if (currentView === "category") await renderCategoryView();
        else if (currentView === "parser") await renderParserView();
        showToast("已还原");
        return;
      }

      const purgeBtn = e.target.closest('[data-action="purge"]');
      if (purgeBtn) {
        if (!confirm("确定要彻底删除吗？不可恢复。")) return;
        const id = purgeBtn.dataset.trashId;
        const type = purgeBtn.dataset.type;
        await storage.permanentlyDeleteTrashItem(id, type);
        selectedTrashIds.delete(id);
        await renderTrashView();
        await refreshBadges();
        showToast("已彻底删除");
        return;
      }

      const card = e.target.closest(".trash-item");
      if (
        card &&
        !e.target.closest(".trash-action-btn") &&
        !e.target.closest(".trash-item-checkbox")
      ) {
        const cb = card.querySelector(".trash-item-checkbox");
        if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event("change"));
        }
      }
    });
  }

  async function renderParserView() {
    const allNotes = await storage.getSavedNotes();

    const parsedNotes = Object.values(allNotes).filter(
      (n) => n.source === "parsed",
    );
    parsedNotes.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

    if (els.parsedSelectAll) els.parsedSelectAll.checked = false;
    updateParsedBatchButtons();

    els.parsedEmpty.classList.toggle("show", parsedNotes.length === 0);
    els.parsedCount.textContent = `共 ${parsedNotes.length} 条`;

    if (parsedNotes.length === 0) {
      els.parsedList.innerHTML = "";
      return;
    }

    els.parsedList.innerHTML = `<div class="parsed-note-grid">${parsedNotes
      .map((n) => {
        const selected = selectedParsedNoteIds.has(n.id) ? " selected" : "";
        const videoBadge = n.isVideo
          ? '<div class="parsed-note-video-badge">▶</div>'
          : "";
        const cover = n.images?.length
          ? `<img src="${escHtml(n.images[0])}" alt="" referrerpolicy="no-referrer" loading="lazy" />`
          : n.isVideo
            ? `<div class="no-image">🎬</div>`
            : `<div class="no-image">📄</div>`;
        return `<div class="parsed-note-card${selected}" data-note-id="${escHtml(n.id)}">
          <div class="parsed-note-card-cover">
            ${videoBadge}
            ${cover}
            <div class="parsed-note-card-title">${escHtml(n.title || "无标题")}</div>
          </div>
          <button type="button" class="parsed-note-trash-btn" data-action="trash" data-note-id="${escHtml(n.id)}" title="删除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>`;
      })
      .join("")}</div>`;

    els.parsedList.onclick = async (e) => {
      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        e.stopPropagation();
        const noteId = actionBtn.dataset.noteId;
        if (actionBtn.dataset.action === "trash") {
          if (!confirm("确定要删除这条笔记吗？")) return;
          await storage.moveSavedNoteToTrash(noteId);
          showToast("已移至回收站");
          await renderParserView();
          await refreshBadges();
        }
        return;
      }
      if (e.target.closest("[data-stop-propagation]")) return;
      const card = e.target.closest(".parsed-note-card");
      if (!card) return;
      const noteId = card.dataset.noteId;
      if (!noteId) return;
      showSavedNoteDetail(noteId, "parsed", false);
    };
  }

  function updateParsedBatchButtons() {
    const size = selectedParsedNoteIds.size;
    const btn = els.btnParsedBatchDelete;
    if (!btn) return;
    btn.disabled = size === 0;
    btn.innerHTML = `批量删除 (${size})`;
  }

  // 初始化
  async function showCategoryComments(catId, categories) {
    const cat = categories.find((c) => c.id === catId) || { name: "未分类" };
    const comments = await storage.getComments();
    const catComments = Object.values(comments).filter(
      (c) => c.category === catId,
    );
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    els.categoryDetailArea.hidden = false;
    els.categoryDetailTitle.textContent = `${cat.name} - 共 ${catComments.length} 条评论`;
    els.categoryCommentList.innerHTML = catComments
      .sort((a, b) => (b.collectedAt || 0) - (a.collectedAt || 0))
      .map((c) => createCommentCardHtml(c, catMap))
      .join("");
    attachCommentEvents(els.categoryCommentList);

    els.categoryGrid.querySelectorAll(".cat-badge").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === catId);
    });
  }

  function init() {
    try {
      const sidebar = document.getElementById("sidebar");
      const resizer = document.getElementById("sidebarResizer");
      const collapsedWidth = 56;
      const expandedWidth = 224;

      function setSidebarWidth(w) {
        const collapsed = w <= collapsedWidth + 20;
        sidebar.classList.toggle("collapsed", collapsed);
        if (!collapsed) sidebar.style.width = w + "px";
        localStorage.setItem("sidebarWidth", collapsed ? "0" : w);
      }

      let dragging = false,
        startX = 0,
        startW = 0;
      resizer.addEventListener("mousedown", (e) => {
        dragging = true;
        startX = e.clientX;
        startW = sidebar.offsetWidth;
        resizer.classList.add("dragging");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        e.preventDefault();
      });
      document.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const w = Math.min(
          Math.max(startW + (e.clientX - startX), collapsedWidth),
          320,
        );
        setSidebarWidth(w);
      });
      document.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        resizer.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      });

      const saved = localStorage.getItem("sidebarWidth");
      if (saved === "0" || saved === null) {
        sidebar.classList.add("collapsed");
      } else {
        sidebar.style.width = saved + "px";
      }

      // Scroll to top
      const scrollTopBtn = document.getElementById("scrollTopBtn");
      const mainSection = document.querySelector(
        "section.flex-1.overflow-y-auto",
      );
      if (mainSection) {
        mainSection.addEventListener("scroll", () => {
          scrollTopBtn.classList.toggle("visible", mainSection.scrollTop > 200);
        });
        scrollTopBtn.addEventListener("click", () => {
          mainSection.scrollTo({ top: 0, behavior: "smooth" });
        });
      }

      els.navItems.forEach((item) => {
        item.addEventListener("click", () => navigate(item.dataset.view));
      });
      els.searchInput.addEventListener("input", () => {
        renderAllComments();
      });
      els.searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") e.preventDefault();
      });
      els.searchInput.addEventListener("focus", () => {
        els.searchInput.setAttribute("autocomplete", "off");
        els.searchInput.setAttribute("autocorrect", "off");
        els.searchInput.setAttribute("autocapitalize", "off");
        els.searchInput.setAttribute("spellcheck", "false");
        els.searchInput.setAttribute("data-lpignore", "true");
        els.searchInput.setAttribute("data-form-type", "other");
        els.searchInput.setAttribute("data-1p-ignore", "");
      });
      document.addEventListener("click", (e) => {
        if (e.target.closest("input, textarea, select, .custom-select-trigger"))
          return;
        closeAllCustomSelects();
      });
      function closeAllCustomSelects() {
        try {
          document.querySelectorAll(".custom-select.open").forEach((el) => {
            el.classList.remove("open");
            const content = el.querySelector(".custom-select-content");
            if (content) content.hidden = true;
          });
        } catch (_) {}
      }

      function setupCustomSelect(wrapperId, nativeId) {
        const wrapper = document.getElementById(wrapperId);
        const trigger = wrapper.querySelector(".custom-select-trigger");
        const valueEl = wrapper.querySelector(".custom-select-value");
        const content = wrapper.querySelector(".custom-select-content");
        const native = document.getElementById(nativeId);

        function syncOptions() {
          content.innerHTML = "";
          Array.from(native.options).forEach((opt) => {
            const div = document.createElement("div");
            div.className =
              "custom-select-option" + (opt.selected ? " selected" : "");
            div.dataset.value = opt.value;
            div.textContent = opt.textContent;
            content.appendChild(div);
          });
          valueEl.textContent =
            native.options[native.selectedIndex]?.textContent || "";
        }

        syncOptions();

        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          if (content.hidden) {
            closeAllCustomSelects();
            syncOptions();
            content.hidden = false;
            wrapper.classList.add("open");
          } else {
            content.hidden = true;
            wrapper.classList.remove("open");
          }
        });

        content.addEventListener("click", (e) => {
          const opt = e.target.closest(".custom-select-option");
          if (!opt) return;
          e.stopPropagation();
          native.value = opt.dataset.value;
          native.dispatchEvent(new Event("change"));
          syncOptions();
          content.hidden = true;
          wrapper.classList.remove("open");
        });
      }

      setupCustomSelect("categorySelect", "categoryFilter");
      setupCustomSelect("sortSelect", "sortFilter");

      els.categoryFilter.addEventListener("change", () => {
        renderAllComments();
      });
      els.sortFilter.addEventListener("change", () => {
        renderAllComments();
      });

      els.selectAll.addEventListener("change", () => {
        const cards = els.commentList.querySelectorAll(".comment-card");
        cards.forEach((card) => {
          const id = card.dataset.id;
          if (els.selectAll.checked) {
            selectedCommentIds.add(id);
            card.classList.add("selected");
          } else {
            selectedCommentIds.delete(id);
            card.classList.remove("selected");
          }
        });
        updateBatchButtons();
      });

      els.btnBatchDelete.addEventListener("click", handleBatchDelete);

      els.btnAddCategory.addEventListener("click", () => {
        showRenameModal("", async (name) => {
          const colors = [
            "#FF2442",
            "#FF9500",
            "#FFCC00",
            "#34C759",
            "#007AFF",
            "#5856D6",
            "#AF52DE",
            "#FF6B6B",
          ];
          const color = colors[Math.floor(Math.random() * colors.length)];
          await storage.addCategory(name, color);
          await renderCategoryView();
          await refreshCategoryFilter();
          await refreshBadges();
          await refreshStatsIfVisible();
        });
      });

      document.querySelectorAll(".export-card").forEach((card) => {
        card.addEventListener("click", async () => {
          const format = card.dataset.format;
          if (!format) return;
          try {
            let data;
            if (format === "json") data = await storage.exportJSON();
            else if (format === "csv") data = await storage.exportCSV();
            else data = await storage.exportMarkdown();
            const ext = format === "markdown" ? "md" : format;
            let mimeType;
            if (format === "json") {
              mimeType = "application/json";
            } else if (format === "csv") {
              mimeType = "text/csv;charset=utf-8";
            } else {
              mimeType = "text/markdown";
            }
            storage.download(`xhs-backup-${Date.now()}.${ext}`, data, mimeType);
          } catch (err) {
            alert("导出失败: " + err.message);
          }
        });
      });

      document.getElementById("importCard").addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("change", async () => {
          const file = input.files[0];
          if (!file) return;
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!parsed.comments && !parsed.categories && !parsed.savedNotes) {
              alert("无效的备份文件：缺少必要数据");
              return;
            }

            const summary = parsed.summary || {};
            const commentCount = parsed.comments
              ? Object.keys(parsed.comments).length
              : summary.totalComments || 0;
            const categoryCount = parsed.categories
              ? parsed.categories.length
              : summary.totalCategories || 0;
            const parsedCount =
              summary.totalParsedNotes ||
              (parsed.savedNotes
                ? Object.values(parsed.savedNotes).filter(
                    (n) => n.source === "parsed",
                  ).length
                : 0);
            const trashCount =
              summary.totalTrashNotes ||
              (parsed.savedNotesTrash
                ? Object.keys(parsed.savedNotesTrash).length
                : 0);

            if (
              !confirm(
                `确定要导入此备份吗？\n\n当前数据将被覆盖！\n\n` +
                  `评论：${commentCount} 条\n` +
                  `分类：${categoryCount} 个\n` +
                  `图文解析：${parsedCount} 条\n` +
                  `回收站：${trashCount} 条`,
              )
            )
              return;
            await storage.importJSON(text);
            selectedCommentIds.clear();
            selectedParsedNoteIds.clear();
            updateBatchButtons();
            await renderAllComments();
            await refreshCategoryFilter();
            await refreshBadges();
            alert("导入成功！");
          } catch (err) {
            alert("导入失败：" + err.message);
          }
        });
        input.click();
      });

      els.noteDetailBack.addEventListener("click", () => {
        els.noteCommentArea.hidden = true;
        currentNoteText = null;
        els.noteTagGrid
          .querySelectorAll(".note-badge")
          .forEach((el) => el.classList.remove("active"));
      });

      els.categoryDetailBack.addEventListener("click", () => {
        els.categoryDetailArea.hidden = true;
        els.categoryGrid
          .querySelectorAll(".cat-badge")
          .forEach((el) => el.classList.remove("active"));
      });

      els.savedNoteModal.addEventListener("click", (e) => {
        if (e.target === els.savedNoteModal) els.savedNoteModal.close();
      });
      els.savedNoteModalRestore?.addEventListener("click", async () => {
        const { noteId, source } = savedNoteModalState;
        if (!noteId) return;
        await storage.restoreSavedNote(noteId);
        els.savedNoteModal.close();
        showToast("已恢复笔记");
        if (source === "parsed") await renderParserView();
        await refreshBadges();
        await refreshStatsIfVisible();
      });
      els.savedNoteModalPermanentDelete?.addEventListener("click", async () => {
        const { noteId, source } = savedNoteModalState;
        if (!noteId) return;
        if (!confirm("确定要彻底删除这条笔记吗？此操作不可恢复。")) return;
        await storage.permanentlyDeleteSavedNote(noteId);
        els.savedNoteModal.close();
        showToast("已彻底删除");
        if (source === "parsed") await renderParserView();
        await refreshBadges();
        await refreshStatsIfVisible();
      });

      els.btnOpenXHS.addEventListener("click", () =>
        chrome.tabs.create({ url: "https://www.xiaohongshu.com" }),
      );
      if (els.trashSelectAll) {
        els.trashSelectAll.addEventListener("change", async () => {
          const checkboxes = els.trashList.querySelectorAll(
            ".trash-item-checkbox",
          );
          checkboxes.forEach((cb) => {
            const id = cb.dataset.trashId;
            const card = cb.closest(".trash-item");
            if (els.trashSelectAll.checked) {
              selectedTrashIds.add(id);
              cb.checked = true;
              card.classList.add("selected");
            } else {
              selectedTrashIds.delete(id);
              cb.checked = false;
              card.classList.remove("selected");
            }
          });
          updateTrashBatchButtons();
        });
      }
      if (els.btnTrashBatchRestore) {
        els.btnTrashBatchRestore.addEventListener("click", async () => {
          const ids = [...selectedTrashIds];
          if (ids.length === 0) return;
          if (!confirm(`确定要还原选中的 ${ids.length} 条内容吗？`)) return;
          for (const trashId of ids) {
            const item = (await storage.getAllTrashItems()).find(
              (i) => i.trashId === trashId,
            );
            if (item) await storage.restoreTrashItem(trashId, item.type);
          }
          selectedTrashIds.clear();
          await renderTrashView();
          await refreshBadges();
          if (currentView === "all") await renderAllComments();
          else if (currentView === "category") await renderCategoryView();
          else if (currentView === "parser") await renderParserView();
          showToast(`已还原 ${ids.length} 条内容`);
        });
      }
      if (els.btnTrashBatchDelete) {
        els.btnTrashBatchDelete.addEventListener("click", async () => {
          const ids = [...selectedTrashIds];
          if (ids.length === 0) return;
          if (
            !confirm(`确定要彻底删除选中的 ${ids.length} 条内容吗？不可恢复！`)
          )
            return;
          for (const trashId of ids) {
            const item = (await storage.getAllTrashItems()).find(
              (i) => i.trashId === trashId,
            );
            if (item)
              await storage.permanentlyDeleteTrashItem(trashId, item.type);
          }
          selectedTrashIds.clear();
          await renderTrashView();
          await refreshBadges();
          showToast(`已彻底删除 ${ids.length} 条内容`);
        });
      }
      if (els.btnTrashEmptyAll) {
        els.btnTrashEmptyAll.addEventListener("click", async () => {
          const count = await storage.getTrashCount();
          if (count === 0) {
            showToast("回收站已经是空的");
            return;
          }
          if (
            !confirm(
              `确定要清空回收站吗？共 ${count} 条内容将被彻底删除，不可恢复！`,
            )
          )
            return;
          await storage.emptyTrash();
          selectedTrashIds.clear();
          await renderTrashView();
          await refreshBadges();
          showToast("回收站已清空");
        });
      }
      if (els.trashTypeFilterSelect) {
        els.trashTypeFilterSelect.addEventListener("change", async () => {
          selectedTrashIds.clear();
          await renderTrashView();
        });
        const trashTypeSelect = document.getElementById("trashTypeFilter");
        if (trashTypeSelect) {
          const valueEl = trashTypeSelect.querySelector(".custom-select-value");
          const content = trashTypeSelect.querySelector(
            ".custom-select-content",
          );
          if (valueEl && content) {
            content.innerHTML = "";
            const options = [
              { value: "", label: "全部类型" },
              { value: "comment", label: "评论" },
              { value: "category", label: "分类" },
              { value: "parsed", label: "解析笔记" },
            ];
            for (const opt of options) {
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "custom-select-option";
              btn.textContent = opt.label;
              btn.dataset.value = opt.value;
              btn.addEventListener("click", () => {
                els.trashTypeFilterSelect.value = opt.value;
                valueEl.textContent = opt.label;
                content.hidden = true;
                selectedTrashIds.clear();
                renderTrashView();
              });
              content.appendChild(btn);
            }
            trashTypeSelect
              .querySelector(".custom-select-trigger")
              .addEventListener("click", (e) => {
                e.stopPropagation();
                content.hidden = !content.hidden;
              });
          }
        }
      }
      if (els.parsedSelectAll) {
        els.parsedSelectAll.addEventListener("change", () => {
          const cards = els.parsedList.querySelectorAll(
            ".parsed-note-card[data-note-id]",
          );
          cards.forEach((card) => {
            const id = card.dataset.noteId;
            if (els.parsedSelectAll.checked) {
              selectedParsedNoteIds.add(id);
              card.classList.add("selected");
            } else {
              selectedParsedNoteIds.delete(id);
              card.classList.remove("selected");
            }
          });
          updateParsedBatchButtons();
        });
      }
      if (els.btnParsedBatchDelete) {
        els.btnParsedBatchDelete.addEventListener("click", async () => {
          const ids = [...selectedParsedNoteIds];
          if (ids.length === 0) return;
          if (!confirm(`确定要将选中的 ${ids.length} 条笔记移入回收站吗？`))
            return;
          for (const id of ids) {
            await storage.moveSavedNoteToTrash(id);
          }
          selectedParsedNoteIds.clear();
          await renderParserView();
          await refreshBadges();
          await refreshStatsIfVisible();
          showToast(`已将 ${ids.length} 条笔记移入回收站`);
        });
      }

      const importLinkModal = document.getElementById("importLinkModal");
      const importLinkInput = document.getElementById("importLinkInput");
      const importLinkStatus = document.getElementById("importLinkStatus");

      function showImportLinkStatus(msg, isError) {
        importLinkStatus.textContent = msg;
        importLinkStatus.className =
          "text-xs mt-2 " + (isError ? "text-rose-500" : "text-green-600");
        importLinkStatus.classList.remove("hidden");
      }

      async function doImportLink() {
        const raw = importLinkInput.value.trim();
        if (!raw) {
          showImportLinkStatus("请输入链接", true);
          return;
        }

        let fetchUrl = "";
        const m1 = raw.match(/https?:\/\/[^\s"】]+xiaohongshu\.com[^\s"】]*/i);
        const m2 = raw.match(/https?:\/\/xhslink\.com[^\s"】]*/i);
        if (m1) fetchUrl = m1[0];
        else if (m2) fetchUrl = m2[0];
        else if (raw.startsWith("http")) fetchUrl = raw;
        else {
          showImportLinkStatus(
            "无法识别笔记链接，请粘贴完整的小红书链接",
            true,
          );
          return;
        }

        showImportLinkStatus("正在获取笔记数据…", false);
        document.getElementById("importLinkModalConfirm").disabled = true;

        try {
          let noteData = null;
          let source = "parsed";

          try {
            const apiResp = await new Promise((resolve, reject) => {
              let responded = false;
              const timeout = setTimeout(() => {
                if (!responded) {
                  responded = true;
                  reject(new Error("API 请求超时"));
                }
              }, 20000);
              chrome.runtime.sendMessage(
                { type: "FETCH_XHS_API", url: fetchUrl },
                (r) => {
                  if (responded) return;
                  responded = true;
                  clearTimeout(timeout);
                  if (r?.error) reject(new Error(r.error));
                  else if (r?.data) resolve(r.data);
                  else reject(new Error("API 无响应"));
                },
              );
            });

            if (apiResp && apiResp.code === 200 && apiResp.data) {
              const d = apiResp.data;
              const authorName =
                typeof d.author === "object" ? d.author?.name : d.author;
              const mediaUrls = (d.images || d.imgurl || []).filter(Boolean);

              if (mediaUrls.length > 0) {
                noteData = {
                  title: d.title || "无标题",
                  desc: d.desc || "",
                  author: authorName || "未知作者",
                  images: mediaUrls,
                  noteUrl: d.url || fetchUrl,
                  isVideo: d.type === "video",
                };
              }
            }
          } catch (_) {
            showImportLinkStatus("去水印 API 不可用，尝试页面解析…", false);
          }

          if (!noteData) {
            const idMatch = fetchUrl.match(
              /\/(?:explore|discovery\/item)\/([a-z0-9]{20,})/i,
            );
            if (!idMatch) {
              throw new Error("无法识别笔记链接: " + fetchUrl.slice(-40));
            }

            const html = await new Promise((resolve, reject) => {
              chrome.runtime.sendMessage(
                { type: "FETCH_XHS", url: fetchUrl },
                (r) => {
                  if (r?.error) reject(new Error(r.error));
                  else if (r?.html) resolve(r.html);
                  else reject(new Error("请求失败"));
                },
              );
            });

            const stateIdx = html.indexOf("window.__INITIAL_STATE__");
            if (stateIdx === -1)
              throw new Error("页面未返回笔记数据，可能需要登录小红书");

            const jsonStart = html.indexOf("{", stateIdx);
            if (jsonStart === -1) throw new Error("无法解析笔记数据");

            let depth = 0,
              inString = false,
              escape = false,
              jsonEnd = jsonStart;
            for (let i = jsonStart; i < html.length; i++) {
              const ch = html[i];
              if (escape) {
                escape = false;
                continue;
              }
              if (ch === "\\") {
                escape = true;
                continue;
              }
              if (ch === '"') {
                inString = !inString;
                continue;
              }
              if (inString) continue;
              if (ch === "{") depth++;
              if (ch === "}") {
                depth--;
                if (depth === 0) {
                  jsonEnd = i;
                  break;
                }
              }
            }

            const stateStr = html.substring(jsonStart, jsonEnd + 1);
            const cleanState = stateStr
              .replace(/undefined/g, "null")
              .replace(/NaN/g, "null")
              .replace(/:\s*,\s*/g, ":null,");
            const state = JSON.parse(cleanState);
            const noteMap = state?.note?.noteDetailMap;
            if (!noteMap) throw new Error("笔记数据不存在");

            const noteId = idMatch[1];
            let nd = noteMap[noteId]?.note;
            if (!nd) {
              for (const key of Object.keys(noteMap)) {
                if (key.includes(noteId) || noteId.includes(key)) {
                  nd = noteMap[key]?.note;
                  break;
                }
              }
            }
            if (!nd) nd = Object.values(noteMap)[0]?.note;
            if (!nd) throw new Error("笔记数据不存在或已被删除");

            const imageList = nd.imageList || nd.images || [];
            const notePrefix = nd.urlPrefix || "";
            const images = imageList
              .map((img) => {
                const u =
                  img.urlDefault ||
                  img.originalSrc ||
                  img.original ||
                  img.url ||
                  img.image ||
                  "";
                if (u) return u;
                if (img.infoList?.length) {
                  const best = img.infoList.reduce((a, b) =>
                    (b.width || 0) > (a.width || 0) ? b : a,
                  );
                  return best.urlDefault || best.url || best.image || "";
                }
                if (img.fileId && notePrefix) return notePrefix + img.fileId;
                return "";
              })
              .filter(Boolean);

            const isVideo = nd.type === "video" || !!nd.video;
            let videoCover = [];
            if (isVideo && nd.video) {
              const coverUrl =
                nd.video.cover?.url ||
                nd.video.coverUrl ||
                nd.video.thumbUrl ||
                "";
              if (coverUrl) videoCover = [coverUrl];
            }

            noteData = {
              title: nd.title || "无标题",
              desc: nd.desc || "",
              author: nd.user?.nickname || "未知作者",
              images: images.length > 0 ? images : videoCover,
              noteUrl: fetchUrl,
              isVideo,
            };
          }

          if (
            !noteData.isVideo &&
            (!noteData.images || noteData.images.length === 0)
          ) {
            throw new Error("未获取到图片");
          }

          const data = {
            id:
              "parsed_" +
              Date.now() +
              "_" +
              Math.random().toString(36).slice(2, 8),
            title: noteData.title || "无标题",
            content: noteData.desc || "",
            author: noteData.author || "未知作者",
            images: noteData.images,
            url: noteData.noteUrl || fetchUrl,
            source,
            isVideo: !!noteData.isVideo,
          };

          await storage.addSavedNote(data);
          importLinkModal.close();
          const typeLabel = noteData.isVideo ? "视频" : "图片";
          showToast(
            `导入成功：${data.title}（${noteData.images.length} 个${typeLabel}）`,
          );
          await refreshBadges();
          importLinkInput.value = "";
          navigate("parser");
        } catch (e) {
          showImportLinkStatus("导入失败：" + e.message, true);
        }
        document.getElementById("importLinkModalConfirm").disabled = false;
      }

      document.getElementById("btnImportLink").addEventListener("click", () => {
        importLinkInput.value = "";
        importLinkStatus.classList.add("hidden");
        importLinkModal.showModal();
        setTimeout(() => importLinkInput.focus(), 100);
      });
      document
        .getElementById("importLinkModalConfirm")
        .addEventListener("click", doImportLink);
      document
        .getElementById("importLinkModalCancel")
        .addEventListener("click", () => importLinkModal.close());
      document
        .getElementById("importLinkModalClose")
        .addEventListener("click", () => importLinkModal.close());
      importLinkModal.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doImportLink();
      });

      refreshCategoryFilter();
      refreshBadges();
      storage.cleanExpiredTrash();
      navigate("all");

      const backupToast = document.getElementById("backupReminderToast");
      const backupReminderClose = document.getElementById(
        "backupReminderClose",
      );
      if (backupToast) {
        setTimeout(() => backupToast.classList.add("show"), 500);
        const closeReminder = () => backupToast.classList.remove("show");
        backupReminderClose.addEventListener("click", closeReminder);
        setTimeout(() => backupToast.classList.remove("show"), 8000);
      }

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (
          changes.xhs_comments ||
          changes.xhs_categories ||
          changes.xhs_saved_notes ||
          changes.xhs_saved_notes_trash ||
          changes.xhs_comments_trash ||
          changes.xhs_categories_trash
        ) {
          refreshBadges();
          refreshCategoryFilter();
          if (currentView === "all") renderAllComments();
          else if (currentView === "note") renderNoteView();
          else if (currentView === "category") renderCategoryView();
          else if (currentView === "parser") renderParserView();
          else if (currentView === "stats") renderStats();
          else if (currentView === "trash") renderTrashView();
        }
      });

      try {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg.type === "REFRESH") {
            refreshBadges();
            refreshCategoryFilter();
            if (currentView === "all") renderAllComments();
            else if (currentView === "note") renderNoteView();
            else if (currentView === "category") renderCategoryView();
            else if (currentView === "parser") renderParserView();
            else if (currentView === "stats") renderStats();
            else if (currentView === "trash") renderTrashView();
          }
        });
      } catch {}
    } catch (e) {
      console.warn("Init error:", e);
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  // Initialize auth and bind events
  initAuth();
  bindAuthEvents();
})();
