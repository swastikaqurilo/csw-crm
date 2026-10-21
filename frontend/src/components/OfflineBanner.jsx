// import { useEffect, useState } from "react";
// import { OUTBOX_EVENT, outboxCounts } from "../db/outbox";

// export default function OfflineBanner() {
//   const [online, setOnline] = useState(() =>
//     typeof navigator === "undefined" ? true : navigator.onLine
//   );
//   const [counts, setCounts] = useState({ pending: 0, failed: 0 });

//   useEffect(() => {
//     const refreshCounts = () => {
//       outboxCounts().then(setCounts).catch(() => {});
//     };

//     const handleOnline = () => {
//       setOnline(true);
//       refreshCounts();
//     };
//     const handleOffline = () => setOnline(false);

//     window.addEventListener("online", handleOnline);
//     window.addEventListener("offline", handleOffline);
//     window.addEventListener(OUTBOX_EVENT, refreshCounts);

//     refreshCounts();

//     return () => {
//       window.removeEventListener("online", handleOnline);
//       window.removeEventListener("offline", handleOffline);
//       window.removeEventListener(OUTBOX_EVENT, refreshCounts);
//     };
//   }, []);

//   if (online && counts.pending === 0 && counts.failed === 0) return null;

//   const parts = [];

//   if (!online) {
//     parts.push("Offline — changes are saved on this device and sync automatically.");
//   }

//   if (counts.pending > 0) {
//     parts.push(
//       `${counts.pending} change${counts.pending === 1 ? "" : "s"} queued.`
//     );
//   }

//   if (counts.failed > 0) {
//     parts.push(
//       `${counts.failed} change${counts.failed === 1 ? "" : "s"} couldn't be saved.`
//     );
//   }

//   if (!parts.length) return null;

//   const tone =
//     counts.failed > 0
//       ? "border-rose-200 bg-rose-50 text-rose-800"
//       : online
//       ? "border-amber-200 bg-amber-50 text-amber-800"
//       : "border-slate-300 bg-slate-100 text-slate-700";

//   return (
//     <div role="status" className={`border-b px-6 py-2 text-xs font-medium ${tone}`}>
//       {parts.join(" ")}
//     </div>
//   );
// }