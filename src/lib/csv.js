// Client-side CSV export for the History page. Builds strictly from the
// filtered on-chain event rows the user sees — no invented columns.

function esc(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function eventsToRows(events) {
  return events.map((e, i) => ({
    seq: e._seq != null ? e._seq : i + 1,
    type: e.type || "",
    shipment_id: e.shipment_id != null ? e.shipment_id : "",
    leg_index: e.leg_index != null ? e.leg_index : "",
    time_unix: e._ts || "",
    time_iso: e._ts ? new Date(e._ts * 1000).toISOString() : "",
    verdict: e.verdict || e.second_verdict || "",
    first_verdict: e.first_verdict || "",
    carrier_payout_wei: e.carrier_payout_wei || "",
    shipper_refund_wei: e.shipper_refund_wei || "",
    bond_outcome: e.bond_outcome || "",
    refund_wei: e.refund_wei || "",
    message: e.message || "",
  }));
}

export function downloadCsv(filename, rows) {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
