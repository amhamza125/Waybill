// On-chain activity-log helpers. Event `type` values come straight from the
// contract's _log payloads — no invented types. Timestamps are derived only
// from fields the contract actually stores (creation_time, evidence_time,
// appeal_time, settle_time); events with no recorded time get _ts = 0 and
// are labeled "—" rather than guessed.

import { parseAppeal } from "./format.js";

export const TAB_DEFS = [
  { id: "all", label: "All" },
  { id: "shipments", label: "Shipments" },
  { id: "verdicts", label: "Verdicts" },
  { id: "appeals", label: "Appeals" },
  { id: "payouts", label: "Payouts & Penalties" },
  { id: "protocol", label: "Protocol" },
];

export const TAB_LABELS = Object.fromEntries(TAB_DEFS.map((t) => [t.id, t.label]));

const TYPE_TO_TAB = {
  CREATE: "shipments",
  CANCEL: "shipments",
  EVIDENCE: "shipments",
  ASSESS: "verdicts",
  LEG_ASSESS: "verdicts",
  APPEAL_FILED: "appeals",
  APPEAL_RESOLVED: "appeals",
  LEG_APPEAL_FILED: "appeals",
  LEG_APPEAL_RESOLVED: "appeals",
  SETTLE: "payouts",
  LEG_SETTLE: "payouts",
  LEG_ABORTED: "payouts",
  PAUSE_PROTOCOL: "protocol",
  RESUME_PROTOCOL: "protocol",
};

export function eventTabId(e) {
  return TYPE_TO_TAB[e.type] || "all";
}

function legOf(s, idx) {
  const legs = s && s.legs ? s.legs : [];
  return idx != null ? legs[idx] : null;
}

export function eventTs(e, shipmentsById) {
  const s = e.shipment_id != null ? shipmentsById[e.shipment_id] : null;
  if (!s) return 0;
  const num = (v) => Number(v || 0);
  switch (e.type) {
    case "CREATE":
    case "CANCEL":
      return num(s.creation_time);
    case "EVIDENCE":
    case "ASSESS":
      return num(s.evidence_time) || num(s.creation_time);
    case "APPEAL_FILED":
    case "APPEAL_RESOLVED": {
      const a = parseAppeal(s.appeal);
      return num(a && a.appeal_time) || num(s.evidence_time);
    }
    case "LEG_EVIDENCE":
    case "LEG_ASSESS": {
      const l = legOf(s, e.leg_index);
      return (l && num(l.evidence_time)) || num(s.creation_time);
    }
    case "LEG_APPEAL_FILED":
    case "LEG_APPEAL_RESOLVED": {
      const l = legOf(s, e.leg_index);
      const a = l ? parseAppeal(l.appeal) : null;
      return (a && num(a.appeal_time)) || (l && num(l.evidence_time)) || 0;
    }
    case "LEG_SETTLE": {
      const l = legOf(s, e.leg_index);
      return (l && (num(l.settle_time) || num(l.evidence_time))) || 0;
    }
    default:
      return 0;
  }
}

export function enrichEvents(raw, shipmentsById) {
  return (raw || []).map((e, i) => ({
    ...e,
    _seq: i + 1,
    _tab: eventTabId(e),
    _ts: eventTs(e, shipmentsById),
  }));
}
