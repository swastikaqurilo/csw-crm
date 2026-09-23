import {
  LayoutDashboard,
  Inbox,
  Users,
  CalendarCheck,
  BarChart3,
  Package,
  Warehouse,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Landmark,
  ReceiptText,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";

const mainItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Enquiries", path: "/enquiries", icon: Inbox },
  { name: "Contacts", path: "/contacts", icon: Users },
  { name: "Follow-ups", path: "/follow-ups", icon: CalendarCheck },
  // { name: "Reports", path: "/reports", icon: BarChart3 },
];

const businessItems = [
  { name: "Products", path: "/products", icon: Package },
  { name: "Inventory", path: "/inventory", icon: Warehouse },
  { name: "Orders", path: "/orders", icon: ShoppingCart },
];

const financeItems = [
  { name: "Payments", path: "/payments", icon: CreditCard },
  { name: "Revenue", path: "/revenue", icon: TrendingUp },
  { name: "Accounting", path: "/accounting", icon: Landmark },
  { name: "Expenses", path:"/expenses", icon: ReceiptText},
];

const systemItems = [
  { name: "Settings", path: "/settings", icon: Settings },
];

function SidebarSection({
  label,
  items,
  isOpen,
  onToggle,
  collapsed,
}) {
  return (
    <div className="px-2">
      {!collapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold tracking-[0.08em] text-slate-400 transition-colors hover:text-slate-200"
        >
          <span>{label}</span>

          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={`transition-transform duration-200 ${
              isOpen ? "rotate-0" : "-rotate-90"
            }`}
          />
        </button>
      )}

      <div
        className={`overflow-hidden transition-all duration-200 ${
          collapsed || isOpen
            ? "max-h-[500px] opacity-100"
            : "max-h-0 opacity-0"
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
                className={({ isActive }) =>
                  [
                    "group flex h-10 items-center rounded-md",
                    "text-[13px] font-medium",
                    "transition-all duration-150",
                    collapsed
                      ? "justify-center px-0"
                      : "gap-3 px-3",
                    isActive
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      className={
                        isActive
                          ? "shrink-0 text-white"
                          : "shrink-0 text-slate-400 group-hover:text-slate-200"
                      }
                    />

                    {!collapsed && (
                      <span className="truncate">{item.name}</span>
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

  const [openSections, setOpenSections] = useState({
    main: true,
    business: true,
    finance: true,
    system: true,
  });

  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-800 bg-[#0f172a] text-white transition-[width] duration-200 ${
        collapsed ? "w-[68px]" : "w-[250px]"
      }`}
    >
      <div
        className={`flex h-16 shrink-0 items-center border-b border-white/10 ${
          collapsed ? "justify-center px-2" : "gap-3 px-5"
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-[#002244] shadow-sm">
          C
        </div>

        {!collapsed && (
          <div className="flex min-w-0 items-baseline gap-1.5">
            <h2 className="text-base font-bold tracking-tight">
              <div className="text-white">
              CSW
              </div>
            </h2>

            <span className="text-[10px] font-semibold tracking-[0.08em] text-slate-400">
              ERP
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <div className="space-y-2">
          <SidebarSection
            label="MAIN"
            items={mainItems}
            isOpen={openSections.main}
            onToggle={() => toggleSection("main")}
            collapsed={collapsed}
          />

          <SidebarSection
            label="BUSINESS"
            items={businessItems}
            isOpen={openSections.business}
            onToggle={() => toggleSection("business")}
            collapsed={collapsed}
          />

          <SidebarSection
            label="FINANCE"
            items={financeItems}
            isOpen={openSections.finance}
            onToggle={() => toggleSection("finance")}
            collapsed={collapsed}
          />

          <SidebarSection
            label="SYSTEM"
            items={systemItems}
            isOpen={openSections.system}
            onToggle={() => toggleSection("system")}
            collapsed={collapsed}
          />
        </div>
      </nav>

      <div
        className={`shrink-0 border-t border-white/10 p-2 ${
          collapsed ? "space-y-2" : ""
        }`}
      >
        <div
          className={`flex items-center rounded-md ${
            collapsed
              ? "justify-center px-0 py-2"
              : "gap-3 px-2 py-2"
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            A
          </div>

          {!collapsed && (
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
          className={`flex h-9 w-full items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white ${
            collapsed ? "mt-1" : "mt-1"
          }`}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronLeft size={16} />
          )}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;