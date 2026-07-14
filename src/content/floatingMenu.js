(() => {
  const MENU_ID = "xhs-collector-menu";
  const OVERLAY_ID = "xhs-collector-overlay";

  class FloatingMenu {
    constructor() {
      this.menuEl = null;
      this.overlayEl = null;
      this.currentCommentId = null;
      this.currentCommentData = null;
      this.currentBtn = null;
      this.isVisible = false;
    }

    async show(commentData, position, btnEl) {
      if (!globalThis.CommentStorage.isReady()) {
        this._showToast("扩展已更新，请刷新页面");
        return;
      }

      this.currentCommentId = commentData.id;
      this.currentCommentData = commentData;
      this.currentBtn = btnEl || null;
      this._ensureElements();
      await this._render();
      this._position(position);
      this.isVisible = true;
    }

    hide() {
      if (this.menuEl) this.menuEl.classList.remove("active");
      if (this.overlayEl) this.overlayEl.classList.remove("active");
      this.isVisible = false;
      this.currentCommentId = null;
      this.currentCommentData = null;
      this.currentBtn = null;
    }

    _ensureElements() {
      if (!this.overlayEl) {
        this.overlayEl = document.createElement("div");
        this.overlayEl.id = OVERLAY_ID;
        document.body.appendChild(this.overlayEl);
        this.overlayEl.addEventListener("click", () => this.hide());
      }
      if (!this.menuEl) {
        this.menuEl = document.createElement("div");
        this.menuEl.id = MENU_ID;
        document.body.appendChild(this.menuEl);
      }
    }

    async _render() {
      const categories = await globalThis.CommentStorage.getCategories();
      const isCollected = await globalThis.CommentStorage.isCollected(
        this.currentCommentId,
      );
      const comment = await globalThis.CommentStorage.getComment(
        this.currentCommentId,
      );

      let html = `<div class="xhs-menu-header">
        <span class="xhs-menu-title">收藏到分类</span>
        <button class="xhs-menu-close">&times;</button>
      </div>
      <div class="xhs-menu-body">`;

      for (const cat of categories) {
        const active = comment && comment.category === cat.id ? " active" : "";
        const check = comment && comment.category === cat.id ? " ✓" : "";
        html += `<div class="xhs-menu-item${active}" data-cat-id="${cat.id}">
          <span class="xhs-menu-dot" style="background:${cat.color}"></span>
          <span class="xhs-menu-label">${cat.name}${check}</span>
        </div>`;
      }

      html += `</div>
      <div class="xhs-menu-footer">
        <div class="xhs-menu-new-cat">
          <input type="text" class="xhs-menu-input" placeholder="新建分类..." maxlength="20" />
          <button class="xhs-menu-add-btn">+</button>
        </div>
        ${isCollected ? '<button class="xhs-menu-remove-btn">移除收藏</button>' : ""}
      </div>`;

      this.menuEl.innerHTML = html;
      this.menuEl.classList.add("active");
      this.overlayEl.classList.add("active");

      this.menuEl
        .querySelector(".xhs-menu-close")
        .addEventListener("click", () => this.hide());

      for (const item of this.menuEl.querySelectorAll(".xhs-menu-item")) {
        item.addEventListener("click", async () => {
          if (!globalThis.CommentStorage.isReady()) {
            this._showToast("扩展已更新，请刷新页面");
            return;
          }
          const catId = item.dataset.catId;
          await globalThis.CommentStorage.addComment({
            ...this.currentCommentData,
            category: catId,
          });
          this._showToast(
            `已收藏到 "${item.querySelector(".xhs-menu-label").textContent.trim()}"`,
          );
          this._updateCollectBtn(true);
          this.hide();
          globalThis.dispatchEvent(new CustomEvent("xhs-collector-update"));
          try {
            chrome.runtime.sendMessage({ type: "COMMENT_SAVED" });
          } catch {}
        });
      }

      const addBtn = this.menuEl.querySelector(".xhs-menu-add-btn");
      const input = this.menuEl.querySelector(".xhs-menu-input");
      addBtn.addEventListener("click", async () => {
        if (!globalThis.CommentStorage.isReady()) {
          this._showToast("扩展已更新，请刷新页面");
          return;
        }
        const name = input.value.trim();
        if (name) {
          const newCat = await globalThis.CommentStorage.addCategory(name);
          await globalThis.CommentStorage.addComment({
            ...this.currentCommentData,
            category: newCat.id,
          });
          this._showToast(`已创建分类并收藏到 "${name}"`);
          this._updateCollectBtn(true);
          this.hide();
          globalThis.dispatchEvent(new CustomEvent("xhs-collector-update"));
          try {
            chrome.runtime.sendMessage({ type: "COMMENT_SAVED" });
          } catch {}
        }
      });
      input.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") addBtn.click();
      });

      const removeBtn = this.menuEl.querySelector(".xhs-menu-remove-btn");
      if (removeBtn) {
        removeBtn.addEventListener("click", async () => {
          if (!globalThis.CommentStorage.isReady()) {
            this._showToast("扩展已更新，请刷新页面");
            return;
          }
          await globalThis.CommentStorage.removeComment(this.currentCommentId);
          this._showToast("已移除收藏");
          this._updateCollectBtn(false);
          this.hide();
          globalThis.dispatchEvent(new CustomEvent("xhs-collector-update"));
        });
      }
    }

    _updateCollectBtn(collected) {
      const btn = this.currentBtn;
      if (btn) {
        btn.classList.toggle("collected", collected);
        return;
      }
      const id = this.currentCommentData?.id || this.currentCommentId;
      if (!id) return;
      const selector = `.xhs-collect-btn[data-comment-id="${id}"]`;
      const btn2 = document.querySelector(selector);
      if (btn2) btn2.classList.toggle("collected", collected);
    }

    _position(position) {
      if (!this.menuEl) return;
      const menuWidth = 260;
      const menuHeight = this.menuEl.offsetHeight || 320;
      let left = position.x;
      let top = position.y;

      if (left + menuWidth > window.innerWidth - 20) {
        left = window.innerWidth - menuWidth - 20;
      }
      if (left < 10) left = 10;
      if (top + menuHeight > window.innerHeight - 20) {
        top = window.innerHeight - menuHeight - 20;
      }
      if (top < 10) top = 10;

      this.menuEl.style.left = left + "px";
      this.menuEl.style.top = top + "px";
    }

    _showToast(msg) {
      let toast = document.getElementById("xhs-collector-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "xhs-collector-toast";
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.classList.add("active");
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(
        () => toast.classList.remove("active"),
        2000,
      );
    }
  }

  globalThis.FloatingMenu = new FloatingMenu();
})();
