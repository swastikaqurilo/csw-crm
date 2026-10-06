import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, CreditCard, FileText, Hash, Settings as SettingsIcon,
  Save, X, Loader2, CheckCircle2, AlertCircle, LogOut,
} from "lucide-react";
import { getSettings, updateSettings, logout } from "../api/api";

const TABS = [
  { id: "seller",      label: "Business Profile", icon: Building2 },
  { id: "bank",        label: "Bank Details",     icon: CreditCard },
  { id: "invoice",     label: "Invoice Defaults", icon: FileText },
  { id: "numbering",   label: "Numbering",        icon: Hash },
  { id: "preferences", label: "Preferences",      icon: SettingsIcon },
];

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600";

const primaryBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed";

const secondaryBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";

const EMPTY = {
  seller: {
    name: "", legalName: "", address: "", addressLine2: "", city: "", state: "",
    stateCode: "", pincode: "", country: "India", gstin: "", pan: "", cin: "",
    msme: "", phone: "", email: "", website: "",
  },
  bank: { accountName: "", accountNumber: "", bankName: "", ifsc: "", branch: "", upiId: "" },
  invoice: {
    prefix: "INV", defaultHsn: "7217", defaultGstRate: 18, taxMode: "CGST_SGST",
    defaultDueDays: 30, roundOffEnabled: true, termsAndConditions: "",
    declaration: "", footerNote: "",
  },
  numbering: { orderPrefix: "ORD", paymentPrefix: "PAY" },
  preferences: {
    currency: "INR", timezone: "Asia/Kolkata", dateFormat: "DD MMM YYYY",
    financialYearStart: "04-01", lowStockThreshold: 10,
  },
};

function Settings() {
  const [activeTab, setActiveTab] = useState("seller");
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [dirty, setDirty] = useState(false);

  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getSettings();
      const d = res?.data?.data || {};
      setForm({
        seller: { ...EMPTY.seller, ...(d.seller || {}) },
        bank: { ...EMPTY.bank, ...(d.bank || {}) },
        invoice: { ...EMPTY.invoice, ...(d.invoice || {}) },
        numbering: { ...EMPTY.numbering, ...(d.numbering || {}) },
        preferences: { ...EMPTY.preferences, ...(d.preferences || {}) },
      });
      setDirty(false);
    } catch (err) {
      setToast({ type: "error", msg: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  const onChange = (section, field, value) => {
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
    setDirty(true);
  };

  /* Warn on tab close / refresh when there are unsaved changes */
  useEffect(() => {
    const handler = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /* ---------- LOGOUT ---------- */

  const requestLogout = () => {
    if (dirty) {
      setConfirm({
        title: "Discard unsaved changes?",
        message:
          "You have unsaved settings. Logging out now will discard those changes permanently.",
        confirmLabel: "Discard & log out",
        tone: "warning",
        onConfirm: performLogout,
      });
      return;
    }

    setConfirm({
      title: "Log out?",
      message:
        "You'll be signed out of your admin session and will need to log in again to access the dashboard.",
      confirmLabel: "Log out",
      tone: "danger",
      onConfirm: performLogout,
    });
  };

  const performLogout = async () => {
    setConfirm(null);

    try {
      setLoggingOut(true);

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("notifications:readIds");

      try {
        await logout();
      } catch (err) {
        console.warn("[logout] server call failed, continuing:", err);
      }

      navigate("/login", {
        replace: true,
        state: { toast: { type: "success", msg: "You've been logged out." } },
      });
    } catch (err) {
      console.error("[logout] failed:", err);
      setToast({
        type: "error",
        msg: "Logout failed. Please try again.",
      });
    } finally {
      setLoggingOut(false);
    }
  };

  /* ---------- SAVE ---------- */

  const save = async () => {
    try {
      setSaving(true);
      setToast(null);
      await updateSettings(form);
      setToast({ type: "success", msg: "Settings saved successfully" });
      setDirty(false);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({
        type: "error",
        msg: err?.response?.data?.message || "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 pb-6">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Workspace · Configuration
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">
            Settings
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            Configure your business identity, invoicing defaults, and numbering.
            These values auto-fill every order and invoice.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={requestLogout}
            disabled={loggingOut || saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-600 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogOut size={16} />
            )}
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      </div>

      {/* ============ TOAST ============ */}
      {toast && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span className="flex-1">{toast.msg}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="flex h-5 w-5 items-center justify-center rounded text-current opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ============ TABS ============ */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all ${
                active
                  ? "bg-[#0f172a] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ============ PANELS ============ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {activeTab === "seller" && (
          <Section title="Business Profile" subtitle="Appears on all invoices as the seller">
            <Grid>
              <Field label="Business Name *" value={form.seller.name}
                onChange={(v) => onChange("seller", "name", v)} />
              <Field label="Legal Name" value={form.seller.legalName}
                onChange={(v) => onChange("seller", "legalName", v)} />
              <Field label="GSTIN *" value={form.seller.gstin} maxLength={15}
                onChange={(v) => onChange("seller", "gstin", v.toUpperCase())} />
              <Field label="PAN" value={form.seller.pan} maxLength={10}
                onChange={(v) => onChange("seller", "pan", v.toUpperCase())} />
              <Field label="CIN" value={form.seller.cin}
                onChange={(v) => onChange("seller", "cin", v.toUpperCase())} />
              <Field label="MSME / Udyam" value={form.seller.msme}
                onChange={(v) => onChange("seller", "msme", v)} />

              <Field span={2} label="Address Line 1 *" value={form.seller.address}
                onChange={(v) => onChange("seller", "address", v)} />
              <Field span={2} label="Address Line 2" value={form.seller.addressLine2}
                onChange={(v) => onChange("seller", "addressLine2", v)} />
              <Field label="City" value={form.seller.city}
                onChange={(v) => onChange("seller", "city", v)} />
              <Field label="Pincode" value={form.seller.pincode}
                onChange={(v) => onChange("seller", "pincode", v)} />
              <Field label="State *" value={form.seller.state}
                onChange={(v) => onChange("seller", "state", v)} />
              <Field label="State Code * (2 digits)" value={form.seller.stateCode} maxLength={2}
                onChange={(v) => onChange("seller", "stateCode", v)} />

              <Field label="Phone" value={form.seller.phone}
                onChange={(v) => onChange("seller", "phone", v)} />
              <Field label="Email" value={form.seller.email}
                onChange={(v) => onChange("seller", "email", v)} />
              <Field label="Website" value={form.seller.website}
                onChange={(v) => onChange("seller", "website", v)} />
              <div />
            </Grid>
          </Section>
        )}

        {activeTab === "bank" && (
          <Section title="Bank Details" subtitle="Printed on invoices for customer payments">
            <Grid>
              <Field label="Account Name" value={form.bank.accountName}
                onChange={(v) => onChange("bank", "accountName", v)} />
              <Field label="Account Number" value={form.bank.accountNumber}
                onChange={(v) => onChange("bank", "accountNumber", v)} />
              <Field label="Bank Name" value={form.bank.bankName}
                onChange={(v) => onChange("bank", "bankName", v)} />
              <Field label="IFSC" value={form.bank.ifsc} maxLength={11}
                onChange={(v) => onChange("bank", "ifsc", v.toUpperCase())} />
              <Field label="Branch" value={form.bank.branch}
                onChange={(v) => onChange("bank", "branch", v)} />
              <Field label="UPI ID" value={form.bank.upiId}
                onChange={(v) => onChange("bank", "upiId", v)} />
            </Grid>
          </Section>
        )}

        {activeTab === "invoice" && (
          <Section title="Invoice Defaults" subtitle="Auto-filled on every new invoice">
            <Grid>
              <Field label="Invoice Prefix" value={form.invoice.prefix}
                onChange={(v) => onChange("invoice", "prefix", v.toUpperCase())} />
              <Field label="Default HSN Code" value={form.invoice.defaultHsn}
                onChange={(v) => onChange("invoice", "defaultHsn", v)} />
              <Field label="Default GST Rate (%)" type="number" value={form.invoice.defaultGstRate}
                onChange={(v) => onChange("invoice", "defaultGstRate", Number(v))} />
              <Select label="Tax Mode" value={form.invoice.taxMode}
                options={[
                  { value: "CGST_SGST", label: "CGST + SGST (Intra-state)" },
                  { value: "IGST", label: "IGST (Inter-state)" },
                ]}
                onChange={(v) => onChange("invoice", "taxMode", v)} />
              <Field label="Default Due Days" type="number" value={form.invoice.defaultDueDays}
                onChange={(v) => onChange("invoice", "defaultDueDays", Number(v))} />
              <Toggle label="Round-off invoice total" checked={form.invoice.roundOffEnabled}
                onChange={(v) => onChange("invoice", "roundOffEnabled", v)} />

              <Field span={2} label="Terms & Conditions" textarea rows={3}
                value={form.invoice.termsAndConditions}
                onChange={(v) => onChange("invoice", "termsAndConditions", v)} />
              <Field span={2} label="Declaration" textarea rows={3}
                value={form.invoice.declaration}
                onChange={(v) => onChange("invoice", "declaration", v)} />
              <Field span={2} label="Footer Note" textarea rows={2}
                value={form.invoice.footerNote}
                onChange={(v) => onChange("invoice", "footerNote", v)} />
            </Grid>
          </Section>
        )}

        {activeTab === "numbering" && (
          <Section title="Document Numbering" subtitle="Prefixes used when auto-generating documents">
            <Grid>
              <Field label="Order Prefix" value={form.numbering.orderPrefix}
                onChange={(v) => onChange("numbering", "orderPrefix", v.toUpperCase())} />
              <Field label="Payment Prefix" value={form.numbering.paymentPrefix}
                onChange={(v) => onChange("numbering", "paymentPrefix", v.toUpperCase())} />
            </Grid>
            <p className="mt-4 text-[11px] text-slate-500">
              Example: <span className="font-mono">{form.numbering.orderPrefix}-2026-0001</span>
            </p>
          </Section>
        )}

        {activeTab === "preferences" && (
          <Section title="Preferences" subtitle="Global formatting and locale">
            <Grid>
              <Field label="Currency" value={form.preferences.currency} maxLength={3}
                onChange={(v) => onChange("preferences", "currency", v.toUpperCase())} />
              <Select label="Timezone" value={form.preferences.timezone}
                options={[
                  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
                  { value: "UTC", label: "UTC" },
                ]}
                onChange={(v) => onChange("preferences", "timezone", v)} />
              <Select label="Date Format" value={form.preferences.dateFormat}
                options={[
                  { value: "DD MMM YYYY", label: "DD MMM YYYY (05 Oct 2026)" },
                  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (05/10/2026)" },
                  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-10-05)" },
                ]}
                onChange={(v) => onChange("preferences", "dateFormat", v)} />
              <Field label="Financial Year Start (MM-DD)" value={form.preferences.financialYearStart}
                onChange={(v) => onChange("preferences", "financialYearStart", v)} />
              <Field label="Low Stock Threshold" type="number" value={form.preferences.lowStockThreshold}
                onChange={(v) => onChange("preferences", "lowStockThreshold", Number(v))} />
            </Grid>
          </Section>
        )}
      </div>

      {/* ============ STICKY SAVE BAR ============ */}
      <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <p className="text-[11px] text-slate-500">
          {dirty ? (
            <span className="font-medium text-amber-600">
              ● You have unsaved changes
            </span>
          ) : (
            "Changes apply immediately to new orders and invoices."
          )}
        </p>
        <div className="flex gap-2">
          <button className={secondaryBtn} onClick={load} disabled={saving || !dirty}>
            Reset
          </button>
          <button className={primaryBtn} onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* ============ CONFIRM DIALOG ============ */}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone}
        loading={loggingOut}
        onConfirm={confirm?.onConfirm}
        onCancel={() => !loggingOut && setConfirm(null)}
      />
    </div>
  );
}

/* ============ CONFIRM DIALOG ============ */
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
  loading = false,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onCancel?.();
      if (e.key === "Enter" && !loading) onConfirm?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm, loading]);

  if (!open) return null;

  const toneClasses = {
    danger: {
      icon: "border-red-200 bg-red-50 text-red-600",
      button: "bg-red-600 hover:bg-red-700 text-white",
    },
    warning: {
      icon: "border-amber-200 bg-amber-50 text-amber-600",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    primary: {
      icon: "border-slate-200 bg-slate-100 text-slate-700",
      button: "bg-[#0f172a] hover:bg-slate-800 text-white",
    },
  };
  const t = toneClasses[tone] || toneClasses.danger;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="w-full max-w-[440px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="flex items-start gap-3 px-5 py-5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${t.icon}`}
          >
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-title" className="text-base font-semibold text-slate-900">
              {title}
            </h3>
            {message && (
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                {message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={secondaryBtn}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${t.button}`}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- tiny layout helpers ---------- */

function Section({ title, subtitle, children }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({ label, value, onChange, type = "text", span = 1, textarea, rows = 3, ...rest }) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : ""}>
      <label className={labelClass}>{label}</label>
      {textarea ? (
        <textarea
          rows={rows}
          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      ) : (
        <input
          className={inputClass}
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            checked ? "left-4" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default Settings;