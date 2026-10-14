import {
  LayoutDashboard,
  Inbox,
  Users,
  CalendarCheck,
  Package,
  Warehouse,
  ShoppingCart,
  CreditCard,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Landmark,
  ReceiptText,
  Menu,
  X,
  BadgeIndianRupee,
  ContactRound,UserCheck,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import logo from "../assets/cswlogo.png";

const mainItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Enquiries", path: "/enquiries", icon: Inbox },
  { name: "Contacts", path: "/contacts", icon: Users },
  { name: "Follow-ups", path: "/follow-ups", icon: CalendarCheck },
];

const businessItems = [
  { name: "Products", path: "/products", icon: Package },
  { name: "Raw Materials", path: "/rawmats", icon: Warehouse },
  { name: "Orders", path: "/orders", icon: ShoppingCart },
];

const employeeItems = [
  {name: "Workers", path: "/worker", icon: ContactRound},
  {name: "Salary", path: "/salary", icon: BadgeIndianRupee},
  {name: "Attendance", path: "/attendance", icon: UserCheck},
];

const financeItems = [
  { name: "Payments", path: "/payments", icon: CreditCard },
  { name: "Accounting", path: "/accounting", icon: Landmark },
  { name: "Expenses", path: "/expenses", icon: ReceiptText },
];

const systemItems = [
  { name: "Settings", path: "/settings", icon: Settings },
];

function SidebarSection({ label, items, isOpen, onToggle, collapsed, onItemClick }) {
  return (
    <div className="px-2">
      {!collapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-slate-400 transition-colors duration-200 hover:bg-white/[0.04] hover:text-slate-200"
        >
          <span className="transition-colors duration-200">{label}</span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={`transition-transform duration-300 ease-out ${
              isOpen ? "rotate-0" : "-rotate-90"
            } group-hover:text-slate-300`}
          />
        </button>
      )}

      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          collapsed || isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.name : undefined}
                onClick={onItemClick}
                className={({ isActive }) =>
                  [
                    "group relative flex h-11 items-center overflow-hidden rounded-md",
                    "text-sm font-medium",
                    "transition-all duration-200 ease-out",
                    collapsed ? "justify-center px-0" : "gap-3 px-3",
                    isActive
                      ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Left accent bar */}
                    <span
                      className={[
                        "pointer-events-none absolute left-0 top-1/2 -translate-y-1/2",
                        "h-6 w-[3px] rounded-r-full bg-gradient-to-b from-sky-400 to-cyan-500",
                        "origin-center transition-all duration-300 ease-out",
                        isActive
                          ? "scale-y-100 opacity-100"
                          : "scale-y-0 opacity-0 group-hover:scale-y-75 group-hover:opacity-60",
                      ].join(" ")}
                    />

                    {/* Soft hover glow behind icon (only when collapsed) */}
                    {collapsed && (
                      <span className="pointer-events-none absolute inset-0 rounded-md bg-white/0 transition-colors duration-200 group-hover:bg-white/[0.06]" />
                    )}

                    <Icon
                      size={20}
                      strokeWidth={1.75}
                      className={[
                        "relative shrink-0 transition-all duration-200 ease-out",
                        isActive
                          ? "text-sky-300"
                          : "text-slate-500 group-hover:text-slate-200 group-hover:scale-[1.06]",
                      ].join(" ")}
                    />

                    {!collapsed && (
                      <span
                        className={[
                          "relative truncate transition-transform duration-200 ease-out",
                          isActive ? "translate-x-0" : "group-hover:translate-x-0.5",
                        ].join(" ")}
                      >
                        {item.name}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const [openSections, setOpenSections] = useState({
    main: false,
    business: false,
    finance: false,
    system: false,
    employee: false,
  });

  const location = useLocation();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const effectiveCollapsed = isDesktop && collapsed;

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-md transition-colors hover:bg-slate-50 active:bg-slate-100 lg:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Mobile backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col",
          "border-r border-slate-800 bg-[#0f172a] text-white",
          "transition-[width,transform] duration-200 ease-out",
          "lg:sticky lg:top-0 lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          "w-[250px]",
          collapsed ? "lg:w-[68px]" : "lg:w-[250px]",
        ].join(" ")}
      >
        {/* Logo header */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-white/10 ${
            effectiveCollapsed ? "justify-center px-2" : "gap-3 px-4"
          }`}
        >
          <div
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-white/20 ${
              effectiveCollapsed ? "h-10 w-10" : "h-12 w-12"
            }`}
          >
            <img
              src={logo}
              alt="CSW Logo"
              className="h-full w-full object-contain p-1"
            />
          </div>

          {!effectiveCollapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="text-[15px] font-bold leading-none tracking-tight text-white">
                CSW
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          <div className="space-y-2">
            <SidebarSection
              label="MAIN"
              items={mainItems}
              isOpen={openSections.main}
              onToggle={() => toggleSection("main")}
              collapsed={effectiveCollapsed}
              onItemClick={() => setMobileOpen(false)}
            />
            <SidebarSection
              label="BUSINESS"
              items={businessItems}
              isOpen={openSections.business}
              onToggle={() => toggleSection("business")}
              collapsed={effectiveCollapsed}
              onItemClick={() => setMobileOpen(false)}
            />
            <SidebarSection
              label="FINANCE"
              items={financeItems}
              isOpen={openSections.finance}
              onToggle={() => toggleSection("finance")}
              collapsed={effectiveCollapsed}
              onItemClick={() => setMobileOpen(false)}
            />
            <SidebarSection
              label="EMPLOYEE"
              items={employeeItems}
              isOpen={openSections.employee}
              onToggle={() => toggleSection("employee")}
              collapsed={effectiveCollapsed}
              onItemClick={() => setMobileOpen(false)}
            />  
            <SidebarSection
              label="SYSTEM"
              items={systemItems}
              isOpen={openSections.system}
              onToggle={() => toggleSection("system")}
              collapsed={effectiveCollapsed}
              onItemClick={() => setMobileOpen(false)}
            />
          </div>
        </nav>

        {/* Footer */}
        <div
          className={`shrink-0 border-t border-white/10 p-2 ${
            effectiveCollapsed ? "space-y-2" : ""
          }`}
        >
          <div
            className={`flex items-center rounded-md ${
              effectiveCollapsed ? "justify-center px-0 py-2" : "gap-3 px-2 py-2"
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              A
            </div>
            {!effectiveCollapsed && (
              <div className="min-w-0">
                <strong className="block truncate text-xs font-semibold text-white">
                  Admin
                </strong>
                <span className="block truncate text-[10px] text-slate-400">
                  Administrator
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="mt-1 hidden h-9 w-full items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white lg:flex"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;