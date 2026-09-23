import { Bell, Search } from "lucide-react";

function Header() {
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
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          aria-label="Notifications"
        >
          <Bell size={19} />

          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="flex h-10 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#002244] text-sm font-semibold text-white">
            A
          </div>

          <div className="flex flex-col">
            <strong className="text-sm font-semibold leading-tight text-slate-800">
              Admin
            </strong>

            <span className="text-xs leading-tight text-slate-500">
              Administrator
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;