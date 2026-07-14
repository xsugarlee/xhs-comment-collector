(() => {
  const FavoritesSync = {
    async syncToCloud() {
      const isProUser = await globalThis.Subscription.isPro();
      if (!isProUser) return { synced: 0 };

      const session = await globalThis.Auth.getSession();
      if (!session) return { synced: 0 };

      const supabase = globalThis.SupabaseClient;
      const comments = await globalThis.CommentStorage.getComments();
      const commentList = Object.values(comments);

      let synced = 0;
      for (const c of commentList) {
        const payload = {
          user_id: session.user.id,
          title: c.content || "",
          url: c.noteUrl || null,
          tags: c.tags || [],
          note: c.note || "",
          favicon_url: null,
          folder: c.category || "default",
          order_index: c.pinned ? 1 : 0,
        };

        const { error } = await supabase
          .from("favorites")
          .upsert(payload, { onConflict: "id" });

        if (!error) synced++;
      }
      return { synced };
    },

    async pullFromCloud() {
      const isProUser = await globalThis.Subscription.isPro();
      if (!isProUser) return [];

      const session = await globalThis.Auth.getSession();
      if (!session) return [];

      const supabase = globalThis.SupabaseClient;
      const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .eq("user_id", session.user.id)
        .order("order_index", { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async addFavoriteToCloud(item) {
      const isProUser = await globalThis.Subscription.isPro();
      if (!isProUser) return null;

      const session = await globalThis.Auth.getSession();
      if (!session) return null;

      const supabase = globalThis.SupabaseClient;
      const payload = {
        user_id: session.user.id,
        title: item.content || item.title || "",
        url: item.noteUrl || item.url || null,
        tags: item.tags || [],
        note: item.note || "",
        favicon_url: item.favicon_url || null,
        folder: item.category || item.folder || "default",
        order_index: item.pinned ? 1 : 0,
      };

      const { data, error } = await supabase
        .from("favorites")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async removeFavoriteFromCloud(itemId) {
      const isProUser = await globalThis.Subscription.isPro();
      if (!isProUser) return;

      const session = await globalThis.Auth.getSession();
      if (!session) return;

      const supabase = globalThis.SupabaseClient;
      await supabase
        .from("favorites")
        .delete()
        .eq("id", itemId)
        .eq("user_id", session.user.id);
    },

    async mergeCloudToLocal() {
      const cloudData = await this.pullFromCloud();
      if (cloudData.length === 0) return;

      const comments = await globalThis.CommentStorage.getComments();
      for (const fav of cloudData) {
        const localId = "cloud_" + fav.id;
        if (!comments[localId]) {
          comments[localId] = {
            id: localId,
            content: fav.title,
            noteUrl: fav.url || "",
            category: fav.folder || "default",
            note: fav.note || "",
            tags: fav.tags || [],
            pinned: fav.order_index > 0,
            collectedAt: new Date(fav.created_at).getTime(),
            cloudId: fav.id,
          };
        }
      }
      await globalThis.CommentStorage.setComments(comments);
    },
  };

  globalThis.FavoritesSync = FavoritesSync;
})();
