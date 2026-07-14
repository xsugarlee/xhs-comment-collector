import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { code } = await req.json();
  if (!code) {
    return new Response(JSON.stringify({ error: "缺少激活码" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: codeRow, error: fetchError } = await supabaseAdmin
    .from("activation_codes")
    .select("*")
    .eq("code", code)
    .eq("is_used", false)
    .single();

  if (fetchError || !codeRow) {
    return new Response(JSON.stringify({ error: "激活码无效或已使用" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const durationMonths = codeRow.plan === "pro_yearly" ? 12 : 1;
  const now = new Date();

  const { data: currentSub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("expires_at")
    .eq("user_id", user.id)
    .single();

  let baseDate = now;
  if (currentSub && currentSub.expires_at && new Date(currentSub.expires_at) > now) {
    baseDate = new Date(currentSub.expires_at);
  }

  const expiresAt = new Date(baseDate);
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  const { error: updateCodeError } = await supabaseAdmin
    .from("activation_codes")
    .update({ is_used: true, used_by: user.id, used_at: now.toISOString() })
    .eq("id", codeRow.id);

  if (updateCodeError) {
    return new Response(JSON.stringify({ error: "激活码使用失败，请重试" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error: upsertError } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert({
      user_id: user.id,
      plan: codeRow.plan,
      expires_at: expiresAt.toISOString(),
      active: true,
      updated_at: now.toISOString(),
    });

  if (upsertError) {
    return new Response(JSON.stringify({ error: "订阅更新失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      plan: codeRow.plan,
      expires_at: expiresAt.toISOString(),
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});
