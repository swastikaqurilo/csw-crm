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
import {
  getAttendanceFromCache,
  getAttendanceHistoryPageFromCache,
  getPaymentsFromCache,
  getPaymentByIdFromCache,
  getPaymentSummaryFromCache,
  getPaymentsByOrderFromCache,
  getExpensesFromCache,
} from "../offline/reads.js";

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

  if (
    typeof navigator !== "undefined" &&
    navigator.onLine === false
  ) {
    return true;
  }

  const code = error?.code;

  return (
    !code ||
    code === "ERR_NETWORK" ||
    code === "ERR_INTERNET_DISCONNECTED" ||
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


async function readOfflineGet(config) {
  const url = String(config.url || "").split("?")[0];
  const path = url.replace(/^\/api(?=\/)/, "");
  const params = config.params || {};

  const safeRead = async (reader, label) => {
    try {
      return await reader();
    } catch (error) {
      console.error(`[axios] Offline ${label} read failed:`, error);
      return null;
    }
  };

  if (path === "/expense" || path === "/expenses") {
    const expenses = await safeRead(
      () => getExpensesFromCache(),
      "expenses"
    );
    if (expenses != null) {
      return { success: true, data: expenses };
    }
  }

  if (path === "/payment/summary" || path === "/payments/summary") {
    const summary = await safeRead(
      () => getPaymentSummaryFromCache(),
      "payment summary"
    );
    if (summary != null) {
      return { success: true, data: summary };
    }
  }

  if (path === "/payment" || path === "/payments") {
    const payments = await safeRead(
      () =>
        getPaymentsFromCache({
          search: params.search,
          paymentMode: params.paymentMode,
          status: params.status,
          from: params.from,
          to: params.to,
        }),
      "payments"
    );

    if (payments != null) {
      return {
        success: true,
        data: payments,
        pagination: {
          page: Number(params.page) || 1,
          limit: Number(params.limit) || payments.length,
          total: payments.length,
          totalPages: 1,
        },
      };
    }
  }

  const paymentByOrder = path.match(/^\/payments?\/order\/([^/]+)$/);

  if (paymentByOrder) {
    const result = await safeRead(
      () => getPaymentsByOrderFromCache(
        decodeURIComponent(paymentByOrder[1])
      ),
      "order payments"
    );

    if (result != null) {
      return { success: true, ...result };
    }
  }

  const paymentById = path.match(/^\/payments?\/([^/]+)$/);

  if (paymentById && paymentById[1] !== "summary") {
    const payment = await safeRead(
      () => getPaymentByIdFromCache(
        decodeURIComponent(paymentById[1])
      ),
      "payment lookup"
    );

    if (payment != null) {
      return { success: true, data: payment };
    }
  }

  if (path === "/workers/attendance" && params.date) {
    const attendance = await safeRead(
      () => getAttendanceFromCache(params.date),
      "attendance"
    );

    if (attendance != null) {
      return { success: true, data: attendance };
    }
  }

  if (path === "/workers/attendance/history") {
    const history = await safeRead(
      () =>
        getAttendanceHistoryPageFromCache({
          page: Number(params.page) || 1,
          limit: Number(params.limit) || 8,
        }),
      "attendance history"
    );

    if (history != null) {
      return history;
    }
  }

  return await safeRead(
    () => readCachedResponse(config.url, config.params),
    "cached response"
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

// Serve offline GET requests directly from IndexedDB.
if (
  method === "GET" &&
  typeof navigator !== "undefined" &&
  navigator.onLine === false
) {
  config.adapter = async (adapterConfig) => {
    const data = await readOfflineGet(adapterConfig);

    if (data == null) {
      throw new axios.AxiosError(
        "No cached response available for this request.",
        "ERR_NETWORK",
        adapterConfig
      );
    }

    adapterConfig.__offlineLocalRead = true;

    return {
      data,
      status: 200,
      statusText: "OK (local cache)",
      headers: {},
      config: adapterConfig,
    };
  };

  return config;
}

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
      !cfg.__offlineLocalRead &&
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
      !cfg.__fromOutbox &&
      !response.data?.offline
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
    const method = (cfg.method || "GET").toUpperCase();

    const offlineRead =
      method === "GET" &&
      typeof navigator !== "undefined" &&
      navigator.onLine === false;
    const url = cfg.url || "";
    console.log("[ATTENDANCE DEBUG]", {
      url: cfg.url,
      baseURL: cfg.baseURL,
      method: cfg.method,
      code: error?.code,
      networkError: isNetworkError(error),
      params: cfg.params,
    });
    if (
      error.response?.status === 401 &&
      !offlineRead &&
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

    if (method === "GET") {
      if (!isNetworkError(error) && !offlineRead) {
        return Promise.reject(error);
      }

      // Expenses: read the latest locally cached records.
      const expensePath = String(cfg.url || "")
        .split("?")[0]
        .replace(/^\/api(?=\/)/, "");

      if (expensePath === "/expense" || expensePath === "/expenses") {
        const expenses = await getExpensesFromCache().catch((err) => {
          console.error("[axios] Local expenses read failed:", err);
          return null;
        });

        if (expenses) {
          return {
            data: {
              success: true,
              data: expenses,
            },
            status: 200,
            statusText: "OK (local expenses)",
            headers: {},
            config: cfg,
          };
        }
      }

      const paymentPath = String(cfg.url || "")
        .split("?")[0]
        .replace(/^\/api(?=\/)/, "");

      // Payment list with search, mode, status and date filters.
      if (
        paymentPath === "/payment" ||
        paymentPath === "/payments"
      ) {
        const payments = await getPaymentsFromCache({
          search: cfg.params?.search,
          paymentMode: cfg.params?.paymentMode,
          status: cfg.params?.status,
          from: cfg.params?.from,
          to: cfg.params?.to,
        }).catch((err) => {
          console.error(
            "[axios] Local payments read failed:",
            err
          );
          return null;
        });

        if (payments) {
          return {
            data: {
              success: true,
              data: payments,
              pagination: {
                page: Number(cfg.params?.page) || 1,
                limit: Number(cfg.params?.limit) || payments.length,
                total: payments.length,
                totalPages: 1,
              },
            },
            status: 200,
            statusText: "OK (local payments)",
            headers: {},
            config: cfg,
          };
        }
      }

      // Payment summary cards.
      if (
        paymentPath === "/payment/summary" ||
        paymentPath === "/payments/summary"
      ) {
        const summary = await getPaymentSummaryFromCache().catch(
          (err) => {
            console.error(
              "[axios] Local payment summary read failed:",
              err
            );
            return null;
          }
        );

        if (summary) {
          return {
            data: {
              success: true,
              data: summary,
            },
            status: 200,
            statusText: "OK (local payment summary)",
            headers: {},
            config: cfg,
          };
        }
      }

      const paymentByOrderMatch = paymentPath.match(
        /^\/payments?\/order\/([^/]+)$/
      );

      if (paymentByOrderMatch) {
        const result = await getPaymentsByOrderFromCache(
          decodeURIComponent(paymentByOrderMatch[1])
        ).catch((err) => {
          console.error(
            "[axios] Local order payments read failed:",
            err
          );
          return null;
        });

        if (result) {
          return {
            data: {
              success: true,
              ...result,
            },
            status: 200,
            statusText: "OK (local order payments)",
            headers: {},
            config: cfg,
          };
        }
      }

      const paymentByIdMatch = paymentPath.match(
        /^\/payments?\/([^/]+)$/
      );

      if (
        paymentByIdMatch &&
        paymentByIdMatch[1] !== "summary"
      ) {
        const payment = await getPaymentByIdFromCache(
          decodeURIComponent(paymentByIdMatch[1])
        ).catch((err) => {
          console.error(
            "[axios] Local payment lookup failed:",
            err
          );
          return null;
        });

        if (payment) {
          return {
            data: {
              success: true,
              data: payment,
            },
            status: 200,
            statusText: "OK (local payment)",
            headers: {},
            config: cfg,
          };
        }
      }

      // Attendance must read the latest dedicated local record first.
      if (
        String(cfg.url || "").split("?")[0] === "/workers/attendance" &&
        cfg.params?.date
      ) {
        const attendance = await getAttendanceFromCache(
          cfg.params.date
        ).catch(() => null);

        if (attendance) {
          return {
            data: {
              success: true,
              data: attendance,
            },
            status: 200,
            statusText: "OK (local attendance)",
            headers: {},
            config: cfg,
          };
        }
      }

      // Attendance history: read the latest locally saved records.
      if (
        String(cfg.url || "").split("?")[0] ===
        "/workers/attendance/history"
      ) {
        const history = await getAttendanceHistoryPageFromCache({
          page: Number(cfg.params?.page) || 1,
          limit: Number(cfg.params?.limit) || 8,
        }).catch((err) => {
          console.error(
            "[axios] Local attendance history read failed:",
            err
          );
          return null;
        });

        console.log("[ATTENDANCE HISTORY CACHE RESULT]", history);

        if (history) {
          console.log("[axios] Returning cached attendance history");

          return {
            data: history,
            status: 200,
            statusText: "OK",
            headers: {},
            config: cfg,
          };
        }
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