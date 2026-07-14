chrome.runtime.onInstalled.addListener(() => {
  console.log("REDC已安装");
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/dashboard/dashboard.html"),
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_DASHBOARD") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/dashboard/dashboard.html"),
    });
    sendResponse({ success: true });
  }
  if (message.type === "FILTER_SETTINGS_CHANGED") {
    chrome.tabs.query({ url: "*://*xiaohongshu.com/*" }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: "FILTER_SETTINGS_CHANGED", settings: message.settings }).catch(() => {});
      }
    });
    sendResponse({ success: true });
  }
  if (message.type === "COMMENT_SAVED" || message.type === "DATA_CHANGED") {
    const queryInfo = { url: "*://*/*dashboard.html" };
    chrome.tabs.query(queryInfo, (tabs) => {
      for (const tab of tabs) {
        if (tab.url?.includes("dashboard.html")) {
          chrome.tabs.sendMessage(tab.id, { type: "REFRESH" }).catch((err) => {
            console.debug(
              `[Background] 向 Tab ${tab.id} 发送 REFRESH 失败，原因：`,
              err.message,
            );
          });
        }
      }
    });
  }
  if (message.type === "FETCH_XHS") {
    fetch(message.url, {
      credentials: "include",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Referer: "https://www.xiaohongshu.com/",
      },
    })
      .then((r) => r.text())
      .then((html) => sendResponse({ html }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (message.type === "FETCH_XHS_API") {
    const apiUrl = `https://api.bugpk.com/api/xhsjx?url=${encodeURIComponent(message.url)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch(apiUrl, { redirect: "follow", signal: controller.signal })
      .then((r) => {
        clearTimeout(timer);
        return r.text();
      })
      .then((text) => {
        try {
          const json = JSON.parse(text);
          sendResponse({ data: json });
        } catch {
          sendResponse({ error: "API 返回无效数据: " + text.slice(0, 200) });
        }
      })
      .catch((e) => {
        clearTimeout(timer);
        sendResponse({ error: "API 请求失败: " + e.message });
      });
    return true;
  }
  if (message.type === "GET_SESSION") {
    chrome.storage.local.get("supabase_refresh_token", (result) => {
      sendResponse({ hasToken: !!result.supabase_refresh_token });
    });
    return true;
  }
});
