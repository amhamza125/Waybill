import { weiToGen } from "../lib/genlayer";
import { VERDICT_INFO } from "../lib/config";

const KIND_STYLE = {
  CREATE: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  EVIDENCE: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  ASSESS: "border-brand/30 bg-brand/10 text-brand",
  CANCEL: "border-white/20 bg-white/5 text-slate-400",
  PAUSE_PROTOCOL: "border-red-500/30 bg-red-500/10 text-red-300",
  RESUME_PROTOCOL: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

function detailLine(h) {
  const parts = [];
  if (h.shipment_id != null) parts.push(`#${h.shipment_id}`);
  if (h.label) parts.push(h.label);
  if (h.escrow_wei) parts.push(`escrow ${weiToGen(h.escrow_wei)} GEN`);
  if (h.verdict && h.verdict !== "N/A") {
    const v = VERDICT_INFO[h.verdict]?.label || h.verdict;
    parts.push(`verdict ${v}${h.confidence ? ` (${h.confidence}%)` : ""}`);
  }
  if (h.carrier_payout_wei || h.shipper_refund_wei) {
    parts.push(
      `carrier ${weiToGen(h.carrier_payout_wei || "0")} / shipper ${weiToGen(
        h.shipper_refund_wei || "0"
      )} GEN`
    );
  }
  return parts.join(" · ");
}

export default function HistoryFeed({ history }) {
  return (
    <section>
      <h2 className="mb-4 font-display text-lg font-bold text-white">
        On-chain activity{" "}
        <span className="text-sm font-semibold text-slate-500">
          ({history.length})
        </span>
      </h2>
      {history.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Every shipment, evidence submission, jury verdict and payout is logged
          on-chain. Activity will appear here.
        </div>
      ) : (
        <ol className="card max-h-[420px] space-y-1 overflow-y-auto p-3">
          {[...history].reverse().map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5"
            >
              <span
                className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                  KIND_STYLE[h.type] || KIND_STYLE.CREATE
                }`}
              >
                {h.type?.replace("_", " ")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">{h.message}</p>
                {detailLine(h) && (
                  <p className="mono mt-0.5 truncate text-xs text-slate-600">
                    {detailLine(h)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
