import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { register } from "../api/api";

import cswLogo from "../assets/cswlogo.png"; // adjust path if needed

// const ROLE_OPTIONS = [
//   { value: "Admin", label: "Admin", desc: "Full system access" },
//   { value: "Sales Manager", label: "Sales Manager", desc: "Team & deals" },
//   { value: "Sales Executive", label: "Sales Executive", desc: "Handle enquiries" },
//   { value: "Viewer", label: "Viewer", desc: "Read-only access" },
// ];

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    // role: "Admin",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        // role: form.role,
      });

      setSuccess(true);

      setTimeout(() => {
        navigate("/login", {
          state: { message: "Account created successfully. Please sign in." },
        });
      }, 1400);
    } catch (err) {
      console.error("Register error:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#f4f7fb]">
      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,34,68,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,34,68,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* LEFT */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#001a33] via-[#002244] to-[#003366] px-12 py-12 lg:flex xl:px-14">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="relative z-10">
          <div className="mb-10 inline-flex items-center rounded-2xl bg-white/95 px-5 py-3 shadow-lg shadow-black/10">
            <img
              src={cswLogo}
              alt="Corvex Steel Wires"
              className="h-12 w-auto object-contain"
            />
          </div>

          <h1 className="max-w-sm text-[2rem] font-bold leading-[1.2] tracking-tight !text-sky-300">
            Create your
            <span className="block text-sky-300">admin account</span>
          </h1>

          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-blue-100/75">
            Set up secure access for Corvex Steel Wires commercial operations.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 backdrop-blur-sm">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" />
            <div>
              <p className="text-xs font-semibold text-white">Secure by design</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-blue-100/70">
                Passwords are hashed. 
              </p>
            </div>
          </div>

          <p className="text-[11px] text-blue-200/45">
            © {new Date().getFullYear()} Corvex Steel Wires
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="relative z-10 flex w-full flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-6 flex justify-center lg:hidden">
            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              <img
                src={cswLogo}
                alt="Corvex Steel Wires"
                className="h-11 w-auto object-contain"
              />
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-[1.65rem] font-bold tracking-tight text-slate-900">
              Create account
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Register a new admin or team member.
            </p>
          </div>

          {success && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span>Account created. Redirecting to login...</span>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">
                Full name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={form.name}
                  onChange={update("name")}
                  placeholder="John Doe"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10"
                  disabled={loading || success}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">
                Email address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  placeholder="admin@corvex.com"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10"
                  disabled={loading || success}
                />
              </div>
            </div>

            {/* Role */}
            {/* <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">
                Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, role: opt.value }))
                    }
                    disabled={loading || success}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      form.role === opt.value
                        ? "border-[#002244] bg-[#002244]/[0.06] ring-2 ring-[#002244]/15"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`text-xs font-semibold ${
                        form.role === opt.value
                          ? "text-[#002244]"
                          : "text-slate-700"
                      }`}
                    >
                      {opt.label}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div> */}

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={update("password")}
                  placeholder="Min. 6 characters"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10"
                  disabled={loading || success}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm */}
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">
                Confirm password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showConfirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={update("confirmPassword")}
                  placeholder="Re-enter password"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-4 focus:ring-[#002244]/10"
                  disabled={loading || success}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="group mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#002244] text-sm font-semibold text-white shadow-md shadow-[#002244]/25 transition hover:bg-[#00345f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating account...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={16} />
                  Account created
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight
                    size={16}
                    className="transition group-hover:translate-x-0.5"
                  />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-[#002244] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;