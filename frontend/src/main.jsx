import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { testDatabase } from "./db/testDatabase";
import { syncAll } from "./db/syncEngine";
import "./index.css";
import App from "./App.jsx";

testDatabase();

let updatePromptOpen = false;

const updateSW = registerSW({
  onNeedRefresh() {
    console.log("[PWA] A service-worker update is waiting.");

    if (updatePromptOpen) return;

    updatePromptOpen = true;

    const shouldReload = window.confirm(
      "A new version of CSW CRM is available. Reload now?"
    );

    if (shouldReload) {
      updateSW(true);
    } else {
      updatePromptOpen = false;
    }
  },

  onOfflineReady() {
    console.log("[PWA] CSW CRM is ready for offline use.");
  },

  onRegisteredSW(swUrl, registration) {
    console.log("[PWA] Service worker registered:", swUrl);
    console.log(
      "[PWA] Waiting worker:",
      Boolean(registration?.waiting)
    );
    console.log(
      "[PWA] Installing worker:",
      Boolean(registration?.installing)
    );
  },

  onRegisterError(error) {
    console.error("[PWA] Service-worker registration failed:", error);
  },
});

  window.testCSWSync = async () => {
    try {
      const result = await syncAll();
      console.log("[CSW sync test] Success:", result);
      return result;
    } catch (error) {
      console.error(
        "[CSW sync test] Failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  };

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
