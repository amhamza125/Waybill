// Formatting helpers: dates, countdowns, labels. No chain data is invented
// here — everything renders values already read from the contract.

export function timeAgo(unix) {
  const t = Number(unix) || 0;
  if (!t) return "—";
  const now = Math.floor(Date.now() / 1000);
  const d = now - t;
  if (d < 0) return "in the future";
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  const days = Math.floor(d / 86400);
  if (days < 30) return `${days}d ago`;
  return fmtDate(t);
}

export function fmtDate(unix) {
  const t = Number(unix) || 0;
  if (!t) return "—";
  const d = new Date(t * 1000);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${hh}:${mm} UTC`;
}

/** "5h 12m left" / "expired 2h ago" for appeal deadlines. */
export function fmtCountdown(deadlineUnix) {
  const dl = Number(deadlineUnix) || 0;
  if (!dl) return "—";
  const now = Math.floor(Date.now() / 1000);
  const d = dl - now;
  const abs = Math.abs(d);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : `${abs % 60}s`;
  return d > 0 ? `${s} left` : `expired ${s} ago`;
}

export function isExpired(deadlineUnix) {
  const dl = Number(deadlineUnix) || 0;
  return dl > 0 && dl <= Math.floor(Date.now() / 1000);
}

const STATUS_LABELS = {
  CREATED: "Created",
  IN_TRANSIT: "In transit",
  IN_REVIEW: "In review",
  AWAITING_APPEAL: "Awaiting appeal",
  APPEALED: "Appealed",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
  PENDING: "Pending",
  SETTLED: "Settled",
  ABORTED: "Aborted",
};

export function statusLabel(s) {
  return STATUS_LABELS[s] || s || "—";
}

const VERDICT_LABELS = {
  INTACT: "Intact",
  MINOR_DAMAGE: "Minor damage",
  MAJOR_DAMAGE: "Major damage",
  TOTAL_LOSS: "Total loss",
  "N/A": "Not graded",
};

export function verdictLabel(v) {
  return VERDICT_LABELS[v] || v || "—";
}

export const TERMINAL_STATUSES = new Set(["RESOLVED", "CANCELLED", "SETTLED", "ABORTED"]);
export const ACTIVE_STATUSES = new Set(["CREATED", "IN_TRANSIT", "IN_REVIEW", "AWAITING_APPEAL", "APPEALED", "PENDING"]);

/** Map a shipment's own status to a filter-bucket. */
export function filterBucket(shipment) {
  const legs = shipment.is_multileg ? shipment.legs || [] : [];
  const legAwaiting = legs.some((l) => l.status === "AWAITING_APPEAL" || l.status === "APPEALED");
  switch (shipment.status) {
    case "CREATED":
    case "IN_TRANSIT":
      return legAwaiting ? "appeal" : "transit";
    case "IN_REVIEW":
      return "review";
    case "AWAITING_APPEAL":
    case "APPEALED":
      return "appeal";
    case "RESOLVED":
      return "resolved";
    case "CANCELLED":
      return "cancelled";
    default:
      return legAwaiting ? "appeal" : "transit";
  }
}

/** Parse a JSON-string field that may be "" (shipment.appeal / leg.appeal). */
export function parseAppeal(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Shorten wei (string/bigint) to a compact GEN label for stat cards. */
export function compactGen(wei) {
  try {
    const w = BigInt(wei);
    const whole = w / 10n ** 18n;
    if (whole >= 1000000n) return `${(Number(whole) / 1e6).toFixed(2)}M GEN`;
    if (whole >= 1000n) return `${(Number(whole) / 1e3).toFixed(2)}k GEN`;
    return `${whole.toString()} GEN`;
  } catch {
    return "0 GEN";
  }
}
