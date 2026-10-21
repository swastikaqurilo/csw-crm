import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { db } from "./db/database";
import { syncAll } from "./db/syncEngine";
import "./index.css";
import App from "./App.jsx";

// testDatabase().catch((error) => {
//   console.error("[Dexie test] Startup check failed:", error);
// });

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

  window.inspectCSWDatabase = async () => {
  try {
    console.log("Dexie declared version:", db.verno);

    await db.open();

    console.log("Dexie opened successfully:", {
      version: db.verno,
      isOpen: db.isOpen(),
      tables: db.tables.map((table) => table.name),
    });
  } catch (error) {
    console.error("Dexie open failed:", {
      name: error.name,
      message: error.message,
      innerName: error.inner?.name,
      innerMessage: error.inner?.message,
      stack: error.stack,
    });
  }
};

window.checkCSWOfflineData = async () => {
  try {
    await db.open();

    const contacts = await db.cachedRecords
      .where("module")
      .equals("contacts")
      .count();

    const products = await db.cachedRecords
      .where("module")
      .equals("products")
      .count();

    const pending = await db.syncQueue
      .where("status")
      .equals("pending")
      .count();

    const transaction = db.backendDB().transaction(
      ["cachedRecords", "syncQueue", "syncMetadata"],
      "readonly"
    );

    const indexUnique = transaction
      .objectStore("cachedRecords")
      .index("[module+recordId]").unique;

    console.log("CSW offline data:", {
      databaseVersion: db.verno,
      contacts,
      products,
      pendingOperations: pending,
      compoundIndexUnique: indexUnique,
    });
  } catch (error) {
    console.error("Offline data check failed:", error);
  }
};


window.inspectCSWSyncMetadata = async () => {
  try {
    await db.open();
    const entries = await db.syncMetadata.toArray();
    console.table(entries);
    return entries;
  } catch (error) {
    console.error("Failed to inspect sync metadata:", error);
  }
};

window.inspectCSWCheckpoints = async () => {
  try {
    await db.open();

    const checkpoints = await db.syncMetadata.toArray();

    console.table(checkpoints);
    return checkpoints;
  } catch (error) {
    console.error("Checkpoint inspection failed:", error);
    throw error;
  }
};


createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
