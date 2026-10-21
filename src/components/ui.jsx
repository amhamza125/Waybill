// Shared presentational building blocks for the Waybill dashboard.
// Everything here renders data already read from the chain — no mock values.

import { useEffect, useState } from "react";
import { shortAddress, explorerAddressUrl, explorerTxUrl, weiToGen } from "../lib/genlayer";
import { fmtCountdown, statusLabel, verdictLabel } from "../lib/format";

/* ---------------- icons (inline SVG, no dependency) ---------------- */

const svg = (paths, extra) => (props) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className || ""}
    {...extra}
  >
    {paths}
  </svg>
);

export const IconDashboard = svg(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>);
export const IconTruck = svg(<><path d="M1 8h13v9H1z" /><path d="M14 11h4l3 3v3h-7z" /><circle cx="6" cy="19" r="1.6" /><circle cx="17.5" cy="19" r="1.6" /></>);
export const IconHistory = svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>);
export const IconTrophy = svg(<><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a1 1 0 0 0-1 1c0 2.5 2 4.5 4.5 4.5M17 6h3a1 1 0 0 1 1 1c0 2.5-2 4.5-4.5 4.5" /></>);
export const IconGear = svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87 1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" /></>);
export const IconShield = svg(<><path d="M12 2l8 3.5v5.2c0 5-3.4 9.3-8 10.8-4.6-1.5-8-5.8-8-10.8V5.5z" /><path d="M9 12l2 2 4-4" /></>);
export const IconPlus = svg(<><path d="M12 5v14M5 12h14" /></>);
export const IconCopy = svg(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>);
export const IconExternal = svg(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14L21 3" /></>);
export const IconBell = svg(<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>);
export const IconWallet = svg(<><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M2 10h20M16 15h2" /></>);
export const IconCheck = svg(<><path d="M20 6L9 17l-5-5" /></>);
export const IconX = svg(<><path d="M18 6L6 18M6 6l12 12" /></>);
export const IconAlert = svg(<><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>);
export const IconCamera = svg(<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>);
export const IconGavel = svg(<><path d="M14 13l-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10" /><path d="M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8" /></>);
export const IconClock = svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>);
export const IconBox = svg(<><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>);
export const IconSun = svg(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const IconMoon = svg(<><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></>);
export const IconSearch = svg(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>);
export const IconDownload = svg(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>);

/* ---------------- pills ---------------- */

const STATUS_STYLES = {
  CREATED: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  IN_TRANSIT: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  PENDING: "bg-stone-200 text-stone-700 border-stone-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  IN_REVIEW: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  AWAITING_APPEAL: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  APPEALED: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
  RESOLVED: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  SETTLED: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  CANCELLED: "bg-stone-200 text-stone-600 border-stone-300 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/25",
  ABORTED: "bg-stone-200 text-stone-600 border-stone-300 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/25",
};

export function StatusPill({ status, pulse }) {
  const cls = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${cls} ${pulse ? "critical-pulse" : ""}`}
    >
      {statusLabel(status)}
    </span>
  );
}

const VERDICT_STYLES = {
  INTACT: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  MINOR_DAMAGE: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  MAJOR_DAMAGE: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  TOTAL_LOSS: "bg-red-100 text-red-900 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  "N/A": "bg-stone-200 text-stone-500 border-stone-300 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/25",
};

export function VerdictPill({ verdict, confidence }) {
  const cls = VERDICT_STYLES[verdict] || VERDICT_STYLES["N/A"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {verdictLabel(verdict)}
      {confidence > 0 && <span className="opacity-70">{confidence}%</span>}
    </span>
  );
}

/* ---------------- cards & layout ---------------- */

export function SectionHeader({ title, sub, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-bold text-inktext dark:text-white">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-stone-500 dark:text-slate-400">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, accent }) {
  return (
    <div className="card card-hover animate-enter p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="stat-label">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-inktext dark:text-white sm:text-3xl">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">{sub}</p>}
        </div>
        {icon && (
          <span className={`rounded-xl p-2.5 ${accent || "bg-amber-500/15 text-branddeep dark:text-brand"}`}>
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {icon && <span className="mb-3 rounded-2xl bg-amber-500/15 p-3 text-branddeep dark:text-brand">{icon}</span>}
      <h3 className="font-display text-lg font-bold text-inktext dark:text-white">{title}</h3>
      {body && <p className="mt-2 max-w-md text-sm text-stone-500 dark:text-slate-400">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-stone-500 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

/* ---------------- addresses & links ---------------- */

export function Addr({ value, onCopy, className }) {
  if (!value) return <span className="text-stone-400 dark:text-slate-600">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className || ""}`}>
      <span className="mono" title={value}>{shortAddress(value)}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onCopy && onCopy(value); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onCopy && onCopy(value); } }}
        className="cursor-pointer rounded p-1 text-stone-400 transition-colors hover:bg-black/5 hover:text-branddeep dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-brand"
        title="Copy full address"
      >
        <IconCopy className="!w-3.5 !h-3.5" />
      </span>
    </span>
  );
}

export function TxLink({ hash, children, className }) {
  if (!hash) return null;
  return (
    <a
      href={explorerTxUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 font-semibold text-branddeep hover:underline dark:text-brand ${className || ""}`}
      title="View transaction in the StudioNet explorer"
    >
      {children || shortAddress(hash)}
      <IconExternal className="!w-3.5 !h-3.5" />
    </a>
  );
}

/* ---------------- countdown (self-updating) ---------------- */

export function Countdown({ deadline }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  return <span className="mono">{fmtCountdown(deadline)}</span>;
}

/* ---------------- misc ---------------- */

export function Wei({ wei, className }) {
  return <span className={`mono ${className || ""}`}>{weiToGen(wei)} GEN</span>;
}

export function ProgressBar({ pct, className }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10 ${className || ""}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`spinner ${className || ""}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className || "h-9 w-9"} fill="none">
      <rect x="4" y="10" width="40" height="28" rx="6" fill="#b45309" />
      <rect x="4" y="10" width="40" height="28" rx="6" stroke="#f59e0b" strokeWidth="2" />
      <path d="M4 20h40M24 10v28" stroke="#f6f1e6" strokeWidth="2" opacity="0.55" />
      <circle cx="24" cy="24" r="9" fill="#070b14" stroke="#fbbf24" strokeWidth="2.5" />
      <path d="M20 24l3 3 5-6" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
