// Browser-notification polling for appeal windows and verdict events.
// All triggers derive from on-chain state (shipments + activity log);
// toggles persist to localStorage and do nothing until explicitly enabled.

import { LS_SEEN_KEY } from "./config.js";
import { transcriptLine } from "./transcript.js";

const SIX_HOURS = 6 * 3600;

export function loadSeen() {
  try {
    return JSON.parse(localStorage.getItem(LS_SEEN_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveSeen(seen) {
  try {
    localStorage.setItem(LS_SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* storage full/blocked — notifications just re-fire */
  }
}

export function notificationSupport() {
  return "Notification" in window;
}

export function notificationPermission() {
  if (!notificationSupport()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!notificationSupport()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

function fire(title, body) {
  try {
    new Notification(`Waybill — ${title}`, { body });
  } catch {
    /* headless / blocked: silently skip */
  }
}

/** Appeal windows involving `wallet` closing within 6h. */
export function findAppealWarnings(shipments, wallet) {
  const out = [];
  const w = String(wallet || "").toLowerCase();
  if (!w) return out;
  const now = Math.floor(Date.now() / 1000);
  for (const s of shipments || []) {
    const units = s.is_multileg ? s.legs || [] : [{ ...s, index: null }];
    for (const u of units) {
      const dl = Number(u.appeal_deadline || 0);
      if (!dl || dl <= now || dl - now > SIX_HOURS) continue;
      if (u.status !== "AWAITING_APPEAL") continue;
      const mine =
        String(u.carrier || s.carrier || "").toLowerCase() === w ||
        String(s.shipper || "").toLowerCase() === w;
      if (!mine) continue;
      const legTag = u.index != null ? ` leg ${u.index}` : "";
      out.push({
        key: `warn-${s.id}-${u.index == null ? "s" : u.index}-${dl}`,
        title: `Appeal window closing — shipment #${s.id}${legTag}`,
        body: `${fmtLeft(dl - now)} left to appeal or let it settle.`,
      });
    }
  }
  return out;
}

function fmtLeft(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * New activity-log events (ASSESS / SETTLE / APPEAL_* / LEG_*) concerning the
 * wallet's shipments, since the stored high-water seq mark.
 */
export function findVerdictAlerts(events, shipmentsById, wallet, seenSeq) {
  const out = [];
  const w = String(wallet || "").toLowerCase();
  if (!w) return out;
  const WATCH = new Set([
    "ASSESS",
    "LEG_ASSESS",
    "SETTLE",
    "LEG_SETTLE",
    "APPEAL_FILED",
    "LEG_APPEAL_FILED",
    "APPEAL_RESOLVED",
    "LEG_APPEAL_RESOLVED",
  ]);
  let max = seenSeq || 0;
  for (const e of events || []) {
    const seq = Number(e._seq || 0);
    if (seq > max) max = seq;
    if (seq <= (seenSeq || 0) || !WATCH.has(e.type)) continue;
    const s = shipmentsById[e.shipment_id];
    if (!s) continue;
    const legTag = e.leg_index != null ? ` leg ${e.leg_index}` : "";
    const mine =
      String(s.shipper || "").toLowerCase() === w ||
      String(s.carrier || "").toLowerCase() === w ||
      String(e.appellant || "").toLowerCase() === w;
    if (!mine) continue;
    const label = {
      ASSESS: `Jury verdict recorded — shipment #${e.shipment_id}`,
      LEG_ASSESS: `Jury verdict recorded — shipment #${e.shipment_id}${legTag}`,
      SETTLE: `Shipment #${e.shipment_id} settled`,
      LEG_SETTLE: `Shipment #${e.shipment_id}${legTag} settled`,
      APPEAL_FILED: `Appeal filed — shipment #${e.shipment_id}`,
      LEG_APPEAL_FILED: `Appeal filed — shipment #${e.shipment_id}${legTag}`,
      APPEAL_RESOLVED: `Appeal resolved — shipment #${e.shipment_id}`,
      LEG_APPEAL_RESOLVED: `Appeal resolved — shipment #${e.shipment_id}${legTag}`,
    }[e.type];
    out.push({ key: `verdict-${seq}`, title: label, body: transcriptLine(e, shipmentsById) });
  }
  return { alerts: out, maxSeq: max };
}

export function fireAlerts(alerts, seen) {
  const next = { ...seen };
  for (const a of alerts) {
    if (next[a.key]) continue;
    fire(a.title, a.body);
    next[a.key] = 1;
  }
  return next;
}
