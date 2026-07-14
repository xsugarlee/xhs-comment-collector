(() => {
  const FREE_LIMIT = 10;

  const Subscription = {
    async getUserSubscription() {
      const session = await globalThis.Auth.getSession();
      if (!session) return { plan: "free", active: false, expires_at: null };

      const supabase = globalThis.SupabaseClient;
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("plan, expires_at, active")
        .eq("user_id", session.user.id)
        .single();

      if (error || !data || !data.active) {
        return { plan: "free", active: false, expires_at: null };
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return { plan: "free", active: false, expires_at: data.expires_at };
      }

      return data;
    },

    async isPro() {
      const sub = await this.getUserSubscription();
      return (
        sub.active && (sub.plan === "pro_monthly" || sub.plan === "pro_yearly")
      );
    },

    async canAddFavorite(currentCount) {
      const isProUser = await this.isPro();
      if (isProUser) return true;
      return currentCount < FREE_LIMIT;
    },

    getFreeLimit() {
      return FREE_LIMIT;
    },
  };

  globalThis.Subscription = Subscription;
})();
