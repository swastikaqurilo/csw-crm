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
      const token = localStorage.getItem("token");
      const cachedUser = localStorage.getItem("user");

      if (!token || !cachedUser) {
        clearSession();
        if (!cancelled) setLoading(false);
        return;
      }

      let parsedUser;

      try {
        parsedUser = JSON.parse(cachedUser);
      } catch {
        clearSession();
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled) setUser(parsedUser);

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
        const offlineSession = readOfflineSession();
        const isNetworkFailure =
          !error?.response &&
          (error?.code === "ERR_NETWORK" ||
            error?.code === "ECONNABORTED" ||
            !navigator.onLine);

        if (offlineSession && isNetworkFailure) {
          setUser(parsedUser);
          setIsOfflineSession(true);
        } else {
          clearSession();
          setUser(null);
          setIsOfflineSession(false);
        }

        console.warn(
          "Session verification failed.",
          error?.message
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginSuccess = (token, userData) => {
    console.log("[Auth] loginSuccess called", {
      tokenReceived: !!token,
      userReceived: !!userData,
      origin: window.location.origin,
    });

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

    console.log("[Auth] Storage after save", {
      tokenExists: !!localStorage.getItem("token"),
      userExists: !!localStorage.getItem("user"),
      offlineSessionExists: !!localStorage.getItem("offlineSession"),
    });

    setUser(userData);
    setIsOfflineSession(false);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
    }

    clearSession();
    setUser(null);
    setIsOfflineSession(false);
  };

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
