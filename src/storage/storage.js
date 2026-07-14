(() => {
  const DEFAULT_CATEGORIES = [
    {
      id: "default",
      name: "默认收藏",
      color: "#ff2d55",
      createdAt: Date.now(),
    },
    {
      id: "inspiration",
      name: "创作灵感",
      color: "#ff9500",
      createdAt: Date.now() + 1,
    },
    {
      id: "learning",
      name: "职场学习",
      color: "#704da9",
      createdAt: Date.now() + 2,
    },
    {
      id: "coding",
      name: "IT编程",
      color: "#007aff",
      createdAt: Date.now() + 2,
    },
    {
      id: "life",
      name: "生活风景",
      color: "#057748",
      createdAt: Date.now() + 2,
    },
  ];

  const STORAGE_KEYS = {
    COMMENTS: "xhs_comments",
    CATEGORIES: "xhs_categories",
    SETTINGS: "xhs_settings",
    NOTES: "xhs_notes",
    SAVED_NOTES: "xhs_saved_notes",
    SAVED_NOTES_TRASH: "xhs_saved_notes_trash",
    COMMENTS_TRASH: "xhs_comments_trash",
    NOTES_TRASH: "xhs_notes_trash",
    CATEGORIES_TRASH: "xhs_categories_trash",
  };

  const RETRY_MAX = 3;
  const RETRY_DELAY = 300;

  class CommentStorage {
    constructor() {
      this._ready = false;
      this._invalidated = false;
    }

    async init() {
      this._ready = true;
    }

    isReady() {
      return this._ready && !!(chrome.runtime && chrome.runtime.id);
    }

    async _waitForContext(retries = RETRY_MAX) {
      for (let i = 0; i < retries; i++) {
        if (chrome.runtime && chrome.runtime.id) {
          this._invalidated = false;
          return true;
        }
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY * (i + 1)));
        }
      }
      this._invalidated = true;
      return false;
    }

    async _storageGet(key) {
      if (!(await this._waitForContext())) return {};
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get(key, (result) => {
            if (chrome.runtime.lastError) {
              resolve({});
              return;
            }
            resolve(result || {});
          });
        } catch {
          resolve({});
        }
      });
    }

    async _storageSet(data) {
      if (!(await this._waitForContext())) return;
      return new Promise((resolve) => {
        try {
          chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
              console.warn(
                "storage set error:",
                chrome.runtime.lastError.message,
              );
            }
            resolve();
          });
        } catch {
          resolve();
        }
      });
    }

    async getComments() {
      const result = await this._storageGet(STORAGE_KEYS.COMMENTS);
      return result[STORAGE_KEYS.COMMENTS] || {};
    }

    async setComments(comments) {
      await this._storageSet({ [STORAGE_KEYS.COMMENTS]: comments });
    }

    async getCategories() {
      const result = await this._storageGet(STORAGE_KEYS.CATEGORIES);
      const categories = result[STORAGE_KEYS.CATEGORIES];
      if (!categories || categories.length === 0) {
        if (this.isReady()) {
          await this.setCategories(DEFAULT_CATEGORIES);
        }
        return DEFAULT_CATEGORIES;
      }
      return categories;
    }

    async setCategories(categories) {
      await this._storageSet({ [STORAGE_KEYS.CATEGORIES]: categories });
    }

    async getSettings() {
      const result = await this._storageGet(STORAGE_KEYS.SETTINGS);
      return result[STORAGE_KEYS.SETTINGS] || { defaultCategory: "default" };
    }

    async setSettings(settings) {
      await this._storageSet({ [STORAGE_KEYS.SETTINGS]: settings });
    }

    async getNotes() {
      const result = await this._storageGet(STORAGE_KEYS.NOTES);
      return result[STORAGE_KEYS.NOTES] || {};
    }

    async setNotes(notes) {
      await this._storageSet({ [STORAGE_KEYS.NOTES]: notes });
    }

    async addComment(comment) {
      const comments = await this.getComments();
      if (comments[comment.id]) {
        const existing = comments[comment.id];
        if (existing.category === comment.category) return false;
        comments[comment.id] = {
          ...existing,
          ...comment,
          collectedAt: Date.now(),
        };
        await this.setComments(comments);
        return false;
      }
      comments[comment.id] = {
        ...comment,
        collectedAt: Date.now(),
        pinned: false,
        tags: [],
      };
      await this.setComments(comments);
      this.syncAfterChange();
      await this._updateNoteInfo(comment);
      return true;
    }

    async putComment(commentId, commentData) {
      const comments = await this.getComments();
      if (comments[commentId]) {
        comments[commentId] = commentData;
        await this.setComments(comments);
      }
    }

    async _updateNoteInfo(comment) {
      if (!comment.noteId) return;
      const notes = await this.getNotes();
      if (!notes[comment.noteId]) {
        notes[comment.noteId] = {
          title: comment.noteTitle || "",
          url: comment.noteUrl || "",
          firstCollectedAt: Date.now(),
        };
      }
      await this.setNotes(notes);
    }

    async removeComment(commentId) {
      const comments = await this.getComments();
      delete comments[commentId];
      await this.setComments(comments);
      this.syncAfterChange();
    }

    async moveCommentToTrash(commentId) {
      const comments = await this.getComments();
      const comment = comments[commentId];
      if (!comment) return;
      const trash = await this.getCommentsTrash();
      trash[commentId] = { ...comment, deletedAt: Date.now() };
      delete comments[commentId];
      await this.setComments(comments);
      await this.setCommentsTrash(trash);
      this.syncAfterChange();
    }

    async getCommentsTrash() {
      const result = await this._storageGet(STORAGE_KEYS.COMMENTS_TRASH);
      return result[STORAGE_KEYS.COMMENTS_TRASH] || {};
    }

    async setCommentsTrash(trash) {
      await this._storageSet({ [STORAGE_KEYS.COMMENTS_TRASH]: trash });
    }

    async restoreComment(commentId) {
      const trash = await this.getCommentsTrash();
      const comment = trash[commentId];
      if (!comment) return;
      const comments = await this.getComments();
      delete comment.deletedAt;
      comments[commentId] = comment;
      delete trash[commentId];
      await this.setComments(comments);
      await this.setCommentsTrash(trash);
      this.syncAfterChange();
    }

    async permanentlyDeleteComment(commentId) {
      const trash = await this.getCommentsTrash();
      delete trash[commentId];
      await this.setCommentsTrash(trash);
    }

    async batchRemove(commentIds) {
      const comments = await this.getComments();
      for (const id of commentIds) delete comments[id];
      await this.setComments(comments);
      this.syncAfterChange();
    }

    async batchMoveCategory(commentIds, newCategoryId) {
      const comments = await this.getComments();
      for (const id of commentIds) {
        if (comments[id]) comments[id].category = newCategoryId;
      }
      await this.setComments(comments);
    }

    async togglePin(commentId) {
      const comments = await this.getComments();
      if (comments[commentId]) {
        comments[commentId].pinned = !comments[commentId].pinned;
        await this.setComments(comments);
        return comments[commentId].pinned;
      }
      return false;
    }

    async setNote(commentId, note) {
      const comments = await this.getComments();
      if (comments[commentId]) {
        comments[commentId].note = note;
        await this.setComments(comments);
      }
    }

    async setTitle(commentId, title) {
      const comments = await this.getComments();
      if (comments[commentId]) {
        comments[commentId].title = title;
        await this.setComments(comments);
      }
    }

    async moveCategory(commentId, categoryId) {
      const comments = await this.getComments();
      if (comments[commentId]) {
        comments[commentId].category = categoryId;
        await this.setComments(comments);
      }
    }

    async addCategory(name, color) {
      const categories = await this.getCategories();
      const id =
        "cat_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      const newCat = {
        id,
        name,
        color:
          color ||
          "#" +
            Math.floor(Math.random() * 0xffffff)
              .toString(16)
              .padStart(6, "0"),
        createdAt: Date.now(),
      };
      categories.push(newCat);
      await this.setCategories(categories);
      return newCat;
    }

    async renameCategory(categoryId, newName) {
      const categories = await this.getCategories();
      const cat = categories.find((c) => c.id === categoryId);
      if (cat) {
        cat.name = newName;
        await this.setCategories(categories);
      }
    }

    async removeCategory(categoryId) {
      const categories = await this.getCategories();
      const filtered = categories.filter((c) => c.id !== categoryId);
      await this.setCategories(filtered);
      const comments = await this.getComments();
      for (const id of Object.keys(comments)) {
        if (comments[id].category === categoryId)
          comments[id].category = "default";
      }
      await this.setComments(comments);
    }

    async moveCategoryToTrash(categoryId) {
      const categories = await this.getCategories();
      const catIndex = categories.findIndex((c) => c.id === categoryId);
      if (catIndex === -1) return;
      const cat = categories[catIndex];
      const trash = await this.getCategoriesTrash();
      trash[categoryId] = { ...cat, deletedAt: Date.now() };
      categories.splice(catIndex, 1);
      await this.setCategories(categories);
      await this.setCategoriesTrash(trash);
      const comments = await this.getComments();
      for (const id of Object.keys(comments)) {
        if (comments[id].category === categoryId)
          comments[id].category = "default";
      }
      await this.setComments(comments);
      this.syncAfterChange();
    }

    async getCategoriesTrash() {
      const result = await this._storageGet(STORAGE_KEYS.CATEGORIES_TRASH);
      return result[STORAGE_KEYS.CATEGORIES_TRASH] || {};
    }

    async setCategoriesTrash(trash) {
      await this._storageSet({ [STORAGE_KEYS.CATEGORIES_TRASH]: trash });
    }

    async restoreCategory(categoryId) {
      const trash = await this.getCategoriesTrash();
      const cat = trash[categoryId];
      if (!cat) return;
      const categories = await this.getCategories();
      delete cat.deletedAt;
      categories.push(cat);
      await this.setCategories(categories);
      delete trash[categoryId];
      await this.setCategoriesTrash(trash);
      this.syncAfterChange();
    }

    async permanentlyDeleteCategory(categoryId) {
      const trash = await this.getCategoriesTrash();
      delete trash[categoryId];
      await this.setCategoriesTrash(trash);
    }

    async searchComments(query, categoryId) {
      const comments = await this.getComments();
      let list = Object.values(comments);
      if (categoryId) list = list.filter((c) => c.category === categoryId);
      if (query) {
        const q = query.toLowerCase();
        list = list.filter(
          (c) =>
            (c.content && c.content.toLowerCase().includes(q)) ||
            (c.author && c.author.toLowerCase().includes(q)) ||
            (c.noteTitle && c.noteTitle.toLowerCase().includes(q)),
        );
      }
      return list.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.collectedAt || 0) - (a.collectedAt || 0);
      });
    }

    async getStats() {
      const comments = await this.getComments();
      const categories = await this.getCategories();
      const savedNotes = await this.getSavedNotes();
      const commentList = Object.values(comments);
      const categoryCounts = {};
      for (const cat of categories) categoryCounts[cat.id] = 0;
      for (const c of commentList) {
        categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
      }
      const noteIds = new Set(commentList.map((c) => c.noteId).filter(Boolean));
      const parsedNotes = Object.values(savedNotes).filter((n) => n.source === "parsed");
      return {
        totalComments: commentList.length,
        totalNotes: noteIds.size,
        totalCategories: categories.length,
        categoryCounts,
        totalPinned: commentList.filter((c) => c.pinned).length,
        totalParsedNotes: parsedNotes.length,
        totalParsedImages: parsedNotes.reduce((sum, n) => sum + (n.images?.length || 0), 0),
        lastCollectedAt:
          commentList.length > 0
            ? Math.max(...commentList.map((c) => c.collectedAt || 0))
            : null,
      };
    }

    async exportJSON() {
      const comments = await this.getComments();
      const categories = await this.getCategories();
      const notes = await this.getNotes();
      const savedNotes = await this.getSavedNotes();
      const savedNotesTrash = await this.getSavedNotesTrash();
      const commentsTrash = await this.getCommentsTrash();
      const categoriesTrash = await this.getCategoriesTrash();
      const settings = await this.getSettings();

      const likeNotes = Object.values(savedNotes).filter(
        (n) => n.source === "like",
      );
      const bookmarkNotes = Object.values(savedNotes).filter(
        (n) => n.source === "bookmark",
      );
      const parsedNotes = Object.values(savedNotes).filter(
        (n) => n.source === "parsed",
      );

      return JSON.stringify(
        {
          exportTime: new Date().toISOString(),
          version: "2.1.0",
          summary: {
            totalComments: Object.keys(comments).length,
            totalCategories: categories.length,
            totalNotes: Object.keys(notes).length,
            totalLikeNotes: likeNotes.length,
            totalBookmarkNotes: bookmarkNotes.length,
            totalParsedNotes: parsedNotes.length,
            totalTrashNotes: Object.keys(savedNotesTrash).length,
          },
          settings,
          categories,
          comments,
          notes,
          savedNotes,
          savedNotesTrash,
          commentsTrash,
          categoriesTrash,
        },
        null,
        2,
      );
    }

    async exportCSV() {
      const comments = await this.getComments();
      const categories = await this.getCategories();
      const catMap = {};
      for (const c of categories) catMap[c.id] = c.name;
      const rows = [
        [
          "评论ID",
          "内容",
          "作者",
          "笔记标题",
          "笔记ID",
          "分类",
          "收藏时间",
          "点赞数",
          "置顶",
          "标签",
        ].join(","),
      ];
      for (const c of Object.values(comments)) {
        const escapedContent = (c.content || "").replace(/"/g, '""');
        const escapedNoteTitle = (c.noteTitle || "").replace(/"/g, '""');
        const escapedAuthor = (c.author || "").replace(/"/g, '""');
        rows.push(
          [
            c.id,
            `"${escapedContent}"`,
            `"${escapedAuthor}"`,
            `"${escapedNoteTitle}"`,
            c.noteId || "",
            catMap[c.category] || "未分类",
            c.collectedAt
              ? new Date(c.collectedAt).toLocaleString("zh-CN")
              : "",
            c.likes || 0,
            c.pinned ? "是" : "否",
            (c.tags || []).join(";"),
          ].join(","),
        );
      }
      return rows.join("\n");
    }

    async exportMarkdown() {
      const comments = await this.getComments();
      const categories = await this.getCategories();
      const catMap = {};
      for (const c of categories) catMap[c.id] = c.name;
      const commentsByCategory = {};
      for (const c of Object.values(comments)) {
        const catName = catMap[c.category] || "未分类";
        if (!commentsByCategory[catName]) commentsByCategory[catName] = [];
        commentsByCategory[catName].push(c);
      }
      let md = `# 小红书评论收藏导出\n\n导出时间：${new Date().toLocaleString("zh-CN")}\n\n---\n\n`;
      for (const [catName, items] of Object.entries(commentsByCategory)) {
        md += `## ${catName} (${items.length}条)\n\n`;
        const sorted = items.sort(
          (a, b) => (b.collectedAt || 0) - (a.collectedAt || 0),
        );
        for (const c of sorted) {
          const pinned = c.pinned ? " 📌" : "";
          md += `### ${c.author}${pinned}\n`;
          md += `> ${c.content}\n\n`;
          md += `- **时间**：${c.collectedAt ? new Date(c.collectedAt).toLocaleString("zh-CN") : ""}\n`;
          md += `- **笔记**：[${c.noteTitle || "查看笔记"}](${c.noteUrl || "#"})\n`;
          if (c.likes) md += `- **点赞**：${c.likes}\n`;
          if (c.tags && c.tags.length)
            md += `- **标签**：${c.tags.join(", ")}\n`;
          md += "\n";
        }
      }
      return md;
    }

    async importJSON(jsonStr) {
      const data = JSON.parse(jsonStr);
      if (!data || typeof data !== "object") throw new Error("无效的备份文件");
      if (data.comments && typeof data.comments !== "object")
        throw new Error("备份文件中评论数据格式无效");
      if (data.categories && !Array.isArray(data.categories))
        throw new Error("备份文件中分类数据格式无效");
      if (data.savedNotes && typeof data.savedNotes !== "object")
        throw new Error("备份文件中收藏笔记数据格式无效");
      if (data.savedNotesTrash && typeof data.savedNotesTrash !== "object")
        throw new Error("备份文件中回收站数据格式无效");

      if (data.settings) await this.setSettings(data.settings);
      if (data.comments) await this.setComments(data.comments);
      if (data.categories) await this.setCategories(data.categories);
      if (data.notes) await this.setNotes(data.notes);
      if (data.savedNotes) await this.setSavedNotes(data.savedNotes);
      if (data.savedNotesTrash)
        await this.setSavedNotesTrash(data.savedNotesTrash);
      if (data.commentsTrash) await this.setCommentsTrash(data.commentsTrash);
      if (data.categoriesTrash)
        await this.setCategoriesTrash(data.categoriesTrash);
    }

    async download(filename, content, mimeType) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    async isCollected(commentId) {
      const comments = await this.getComments();
      return !!comments[commentId];
    }

    async getComment(commentId) {
      const comments = await this.getComments();
      return comments[commentId] || null;
    }

    async getSavedNotes() {
      const result = await this._storageGet(STORAGE_KEYS.SAVED_NOTES);
      return result[STORAGE_KEYS.SAVED_NOTES] || {};
    }

    async setSavedNotes(notes) {
      await this._storageSet({ [STORAGE_KEYS.SAVED_NOTES]: notes });
    }

    async getSavedNotesTrash() {
      const result = await this._storageGet(STORAGE_KEYS.SAVED_NOTES_TRASH);
      return result[STORAGE_KEYS.SAVED_NOTES_TRASH] || {};
    }
    async setSavedNotesTrash(trash) {
      await this._storageSet({ [STORAGE_KEYS.SAVED_NOTES_TRASH]: trash });
    }

    async addSavedNote(note) {
      const notes = await this.getSavedNotes();
      const trash = await this.getSavedNotesTrash();
      if (trash[note.id]) {
        delete trash[note.id];
        await this.setSavedNotesTrash(trash);
      }
      if (notes[note.id]) {
        const existing = notes[note.id];
        notes[note.id] = {
          ...existing,
          ...note,
          title: note.title || existing.title,
          content:
            (note.content?.length || 0) >= (existing.content?.length || 0)
              ? note.content
              : existing.content,
          images:
            (note.images?.length || 0) >= (existing.images?.length || 0)
              ? note.images
              : existing.images,
          url: note.url || existing.url,
          author: note.author || existing.author,
          savedAt: existing.savedAt || Date.now(),
        };
        await this.setSavedNotes(notes);
        return "updated";
      }
      notes[note.id] = {
        ...note,
        savedAt: Date.now(),
      };
      await this.setSavedNotes(notes);
      return "new";
    }

    async removeSavedNote(noteId) {
      const notes = await this.getSavedNotes();
      delete notes[noteId];
      await this.setSavedNotes(notes);
    }

    async batchRemoveSavedNotes(noteIds) {
      const notes = await this.getSavedNotes();
      for (const id of noteIds) {
        delete notes[id];
      }
      await this.setSavedNotes(notes);
    }

    async moveSavedNoteToTrash(noteId) {
      const notes = await this.getSavedNotes();
      const note = notes[noteId];
      if (!note) return false;
      const trash = await this.getSavedNotesTrash();
      trash[noteId] = { ...note, deletedAt: Date.now() };
      delete notes[noteId];
      await this.setSavedNotes(notes);
      await this.setSavedNotesTrash(trash);
      return true;
    }

    async restoreSavedNote(noteId) {
      const trash = await this.getSavedNotesTrash();
      const note = trash[noteId];
      if (!note) return false;
      const notes = await this.getSavedNotes();
      const { deletedAt, ...rest } = note;
      notes[noteId] = rest;
      delete trash[noteId];
      await this.setSavedNotes(notes);
      await this.setSavedNotesTrash(trash);
      return true;
    }

    async permanentlyDeleteSavedNote(noteId) {
      const trash = await this.getSavedNotesTrash();
      if (!trash[noteId]) return false;
      delete trash[noteId];
      await this.setSavedNotesTrash(trash);
      return true;
    }

    async getSavedNote(noteId) {
      const notes = await this.getSavedNotes();
      if (notes[noteId]) return notes[noteId];
      const trash = await this.getSavedNotesTrash();
      return trash[noteId] || null;
    }

    async getSavedNotesBySource(source) {
      const notes = await this.getSavedNotes();
      return Object.values(notes).filter((n) => n.source === source);
    }

    async getTrashNotesBySource(source) {
      const trash = await this.getSavedNotesTrash();
      return Object.values(trash).filter((n) => n.source === source);
    }

    async getAllTrashItems() {
      const commentsTrash = await this.getCommentsTrash();
      const categoriesTrash = await this.getCategoriesTrash();
      const notesTrash = await this.getSavedNotesTrash();

      const items = [];

      for (const [id, item] of Object.entries(commentsTrash)) {
        items.push({
          ...item,
          trashId: id,
          type: "comment",
          typeName: "评论",
          deletedAt: item.deletedAt || 0,
        });
      }

      for (const [id, item] of Object.entries(categoriesTrash)) {
        items.push({
          ...item,
          trashId: id,
          type: "category",
          typeName: "分类",
          deletedAt: item.deletedAt || 0,
        });
      }

      for (const [id, item] of Object.entries(notesTrash)) {
        items.push({
          ...item,
          trashId: id,
          type: "parsed",
          typeName: "笔记",
          deletedAt: item.deletedAt || 0,
        });
      }

      items.sort((a, b) => b.deletedAt - a.deletedAt);
      return items;
    }

    async getTrashCount() {
      const commentsTrash = await this.getCommentsTrash();
      const categoriesTrash = await this.getCategoriesTrash();
      const notesTrash = await this.getSavedNotesTrash();
      return (
        Object.keys(commentsTrash).length +
        Object.keys(categoriesTrash).length +
        Object.keys(notesTrash).length
      );
    }

    async cleanExpiredTrash(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
      const now = Date.now();
      let changed = false;

      const commentsTrash = await this.getCommentsTrash();
      for (const [id, item] of Object.entries(commentsTrash)) {
        if (item.deletedAt && now - item.deletedAt > maxAgeMs) {
          delete commentsTrash[id];
          changed = true;
        }
      }
      if (changed) await this.setCommentsTrash(commentsTrash);

      const categoriesTrash = await this.getCategoriesTrash();
      for (const [id, item] of Object.entries(categoriesTrash)) {
        if (item.deletedAt && now - item.deletedAt > maxAgeMs) {
          delete categoriesTrash[id];
          changed = true;
        }
      }
      if (changed) await this.setCategoriesTrash(categoriesTrash);

      const notesTrash = await this.getSavedNotesTrash();
      for (const [id, item] of Object.entries(notesTrash)) {
        if (item.deletedAt && now - item.deletedAt > maxAgeMs) {
          delete notesTrash[id];
          changed = true;
        }
      }
      if (changed) await this.setSavedNotesTrash(notesTrash);

      return changed;
    }

    async restoreTrashItem(trashId, type) {
      if (type === "comment") {
        await this.restoreComment(trashId);
      } else if (type === "category") {
        await this.restoreCategory(trashId);
      } else if (type === "parsed") {
        await this.restoreSavedNote(trashId);
      }
    }

    async permanentlyDeleteTrashItem(trashId, type) {
      if (type === "comment") {
        await this.permanentlyDeleteComment(trashId);
      } else if (type === "category") {
        await this.permanentlyDeleteCategory(trashId);
      } else if (type === "parsed") {
        await this.permanentlyDeleteSavedNote(trashId);
      }
    }

    async emptyTrash() {
      const emptyComments = {};
      const emptyCategories = {};
      const emptyNotes = {};
      await this.setCommentsTrash(emptyComments);
      await this.setCategoriesTrash(emptyCategories);
      await this.setSavedNotesTrash(emptyNotes);
      this.syncAfterChange();
    }

    async isCloudSyncEnabled() {
      try {
        if (!window.Subscription) return false;
        return await window.Subscription.isPro();
      } catch {
        return false;
      }
    }

    async syncAfterChange() {
      try {
        if ((await this.isCloudSyncEnabled()) && window.FavoritesSync) {
          await window.FavoritesSync.syncToCloud();
        }
      } catch (e) {
        console.warn("Cloud sync failed:", e);
      }
    }
  }

  // 挂载到全局对象
  window.CommentStorage = new CommentStorage();
  window.CommentStorage.init();
})();
