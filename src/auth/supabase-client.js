(() => {
  const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
  const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

  const client = globalThis.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );

  window.SupabaseClient = client;
})();
