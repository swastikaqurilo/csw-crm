import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail, Lock, AlertCircle, CheckCircle2, Loader2,
  ArrowLeft, ShieldCheck, RotateCcw, Eye, EyeOff,
} from "lucide-react";
import { forgotPassword, resetPassword } from "../api/api";

const RESEND_COOLDOWN = 60; // must match backend RESEND_COOLDOWN_MS / 1000

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [stage, setStage] = useState("email"); // "email" | "otp"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // ---------- Step 1: send OTP ----------
  const sendOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setInfo("");

    if (!email.trim()) return setError("Enter your email address.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");

    try {
      setLoading(true);
      await forgotPassword(email.trim().toLowerCase());
      setStage("otp");
      setCooldown(RESEND_COOLDOWN);
      setInfo(`We sent a 6-digit code to ${email.trim()}. It expires in 10 minutes.`);
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't send the code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Resend ----------
  const resend = async () => {
    if (cooldown > 0 || loading) return;
    setError("");
    setInfo("");
    try {
      setLoading(true);
      await forgotPassword(email.trim().toLowerCase());
      setCooldown(RESEND_COOLDOWN);
      setOtp("");
      setInfo("A new code has been sent.");
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't resend the code.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Step 2: verify + reset ----------
  const submitReset = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code from your email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password.length > 128) return setError("Password is too long.");
    if (password !== confirm) return setError("Passwords don't match.");

    try {
      setLoading(true);
      await resetPassword({
        email: email.trim().toLowerCase(),
        otp,
        password,
      });
      navigate("/login", {
        state: { message: "Password updated. Sign in with your new password." },
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't reset the password.");
    } finally {
      setLoading(false);
    }
  };

  const backToEmail = () => {
    setStage("email");
    setOtp("");
    setPassword("");
    setConfirm("");
    setError("");
    setInfo("");
    setCooldown(0);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

        {/* Back link */}
        <button
          type="button"
          onClick={stage === "email" ? () => navigate("/login") : backToEmail}
          className="mb-5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft size={13} />
          {stage === "email" ? "Back to sign in" : "Use a different email"}
        </button>

        {/* Icon */}
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#002244]/5 text-[#002244]">
          {stage === "email" ? <Mail size={22} /> : <ShieldCheck size={22} />}
        </div>

        {/* Headings */}
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {stage === "email" ? "Forgot password" : "Enter your reset code"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {stage === "email"
            ? "Enter your email and we'll send a 6-digit code."
            : `Enter the code we sent to ${email} and choose a new password.`}
        </p>

        {/* Alerts */}
        {error && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {info && !error && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{info}</span>
          </div>
        )}

        {/* ============================== STEP 1 ============================== */}
        {stage === "email" && (
          <form onSubmit={sendOtp} className="mt-5 space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@corvex.com"
                disabled={loading}
                autoFocus
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10 disabled:bg-slate-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#002244] text-sm font-semibold text-white transition hover:bg-[#00345f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" />Sending…</>
              ) : "Send reset code"}
            </button>
          </form>
        )}

        {/* ============================== STEP 2 ============================== */}
        {stage === "otp" && (
          <form onSubmit={submitReset} className="mt-5 space-y-4">
            {/* OTP */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Reset code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                autoFocus
                disabled={loading}
                className="h-14 w-full rounded-xl border border-slate-200 bg-white text-center font-mono text-2xl font-bold tracking-[0.5em] text-slate-900 outline-none transition placeholder:tracking-[0.5em] placeholder:text-slate-300 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10 disabled:bg-slate-50"
              />
            </div>

            {/* New password */}
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                disabled={loading}
                autoComplete="new-password"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10 disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                tabIndex={-1}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Confirm */}
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                disabled={loading}
                autoComplete="new-password"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10 disabled:bg-slate-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#002244] text-sm font-semibold text-white transition hover:bg-[#00345f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" />Updating…</>
              ) : "Reset password"}
            </button>

            {/* Resend */}
            <div className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-500">
              <span>Didn't get a code?</span>
              <button
                type="button"
                onClick={resend}
                disabled={cooldown > 0 || loading}
                className="inline-flex items-center gap-1 font-semibold text-[#002244] transition hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
              >
                <RotateCcw size={11} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Corvex Steel Wires · Authorized access only
        </p>
      </div>
    </div>
  );
}