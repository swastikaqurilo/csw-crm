import { Bell, Search } from "lucide-react";

function Header() {
  return (
    <header className="header">
      <div className="header-search">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search enquiries, contacts..."
        />
      </div>

      <div className="header-right">
        <button className="icon-button">
          <Bell size={19} />
          <span className="notification-dot"></span>
        </button>

        <div className="header-user">
          <div className="user-avatar">A</div>

          <div>
            <strong>Admin</strong>
            <span>Administrator</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;