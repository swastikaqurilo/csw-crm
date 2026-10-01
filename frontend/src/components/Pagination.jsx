function Pagination({ page, totalPages, onPage, totalRecords, perPage = 8 }) {
  if (totalRecords <= perPage) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, totalRecords);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] text-slate-500">
        Showing <strong className="font-semibold text-slate-700">{start}</strong> to{" "}
        <strong className="font-semibold text-slate-700">{end}</strong> of{" "}
        <strong className="font-semibold text-slate-700">{totalRecords}</strong> records
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPage(Math.max(page - 1, 1))}
          className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold transition-colors ${
              page === p
                ? "bg-[#0f172a] text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPage(Math.min(page + 1, totalPages))}
          className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Pagination;