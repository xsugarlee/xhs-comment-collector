(() => {
  const Redeem = {
    async redeemCode(code) {
      const session = await globalThis.Auth.getSession();
      if (!session) throw new Error("请先登录");

      const supabase = globalThis.SupabaseClient;
      const { data, error } = await supabase.functions.invoke("redeem-code", {
        body: { code },
      });
      if (error) throw error;
      return data;
    },
  };

  globalThis.Redeem = Redeem;
})();
