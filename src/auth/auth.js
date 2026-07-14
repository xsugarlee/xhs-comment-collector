(() => {
  const REFRESH_TOKEN_KEY = "supabase_refresh_token";

  const Auth = {
    getClient() {
      return globalThis.SupabaseClient;
    },

    async getSession() {
      const supabase = this.getClient();
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      return session;
    },

    async signUp(email, password) {
      const supabase = this.getClient();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    },

    async signInWithEmail(email, password) {
      const supabase = this.getClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      await this._persistToken(data.session);
      return data;
    },

    async signInWithGoogle() {
      const supabase = this.getClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          skipBrowserRedirect: true,
          redirectTo: chrome.identity.getRedirectURL(),
        },
      });
      if (error) throw error;

      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: data.url,
        interactive: true,
      });

      const url = new URL(redirectUrl);
      const params = new URLSearchParams(url.hash.substring(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        await chrome.storage.local.set({ [REFRESH_TOKEN_KEY]: refresh_token });
        return { session: await this.getSession() };
      }
      throw new Error("Google 登录失败：未获取到令牌");
    },

    async signOut() {
      const supabase = this.getClient();
      const { error } = await supabase.auth.signOut();
      await chrome.storage.local.remove(REFRESH_TOKEN_KEY);
      if (error) throw error;
    },

    async restoreSession() {
      const result = await chrome.storage.local.get(REFRESH_TOKEN_KEY);
      const token = result[REFRESH_TOKEN_KEY];
      if (!token) return null;

      const supabase = this.getClient();
      const { data, error } = await supabase.auth.setSession({
        refresh_token: token,
        access_token: "",
      });
      if (error) {
        await chrome.storage.local.remove(REFRESH_TOKEN_KEY);
        return null;
      }
      return data.session;
    },

    async _persistToken(session) {
      if (session && session.refresh_token) {
        await chrome.storage.local.set({
          [REFRESH_TOKEN_KEY]: session.refresh_token,
        });
      }
    },

    initAuthListener() {
      const supabase = this.getClient();
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          await this._persistToken(session);
        } else if (event === "SIGNED_OUT") {
          await chrome.storage.local.remove(REFRESH_TOKEN_KEY);
        }
      });
    },

    getUser() {
      const supabase = this.getClient();
      return supabase.auth.getUser();
    },
  };

  globalThis.Auth = Auth;
})();
