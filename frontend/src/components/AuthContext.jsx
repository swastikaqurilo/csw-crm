import { createContext, useContext, useEffect, useState } from "react";
import { getMe, logout as apiLogout } from "../api/api";

const AuthContext = createContext(null);
const OFFLINE_SESSION_MS = 24 * 60 * 60 * 1000;

const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("offlineSession");
};

const readOfflineSession = () => {
  try {
    const session = JSON.parse(
      localStorage.getItem("offlineSession") || "null"
    );

    if (
      !session ||
      !session.verifiedAt ||
      !session.expiresAt ||
      Date.now() >= session.expiresAt
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
};


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineSession, setIsOfflineSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      console.log("[Auth Restore] Started", {
        online: navigator.onLine,
        tokenExists: !!localStorage.getItem("token"),
        userExists: !!localStorage.getItem("user"),
        offlineSession: readOfflineSession(),
      });
      try {
        const token = localStorage.getItem("token");
        const cachedUser = localStorage.getItem("user");
        const offlineSession = readOfflineSession();

        if (!token || !cachedUser) {
          clearSession();
          return;
        }

        let parsedUser;

        try {
          parsedUser = JSON.parse(cachedUser);

          if (
            !parsedUser ||
            typeof parsedUser !== "object" ||
            Array.isArray(parsedUser)
          ) {
            throw new Error("Invalid cached user.");
          }
        } catch {
          clearSession();
          return;
        }

        if (!navigator.onLine) {
          if (cancelled) return;

          if (offlineSession) {
            setUser(parsedUser);
            setIsOfflineSession(true);
          } else {
            setUser(null);
            setIsOfflineSession(false);
          }

          return;
        }

        if (!cancelled) {
          setUser(parsedUser);
          setIsOfflineSession(false);
        }

        try {
          const res = await getMe();
          const verifiedUser = res?.data?.data?.user;

          if (!verifiedUser) {
            throw new Error("The server returned no authenticated user.");
          }

          if (cancelled) return;

          const now = Date.now();

          setUser(verifiedUser);
          setIsOfflineSession(false);

          localStorage.setItem("user", JSON.stringify(verifiedUser));
          localStorage.setItem(
            "offlineSession",
            JSON.stringify({
              verifiedAt: now,
              expiresAt: now + OFFLINE_SESSION_MS,
            })
          );
        } catch (error) {
          if (cancelled) return;

          const status = error?.response?.status;

          if (status === 401 || status === 403) {
            clearSession();
            setUser(null);
            setIsOfflineSession(false);
            return;
          }

          const isNetworkFailure =
            !error?.response &&
            (
              error?.code === "ERR_NETWORK" ||
              error?.code === "ECONNABORTED" ||
              !navigator.onLine
            );

          if (isNetworkFailure && readOfflineSession()) {
            setUser(parsedUser);
            setIsOfflineSession(true);
          } else {
            setUser(null);
            setIsOfflineSession(false);
          }

          console.warn(
            "Session verification failed:",
            error?.message
          );
        }
      } catch (error) {
        console.error("Session restoration failed:", error);

        if (!cancelled) {
          setUser(null);
          setIsOfflineSession(false);
        }

      } finally {
        if (!cancelled) {
          console.log("[Auth Restore] Finished");
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginSuccess = (token, userData) => {
    const now = Date.now();

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem(
      "offlineSession",
      JSON.stringify({
        verifiedAt: now,
        expiresAt: now + OFFLINE_SESSION_MS,
      })
    );

    setUser(userData);
    setIsOfflineSession(false);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // Local logout must still work if the server is unavailable.
    }

    clearSession();
    setUser(null);
    setIsOfflineSession(false);
  };

  useEffect(() => {
    console.log("[Offline Auth Diagnostic]", {
      loading,
      isAuthenticated: !!user,
      isOfflineSession,
      user: user?.email ?? null,
      online: navigator.onLine,
    });
  }, [loading, user, isOfflineSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        isOfflineSession,
        loginSuccess,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}
