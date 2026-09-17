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
  Landmark
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";

const mainItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Enquiries", path: "/enquiries", icon: Inbox },
  { name: "Contacts", path: "/contacts", icon: Users },
  { name: "Follow-ups", path: "/follow-ups", icon: CalendarCheck },
  { name: "Reports", path: "/reports", icon: BarChart3 },
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
];

function SidebarSection({ label, items, isOpen, onToggle, collapsed }) {
  return (
    <div className="sidebar-section">
      {!collapsed && (
        <button className="nav-section-header" onClick={onToggle}>
          <span>{label}</span>
          <ChevronDown
            size={14}
            className={`section-chevron ${isOpen ? "open" : ""}`}
          />
        </button>
      )}

      <div
        className={`section-items ${
          collapsed || isOpen ? "expanded" : "collapsed"
        }`}
      >
        <div className="section-items-inner">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
                title={collapsed ? item.name : undefined}
              >
                <Icon size={18} strokeWidth={1.75} />
                {!collapsed && <span>{item.name}</span>}
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
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">C</div>
        {!collapsed && (
          <div className="logo-text">
            <h2>CSW</h2>
            <span>ERP</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
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

        {/* SYSTEM */}
        <div className="sidebar-section">
          {!collapsed && (
            <button
              className="nav-section-header"
              onClick={() => toggleSection("system")}
            >
              <span>SYSTEM</span>
              <ChevronDown
                size={14}
                className={`section-chevron ${
                  openSections.system ? "open" : ""
                }`}
              />
            </button>
          )}

          <div
            className={`section-items ${
              collapsed || openSections.system ? "expanded" : "collapsed"
            }`}
          >
            <div className="section-items-inner">
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
                title={collapsed ? "Settings" : undefined}
              >
                <Settings size={18} strokeWidth={1.75} />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom: User + Collapse Toggle */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="user-avatar">A</div>
          {!collapsed && (
            <div className="user-info">
              <strong>Admin</strong>
              <span>Administrator</span>
            </div>
          )}
        </div>

        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;