(() => {
  const PLANS = {
    pro_monthly: { name: "Pro 月付", amount: 19.9, months: 1 },
    pro_yearly: { name: "Pro 年付", amount: 29.9, months: 12 },
  };

  const Payment = {
    getPlans() {
      return PLANS;
    },

    async createOrder(planKey) {
      const session = await globalThis.Auth.getSession();
      if (!session) throw new Error("请先登录");

      const plan = PLANS[planKey];
      if (!plan) throw new Error("无效的套餐");

      const note = Math.random().toString(36).substring(2, 8).toUpperCase();

      const supabase = globalThis.SupabaseClient;
      const { data, error } = await supabase
        .from("orders")
        .insert({
          user_id: session.user.id,
          user_email: session.user.email,
          plan: planKey,
          amount: plan.amount,
          payment_note: note,
          status: "pending",
        })
        .select("payment_note")
        .single();

      if (error) throw error;
      return { note: data.payment_note, plan, amount: plan.amount };
    },
  };

  globalThis.Payment = Payment;
})();
