import axios from "axios";

import {
  applyOptimistic,
  enqueue,
  newOperationId,
} from "../db/outbox.js";

import {
  readCachedResponse,
  writeCachedResponse,
  pruneCache,
} from "../db/httpCache.js";

const BASE_URL = 
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "/api"; 

   
const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true, 
});

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
    try { return JSON.parse(data); } catch { return data; }
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

  api.interceptors.request.use(async (config) => {
  if (config.__fromOutbox) {
    config.headers = config.headers || {};
    const token = getAuthToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  }

  config.headers = config.headers || {};
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const method = (config.method || "").toUpperCase();

  const isAuthRoute = config.url?.includes('/auth/login') || config.url?.includes('/auth/register');


  if (WRITES.has(method) && !config.headers["Idempotency-Key"]) {
    config.headers["Idempotency-Key"] = newOperationId();
  }
  if (WRITES.has(method)) {
    config._operationId = config.headers["Idempotency-Key"];
  }

  if (!WRITES.has(method)) return config;

  if (isAuthRoute) return config; 

  if (typeof navigator !== "undefined" && navigator.onLine) return config;

  const operationId = config._operationId;
  const body = asBody(config.data);
  const optimistic = await applyOptimistic({
    method, url: config.url, data: body, operationId,
  });
  await enqueue({ operationId, method, url: config.url, data: body });

  config.adapter = () => Promise.resolve({
    data: { success: true, data: optimistic ?? { queued: true, operationId } },
    status: 200, statusText: "OK (queued)", headers: {}, config,
  });
  return config;
});

api.interceptors.response.use(
  (response) => {
    const cfg = response.config || {};
    const method = (cfg.method || "").toLowerCase();
    
    if (method === "get" && !cfg.__fromOutbox && !cfg.url?.includes("/auth/me")) {
      Promise.resolve()
        .then(() => writeCachedResponse(cfg.url, cfg.params, response.data))
        .then(() => pruneCache())
        .catch(() => {});
    }
    return response;
  },

  async (error) => {
    const cfg = error.config || {};

    const isAuthRoute = cfg.url?.includes('/auth/login') || cfg.url?.includes('/auth/register');

    if (error.response && error.response.status === 401 && !isAuthRoute && !cfg.__fromOutbox) {
      console.warn("[axios] 401 Unauthorized caught. Clearing token.");
      localStorage.removeItem("token");
      window.dispatchEvent(new CustomEvent("auth-expired"));
      return Promise.reject(new Error("AUTH_EXPIRED"));
    }

    if (cfg.__fromOutbox) return Promise.reject(error);

    if (isAuthRoute) {
      return Promise.reject(error); 
    }

    const method = (cfg.method || "").toUpperCase();
    
    if (method === "GET") {
      if (!isNetworkError(error)) {
        return Promise.reject(error);
      }

      const cached = await readCachedResponse(
        cfg.url,
        cfg.params
      ).catch(() => null);

      if (cached) {
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

    if (WRITES.has(method) && isNetworkError(error)) {
      const operationId = cfg._operationId || cfg.headers?.["Idempotency-Key"] || newOperationId();
      const body = asBody(cfg.data);
      const optimistic = await applyOptimistic({
        method, url: cfg.url, data: body, operationId,
      });
      await enqueue({ operationId, method, url: cfg.url, data: body });
      return {
        data: { success: true, data: optimistic ?? { queued: true, operationId } },
        status: 200, statusText: "OK (queued)", headers: {}, config: cfg,
      };
    }

    return Promise.reject(error);
  }
);

export default api