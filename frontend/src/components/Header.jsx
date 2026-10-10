import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Package,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Settings as SettingsIcon,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { getNotifications, logout as logoutApi } from "../api/api";

const POLL_INTERVAL = 60_000; // refresh every 60s
const READ_STORAGE_KEY = "notifications:readIds";

/* ---------- helpers ---------- */
const loadReadIds = () => {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const saveReadIds = (set) => {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore quota errors */
  }
};

const timeAgo = (date) => {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
};

const typeIcon = (type) => {
  switch (type) {
    case "stock":
      return Package;
    case "payment":
      return CreditCard;
    case "overdue":
      return AlertTriangle;
    default:
      return Bell;
  }
};

const loadUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

function Header() {
  const navigate = useNavigate();

  /* ---------- notifications ---------- */
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ total: 0, critical: 0, warning: 0 });
  const [readIds, setReadIds] = useState(() => loadReadIds());

  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  /* ---------- profile menu ---------- */
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [user] = useState(() => loadUser());

  const profileRef = useRef(null);
  const profileBtnRef = useRef(null);

  /* ---------- fetch ---------- */
  const fetchAlerts = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await getNotifications();
      const data = res?.data?.data || {};
      setAlerts(data.alerts || []);
      setCounts(data.counts || { total: 0, critical: 0, warning: 0 });
    } catch (err) {
      console.error("[notifications] fetch failed:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const t = setInterval(() => fetchAlerts(true), POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchAlerts]);

  /* ---------- click outside: notifications ---------- */
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  /* ---------- click outside: profile ---------- */
  useEffect(() => {
    if (!profileOpen) return;
    const onDocClick = (e) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target) &&
        profileBtnRef.current &&
        !profileBtnRef.current.contains(e.target)
      ) {
        setProfileOpen(false);
      }
    };
    const onEsc = (e) => e.key === "Escape" && setProfileOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [profileOpen]);

  /* ---------- refresh when opening ---------- */
  const toggleOpen = () => {
    setOpen((o) => !o);
    if (!open) fetchAlerts(true);
  };

  const unreadIds = alerts.filter((a) => !readIds.has(a.id));
  const unreadCount = unreadIds.length;

  const markAsRead = (id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  };

  const markAllRead = () => {
    setReadIds((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => next.add(a.id));
      saveReadIds(next);
      return next;
    });
  };

  const handleAlertClick = (alert) => {
    markAsRead(alert.id);
    setOpen(false);
    if (alert.href) navigate(alert.href);
  };

  /* ---------- logout ---------- */
  const openLogoutConfirm = () => {
    setProfileOpen(false);
    setConfirmLogout(true);
  };

  const performLogout = async () => {
    try {
      setLoggingOut(true);

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("notifications:readIds");

      try {
        await logoutApi();
      } catch (err) {
        console.warn("[logout] server call failed, continuing:", err);
      }

      navigate("/login", { replace: true });
    } catch (err) {
      console.error("[logout] failed:", err);
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  /* ---------- badge styling ---------- */
  const badgeColor =
    counts.critical > 0
      ? "bg-red-500"
      : counts.warning > 0
      ? "bg-amber-500"
      : "bg-slate-400";

  /* ---------- user display ---------- */
  const displayName = user?.name || "Admin";
  const displayRole = user?.role || "Administrator";
  const initial = (displayName || "A").charAt(0).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-[#f5f7fa] px-6">
      <div className="flex h-10 w-full max-w-md items-center gap-3 rounded-full border border-slate-200 bg-white px-4 text-slate-400">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search enquiries, contacts..."
          className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="ml-6 flex items-center gap-4">
        {/* ---------- NOTIFICATIONS ---------- */}
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={toggleOpen}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            aria-label="Notifications"
            aria-expanded={open}
          >
            <Bell size={19} />

            {unreadCount > 0 && (
              <span
                className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-[#f5f7fa] ${badgeColor}`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div
              ref={dropdownRef}
              className="absolute right-0 top-12 z-50 w-[380px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Notifications
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {counts.total === 0
                      ? "All caught up"
                      : `${counts.total} total · ${unreadCount} unread`}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-semibold text-[#0f172a] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                {loading && alerts.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
                    <Loader2 size={14} className="animate-spin" />
                    Loading…
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="flex flex-col items-center py-10">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <CheckCircle2 size={20} />
                    </div>
                    <p className="text-xs font-medium text-slate-700">
                      You're all caught up
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      No pending alerts right now
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {alerts.map((alert) => {
                      const Icon = typeIcon(alert.type);
                      const isUnread = !readIds.has(alert.id);
                      const tone =
                        alert.severity === "critical"
                          ? "border-red-200 bg-red-50 text-red-600"
                          : alert.severity === "warning"
                          ? "border-amber-200 bg-amber-50 text-amber-600"
                          : "border-slate-200 bg-slate-50 text-slate-600";

                      return (
                        <li key={alert.id}>
                          <button
                            onClick={() => handleAlertClick(alert)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                              isUnread ? "bg-blue-50/40" : "bg-white"
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tone}`}
                            >
                              <Icon size={15} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-800">
                                  {alert.title}
                                </p>
                                {isUnread && (
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                                )}
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-slate-500">
                                {alert.message}
                              </p>
                              <p className="mt-1 text-[10px] text-slate-400">
                                {timeAgo(alert.createdAt)}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {alerts.length > 0 && (
                <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-2.5">
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate("/products");
                    }}
                    className="w-full text-center text-[11px] font-semibold text-[#0f172a] hover:underline"
                  >
                    View all in inventory
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---------- USER / PROFILE MENU ---------- */}
        <div className="relative">
          <button
            ref={profileBtnRef}
            type="button"
            onClick={() => setProfileOpen((p) => !p)}
            className="flex h-10 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 transition-colors hover:bg-slate-50"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#002244] text-sm font-semibold text-white">
              {initial}
            </div>
            <div className="flex flex-col items-start">
              <strong className="text-sm font-semibold leading-tight text-slate-800">
                {displayName}
              </strong>
              <span className="text-xs leading-tight text-slate-500">
                {displayRole}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
            />
          </button>

          {profileOpen && (
            <div
              ref={profileRef}
              role="menu"
              className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {displayName}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {user?.email || displayRole}
                </p>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/settings");
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <SettingsIcon size={15} className="text-slate-400" />
                Settings
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={openLogoutConfirm}
                className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---------- LOGOUT CONFIRM ---------- */}
      {confirmLogout && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onClick={loggingOut ? undefined : () => setConfirmLogout(false)}
        >
          <div
            className="w-full max-w-[400px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3 px-5 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600">
                <LogOut size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-slate-900">
                  Log out?
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  You'll be signed out and will need to log in again to access
                  the dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                disabled={loggingOut}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                disabled={loggingOut}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={performLogout}
                disabled={loggingOut}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingOut ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <LogOut size={15} />
                )}
                {loggingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;