
//  import { useState } from "react";
//  import { Link, useNavigate, useLocation } from "react-router-dom";
//  import {
//    Eye,
//    EyeOff,
//    Lock,
//    Mail,
//    AlertCircle,
//    Loader2,
//    CheckCircle2,
//    ArrowRight,
//    Shield,
//  } from "lucide-react";
//  import { login } from "../api/api";
//  import { useAuth } from "../components/AuthContext";

//   Put your logo in public/ or src/assets/
//  import cswLogo from "../assets/cswlogo.png";  adjust path if needed

//  function Login() {
//    const navigate = useNavigate();
//    const location = useLocation();
//    const { loginSuccess } = useAuth();

//    const successMessage = location.state?.message || "";

//    const [email, setEmail] = useState("");
//    const [password, setPassword] = useState("");
//    const [showPassword, setShowPassword] = useState(false);
//    const [loading, setLoading] = useState(false);
//    const [error, setError] = useState("");

//    const handleSubmit = async (e) => {
//      e.preventDefault();
//      setError("");

//      if (!email.trim() || !password) {
//        setError("Please enter both email and password.");
//        return;
//      }

//      try {
//        setLoading(true);

//        const response = await login({
//          email: email.trim(),
//          password,
//        });

//        const { token, user } = response?.data?.data || {};

//        if (!token) throw new Error("No token received");

//        loginSuccess(token, user);

//        const from = location.state?.from?.pathname || "/dashboard";
//        navigate(from, { replace: true });
//      } catch (err) {
//        console.error("Login error:", err);
//        setError(
//          err?.response?.data?.message ||
//            err?.message ||
//            "Login failed. Please try again."
//        );
//      } finally {
//        setLoading(false);
//      }
//    };

//    return (
//      <div className="relative flex min-h-screen overflow-hidden bg-[#f4f7fb]">
//        {/* Subtle grid background */}
//        <div
//          className="pointer-events-none absolute inset-0 opacity-[0.4]"
//          style={{
//            backgroundImage:
//              "linear-gradient(rgba(0,34,68,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,34,68,0.04) 1px, transparent 1px)",
//            backgroundSize: "48px 48px",
//          }}
//        />

//        {/* LEFT — Brand panel */}
//        <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#001a33] via-[#002244] to-[#003366] px-12 py-12 lg:flex xl:px-16">
//          {/* Glow orbs */}
//          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
//          <div className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
//          <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/5 blur-2xl" />

//          {/* Logo */}
//          <div className="relative z-10">
//            <div className="mb-10 inline-flex items-center rounded-2xl bg-white/95 px-5 py-3 shadow-lg shadow-black/10">
//              <img
//                src={cswLogo}
//                alt="Corvex Steel Wires"
//                className="h-12 w-auto object-contain"
//                onError={(e) => {
//                   fallback if logo path is wrong
//                  e.currentTarget.style.display = "none";
//                }}
//              />
//            </div>

//            <h1 className="max-w-md text-[2.15rem] font-bold leading-[1.2] tracking-tight text-white">
//              Commercial pipeline,
//              <span className="block text-sky-300">built for steel.</span>
//            </h1>

//            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-blue-100/75">
//              Track enquiries, close deals, and manage orders — all in one secure
//              workspace designed for Corvex Steel Wires.
//            </p>
//          </div>

//          {/* Bottom highlights */}
//          <div className="relative z-10 space-y-4">
//            <div className="grid grid-cols-2 gap-3">
//              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 backdrop-blur-sm">
//                <div className="text-lg font-bold text-white">Enquiries</div>
//                <div className="mt-0.5 text-[11px] text-blue-200/70">
//                  From lead to conversion
//                </div>
//              </div>
//              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 backdrop-blur-sm">
//                <div className="text-lg font-bold text-white">Orders</div>
//                <div className="mt-0.5 text-[11px] text-blue-200/70">
//                  Dispatch & payments
//                </div>
//              </div>
//            </div>

//            <div className="flex items-center gap-2.5 text-[11px] text-blue-200/50">
//              <Shield size={13} className="text-sky-400/80" />
//              <span>Secure admin access · Corvex Steel Wires</span>
//            </div>
//          </div>
//        </div>

//        {/* RIGHT — Form */}
//        <div className="relative z-10 flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 xl:px-20">
//          <div className="mx-auto w-full max-w-[400px]">
//            {/* Mobile logo */}
//            <div className="mb-8 flex justify-center lg:hidden">
//              <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
//                <img
//                  src={cswLogo}
//                  alt="Corvex Steel Wires"
//                  className="h-11 w-auto object-contain"
//                />
//              </div>
//            </div>

//            <div className="mb-8">
//              <h2 className="text-[1.65rem] font-bold tracking-tight text-slate-900">
//                Welcome back
//              </h2>
//              <p className="mt-2 text-sm text-slate-500">
//                Sign in to your CSW commercial workspace.
//              </p>
//            </div>

//            {successMessage && !error && (
//              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
//                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
//                <span>{successMessage}</span>
//              </div>
//            )}

//            {error && (
//              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
//                <AlertCircle size={18} className="mt-0.5 shrink-0" />
//                <span>{error}</span>
//              </div>
//            )}

//            <form onSubmit={handleSubmit} className="space-y-5">
//              <div>
//                <label
//                  htmlFor="email"
//                  className="mb-1.5 block text-[12px] font-semibold text-slate-600"
//                >
//                  Email address
//                </label>
//                <div className="relative">
//                  <Mail
//                    size={16}
//                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
//                  />
//                  <input
//                    id="email"
//                    type="email"
//                    autoComplete="email"
//                    value={email}
//                    onChange={(e) => setEmail(e.target.value)}
//                    placeholder="you@corvex.com"
//                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10"
//                    disabled={loading}
//                  />
//                </div>
//              </div>

//              <div>
//                <div className="mb-1.5 flex items-center justify-between">
//                  <label
//                    htmlFor="password"
//                    className="block text-[12px] font-semibold text-slate-600"
//                  >
//                    Password
//                  </label>
//                  <button
//                    type="button"
//                    className="text-[11px] font-semibold text-[#002244] hover:underline"
//                    onClick={() =>
//                      alert("Contact your administrator to reset the password.")
//                    }
//                  >
//                    Forgot password?
//                  </button>
//                </div>
//                <div className="relative">
//                  <Lock
//                    size={16}
//                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
//                  />
//                  <input
//                    id="password"
//                    type={showPassword ? "text" : "password"}
//                    autoComplete="current-password"
//                    value={password}
//                    onChange={(e) => setPassword(e.target.value)}
//                    placeholder="••••••••"
//                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10"
//                    disabled={loading}
//                  />
//                  <button
//                    type="button"
//                    onClick={() => setShowPassword((v) => !v)}
//                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
//                    tabIndex={-1}
//                  >
//                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
//                  </button>
//                </div>
//              </div>

//              <button
//                type="submit"
//                disabled={loading}
//                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#002244] text-sm font-semibold text-white shadow-md shadow-[#002244]/25 transition hover:bg-[#00345f] hover:shadow-lg hover:shadow-[#002244]/30 disabled:cursor-not-allowed disabled:opacity-60"
//              >
//                {loading ? (
//                  <>
//                    <Loader2 size={16} className="animate-spin" />
//                    Signing in...
//                  </>
//                ) : (
//                  <>
//                    Sign in
//                    <ArrowRight
//                      size={16}
//                      className="transition group-hover:translate-x-0.5"
//                    />
//                  </>
//                )}
//              </button>
//            </form>

//            <p className="mt-8 text-center text-sm text-slate-500">
//              Need an account?{" "}
//              <Link
//                to="/register"
//                className="font-semibold text-[#002244] hover:underline"
//              >
//                Create admin
//              </Link>
//            </p>

//            <p className="mt-6 text-center text-[11px] text-slate-400">
//              © {new Date().getFullYear()} Corvex Steel Wires · Authorized access only
//            </p>
//          </div>
//        </div>
//      </div>
//    );
//  }

//  export default Login;

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Shield,
  Sparkles,
  TrendingUp,
  PackageCheck,
} from "lucide-react";
import { login } from "../api/api";
import { useAuth } from "../components/AuthContext";
import cswLogo from "../assets/cswlogo.png";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginSuccess } = useAuth();

  const successMessage = location.state?.message || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await login({
        email: email.trim(),
        password,
      });

      const { token, user } = response?.data?.data || {};

      if (!token) {
        throw new Error("No token received");
      }

      loginSuccess(token, user);

      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    } catch (err) {
      console.error("Login error:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans antialiased">
      <div className="flex min-h-screen">

        {/* =========================================================
            LEFT — BRAND PANEL
        ========================================================= */}
        <section className="relative hidden w-[48%] overflow-hidden bg-gradient-to-br from-[#020b14] via-[#001830] to-[#002244] p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">

          {/* Background decoration */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-sky-500/15 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-32 -right-20 h-[30rem] w-[30rem] rounded-full bg-blue-600/15 blur-3xl" />

          <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

          {/* Top content */}
          <div className="relative z-10">

            {/* Logo */}
            <div className="mb-12 inline-flex items-center rounded-2xl border border-white/10 bg-white p-4 shadow-2xl">
              <img
                src={cswLogo}
                alt="Corvex Steel Wires"
                className="h-11 w-auto object-contain"
              />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300">
              <Sparkles size={13} />
              <span>Commercial Enterprise Portal</span>
            </div>

            {/* Heading */}
            <h1 className="mt-6 max-w-lg text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl !text-sky-300">
              Commercial pipeline,
              <span className="block bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-200 bg-clip-text text-sky-300">
                built for steel.
              </span>
            </h1>

            {/* Description */}
            <p className="mt-6 max-w-md text-base leading-relaxed text-slate-300">
              Track enquiries, close deals, and manage orders — all in one
              secure, high-performance workspace tailored for Corvex Steel
              Wires.
            </p>
          </div>

          {/* Bottom content */}
          <div className="relative z-10 space-y-6">

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-4">

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition hover:border-sky-400/30 hover:bg-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
                    <TrendingUp size={16} />
                  </div>

                  <span className="text-sm font-semibold text-white">
                    Enquiries
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  From lead generation to seamless conversion.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition hover:border-cyan-400/30 hover:bg-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                    <PackageCheck size={16} />
                  </div>

                  <span className="text-sm font-semibold text-white">
                    Orders
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Dispatch status and payment tracking.
                </p>
              </div>

            </div>

            {/* Security */}
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <Shield size={14} className="text-sky-400" />
              <span>
                Secure access · Corvex Steel Wires Workspace
              </span>
            </div>

          </div>
        </section>

        {/* =========================================================
            RIGHT — LOGIN
        ========================================================= */}
        <section className="flex min-h-screen w-full flex-1 items-center justify-center bg-white px-6 py-12 sm:px-10 lg:px-14 xl:px-20">

          <div className="w-full max-w-[400px]">

            {/* Mobile logo */}
            <div className="mb-10 flex justify-center lg:hidden">
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
                <img
                  src={cswLogo}
                  alt="Corvex Steel Wires"
                  className="h-10 w-auto object-contain"
                />
              </div>
            </div>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-[1.7rem] font-bold tracking-tight text-slate-900">
                Welcome back
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Sign in to your CSW commercial workspace.
              </p>
            </div>

            {/* Success message */}
            {successMessage && !error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <span>{successMessage}</span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <span>{error}</span>
              </div>
            )}

            {/* =====================================================
                FORM
            ===================================================== */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Email address
                </label>

                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@corvex.com"
                    disabled={loading}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      alert(
                        "Contact your administrator to reset the password."
                      )
                    }
                    className="text-[11px] font-semibold text-[#002244] transition hover:text-[#00345f] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    tabIndex={-1}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#002244] text-sm font-semibold text-white shadow-md shadow-[#002244]/20 transition hover:bg-[#00345f] hover:shadow-lg hover:shadow-[#002244]/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in

                    <ArrowRight
                      size={16}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>
            </form>

            {/* Register */}
            <p className="mt-8 text-center text-sm text-slate-500">
              Need an account?{" "}
              <Link
                to="/register"
                className="font-semibold text-[#002244] transition hover:text-[#00345f] hover:underline"
              >
                Create admin
              </Link>
            </p>

            {/* Footer */}
            <p className="mt-8 text-center text-xs text-slate-400">
              © {new Date().getFullYear()} Corvex Steel Wires · Authorized
              access only
            </p>

          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;