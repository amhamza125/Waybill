// Human-readable transcript lines for the on-chain activity log.
//
// The contract stores structured event payloads (type, parties, verdicts,
// wei amounts) alongside a raw `message` string written for machines.
// This module renders ONE clean sentence per event from the structured
// fields — amounts in GEN, parties as short addresses, verdicts in plain
// words — the way the GenLayer explorer presents activity. The raw string
// survives only inside the expanded details (eventDetails), never as the
// headline.
//
// Honest-data note: the activity log payloads contain NO transaction
// hash (verified against the live contract — no event carries one), so
// nothing here invents an explorer tx link. Rows link to the shipment
// instead, which is the on-chain record that does exist.

import { shortAddress, weiToGen } from "./genlayer.js";
import { fmtDate, verdictLabel } from "./format.js";
import { TAB_LABELS } from "./events.js";

const gen = (wei) => `${weiToGen(wei ?? "0")} GEN`;
const short = (a) => (a ? shortAddress(a) : "");

function shipmentOf(e, byId) {
  return e.shipment_id != null && byId ? byId[e.shipment_id] : null;
}

function labelOf(e, byId) {
  if (e.label) return e.label;
  const s = shipmentOf(e, byId);
  return s ? s.label : null;
}

/** Last-resort cleanup for event types this module doesn't know yet:
 * keep the contract's words but never show raw wei. */
function cleanMessage(e) {
  const m = String(e.message || e.type || "On-chain event");
  return m.replace(/(\d{6,})\s*wei/g, (_, w) => gen(w));
}

export function transcriptLine(e, byId) {
  const id = e.shipment_id;
  const leg = e.leg_index;
  const s = shipmentOf(e, byId);
  const label = labelOf(e, byId);
  const titled = label ? `#${id} '${label}'` : `#${id}`;

  switch (e.type) {
    case "CREATE": {
      const legs = e.is_multileg ? ` · ${e.leg_count}-leg route` : "";
      return `Shipment ${titled} created — ${gen(e.escrow_wei)} escrowed by ${short(e.shipper || (s && s.shipper))}${legs}`;
    }
    case "CANCEL": {
      const refund = s ? ` — ${gen(s.escrow_wei)} refunded to ${short(s.shipper)}` : " — escrow refunded to the shipper";
      return `Shipment #${id} cancelled${refund}`;
    }
    case "EVIDENCE":
      return `Evidence submitted for #${id} — awaiting the AI jury`;
    case "LEG_EVIDENCE":
      return `Evidence submitted for #${id} leg ${leg} — awaiting the AI jury`;
    case "ASSESS":
      return `Shipment #${id} assessed: ${verdictLabel(e.verdict)} (${e.confidence}%) — carrier ${gen(e.carrier_payout_wei)}, shipper ${gen(e.shipper_refund_wei)}`;
    case "LEG_ASSESS":
      return `Leg ${leg} of #${id} assessed: ${verdictLabel(e.verdict)} (${e.confidence}%) — carrier ${gen(e.carrier_payout_wei)}, shipper ${gen(e.shipper_refund_wei)}`;
    case "SETTLE":
      return `Shipment #${id} settled — ${verdictLabel(e.verdict)} · carrier paid ${gen(e.carrier_payout_wei)}, shipper refunded ${gen(e.shipper_refund_wei)}`;
    case "LEG_SETTLE":
      return `Leg ${leg} of #${id} settled — ${verdictLabel(e.verdict)} · carrier paid ${gen(e.carrier_payout_wei)}, shipper refunded ${gen(e.shipper_refund_wei)}`;
    case "APPEAL_FILED":
      return `Appeal filed on #${id} by ${short(e.appellant)} — ${gen(e.bond_wei)} bond locked · challenging ${verdictLabel(e.first_verdict)}`;
    case "LEG_APPEAL_FILED":
      return `Appeal filed on leg ${leg} of #${id} by ${short(e.appellant)} — ${gen(e.bond_wei)} bond locked · challenging ${verdictLabel(e.first_verdict)}`;
    case "APPEAL_RESOLVED":
      return `Appeal on #${id} resolved: ${verdictLabel(e.first_verdict)} → ${verdictLabel(e.second_verdict)} — bond ${e.bond_outcome} · carrier ${gen(e.carrier_payout_wei)}, shipper ${gen(e.shipper_refund_wei)}`;
    case "LEG_APPEAL_RESOLVED":
      return `Appeal on leg ${leg} of #${id} resolved: ${verdictLabel(e.first_verdict)} → ${verdictLabel(e.second_verdict)} — bond ${e.bond_outcome}`;
    case "LEG_ABORTED": {
      const total = s && s.legs ? s.legs.length : null;
      let range = "Remaining legs";
      if (total != null && e.from_leg != null) {
        range = e.from_leg >= total - 1 ? `Leg ${e.from_leg}` : `Legs ${e.from_leg}–${total - 1}`;
      }
      return `${range} of #${id} aborted after a Total loss — ${gen(e.refund_wei)} refunded to the shipper`;
    }
    case "PAUSE_PROTOCOL":
      return "Protocol paused by the owner — writes are blocked";
    case "RESUME_PROTOCOL":
      return "Protocol resumed by the owner";
    default:
      return cleanMessage(e);
  }
}

/** Fuller per-event facts for the expanded row. Only fields the contract
 * actually stored — nothing derived, nothing guessed. */
export function eventDetails(e, byId) {
  const s = shipmentOf(e, byId);
  const rows = [];
  const add = (label, value, mono = false) => {
    if (value != null && value !== "") rows.push({ label, value: String(value), mono });
  };

  add("Category", TAB_LABELS[e._tab] || e.type);
  add("Recorded", e._ts ? fmtDate(e._ts) : "Not stored on-chain");
  if (e.shipment_id != null) add("Shipment", `#${e.shipment_id}${labelOf(e, byId) ? ` · ${labelOf(e, byId)}` : ""}`);
  if (e.leg_index != null) add("Leg", e.leg_index);
  if (e.shipper || (s && s.shipper)) add("Shipper", e.shipper || s.shipper, true);
  if (e.leg_index != null && s && s.legs && s.legs[e.leg_index]) add("Leg carrier", s.legs[e.leg_index].carrier, true);
  else if (e.carrier || (s && s.carrier)) add("Carrier", e.carrier || s.carrier, true);
  if (e.appellant) add("Appellant", e.appellant, true);
  if (e.escrow_wei != null) add("Escrow", gen(e.escrow_wei));
  if (e.carrier_payout_wei != null) add("Carrier payout", gen(e.carrier_payout_wei));
  if (e.shipper_refund_wei != null) add("Shipper refund", gen(e.shipper_refund_wei));
  if (e.bond_wei != null) add("Appeal bond", gen(e.bond_wei));
  if (e.bond_outcome) add("Bond outcome", e.bond_outcome);
  if (e.refund_wei != null) add("Refund", gen(e.refund_wei));
  if (e.first_verdict && e.second_verdict) {
    add("Verdict change", `${verdictLabel(e.first_verdict)} → ${verdictLabel(e.second_verdict)}`);
  } else if (e.verdict) {
    add("Verdict", verdictLabel(e.verdict));
  } else if (e.first_verdict) {
    add("Verdict challenged", verdictLabel(e.first_verdict));
  }
  if (e.confidence != null && Number(e.confidence) > 0) add("Jury confidence", `${e.confidence}%`);
  if (e.appeal_deadline) add("Appeal deadline", fmtDate(e.appeal_deadline));
  if (e.evidence_sha256) add("Evidence SHA-256", e.evidence_sha256, true);
  return rows;
}

/** Tab accent for the transcript row's category chip. */
export const TAB_DOT = {
  shipments: "bg-amber-500",
  verdicts: "bg-blue-500",
  appeals: "bg-purple-500",
  payouts: "bg-emerald-500",
  protocol: "bg-red-500",
  all: "bg-stone-400",
};
