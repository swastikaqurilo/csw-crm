import axios from "axios";  
import {
  applyOptimistic,
  enqueue,
  newOperationId,
  reconcileOnlineWrite,
  flush,
} from "../offline/index.js";
import {
  readCachedResponse,
  writeCachedResponse,
  pruneCache,
} from "../db/httpCache.js";

const BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_API_URL) ||
  "/api";
const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
});
function dependsOnUnsyncedRecord(url = "") {
  return /(^|\/)pending(:|%3A)/i.test(String(url).split("?")[0]);
}
function getAuthToken() {
  try {
    return localStorage.getItem("token") ?? null;
  } catch {
    return null;
  }
}
function asBody(data) {
  if (data == null) return null;

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  return data;
}
function isNetworkError(error) {
  if (error?.response) return false;
  if (axios.isCancel(error)) return false;

  const code = error?.code;

  return (
    !code ||
    code === "ERR_NETWORK" ||
    code === "ERR_CONNECTION_REFUSED" ||
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT"
  );
}
function isAuthRoute(url = "") {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/register")
  );
}
function getOperationId(config) {
  return (
    config?._operationId ||
    config?.headers?.["Idempotency-Key"] ||
    config?.headers?.["idempotency-key"] ||
    null
  );
}
api.interceptors.request.use(async (config) => {
  if (config.__fromOutbox) {
    config.headers = config.headers || {};

    const token = getAuthToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  }
  config.headers = config.headers || {};
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method || "GET").toUpperCase();
  if (!WRITES.has(method)) {
    return config;
  }
  if (isAuthRoute(config.url)) {
    return config;
  }
  const operationId =
    config.headers["Idempotency-Key"] ||
    newOperationId();
  config.headers["Idempotency-Key"] = operationId;
  config._operationId = operationId;
  const mustQueue = dependsOnUnsyncedRecord(config.url);

  if (
    typeof navigator !== "undefined" &&
    navigator.onLine &&
    !mustQueue
  ) {
    return config;
  }
  const body = asBody(config.data);
  const optimistic = await applyOptimistic({
    method,
    url: config.url,
    data: body,
    operationId,
  });
  await enqueue({
    operationId,
    method,
    url: config.url,
    data: body,
  });

   if (mustQueue && typeof navigator !== "undefined" && navigator.onLine) {
    void flush().then(() => flush()).catch(() => {});
  }

  config.adapter = () =>
    Promise.resolve({
      data: {
        success: true,
        data: optimistic ?? {
          queued: true,
          operationId,
        },
        offline: true,
      },
      status: 200,
      statusText: "OK (offline)",
      headers: {},
      config,
    });

  return config;
});
api.interceptors.response.use(
  async (response) => {
    const cfg = response.config || {};
    const method = (cfg.method || "GET").toUpperCase();
    if (
      method === "GET" &&
      !cfg.__fromOutbox &&
      !cfg.url?.includes("/auth/me")
    ) {
      try {
        await writeCachedResponse(
          cfg.url,
          cfg.params,
          response.data
        );
        await pruneCache();
      } catch (error) {
        console.warn(
          "[axios] Failed to cache GET response:",
          error?.message
        );
      }

      return response;
    }
    if (
      WRITES.has(method) &&
      !cfg.__fromOutbox
    ) {
      try {
        await reconcileOnlineWrite({
          method,
          url: cfg.url,
          operationId: getOperationId(cfg),
          response,
        });
      } catch (error) {
        console.error(
          "[axios] Online write succeeded, but local reconciliation failed:",
          {
            method,
            url: cfg.url,
            operationId: getOperationId(cfg),
            message: error?.message,
          }
        );
      }
    }
    return response;
  },

  async (error) => {
    const cfg = error.config || {};
    const url = cfg.url || "";
    if (
      error.response?.status === 401 &&
      !isNetworkError(error) &&
      !isAuthRoute(url) &&
      !cfg.__fromOutbox
    ) {
      console.warn(
        "[axios] 401 Unauthorized caught. Clearing token."
      );
      try {
        localStorage.removeItem("token");
      } catch {
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("auth-expired")
        );
      }

      return Promise.reject(new Error("AUTH_EXPIRED"));
    }
    if (cfg.__fromOutbox) {
      return Promise.reject(error);
    }
    if (isAuthRoute(url)) {
      return Promise.reject(error);
    }
    const method = (cfg.method || "GET").toUpperCase();
    if (method === "GET") {
      if (!isNetworkError(error)) {
        return Promise.reject(error);
      }

      const cached = await readCachedResponse(
        cfg.url,
        cfg.params
      ).catch(() => null);

      if (cached != null) {
        return {
          data: cached,
          status: 200,
          statusText: "OK (cached)",
          headers: {},
          config: cfg,
        };
      }

      return Promise.reject(error);
    }

    if (
      WRITES.has(method) &&
      isNetworkError(error)
    ) {
      const operationId =
        getOperationId(cfg) || newOperationId();

      const body = asBody(cfg.data);

      try {
        const optimistic = await applyOptimistic({
          method,
          url: cfg.url,
          data: body,
          operationId,
        });

        await enqueue({
          operationId,
          method,
          url: cfg.url,
          data: body,
        });

        return {
          data: {
            success: true,
            data: optimistic ?? {
              queued: true,
              operationId,
            },
            offline: true,
          },
          status: 200,
          statusText: "OK (offline fallback)",
          headers: {},
          config: cfg,
        };
      } catch (offlineError) {
        
        console.error(
          "[axios] Could not save offline operation:",
          offlineError?.message
        );

        return Promise.reject(offlineError);
      }
    }

    return Promise.reject(error);
  }
);
export default api; 