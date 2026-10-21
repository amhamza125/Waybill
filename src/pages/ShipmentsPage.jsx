// Shipments: filter chips + card grid. Click a card for the detail view
// with the leg timeline stepper and all per-leg / per-shipment actions.

import { useMemo, useState } from "react";
import {
  Addr, Countdown, EmptyState, SectionHeader, StatusPill, VerdictPill, Wei,
  IconPlus, IconTruck, IconBox,
} from "../components/ui";
import { filterBucket } from "../lib/format";
import { shortAddress } from "../lib/genlayer";

const CHIPS = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "transit", label: "In transit" },
  { id: "review", label: "In review" },
  { id: "appeal", label: "Awaiting appeal" },
  { id: "resolved", label: "Resolved" },
  { id: "cancelled", label: "Cancelled" },
];

function isMine(s, wallet) {
  const w = String(wallet || "").toLowerCase();
  if (!w) return false;
  if (String(s.shipper).toLowerCase() === w || String(s.carrier).toLowerCase() === w) return true;
  return (s.legs || []).some((l) => String(l.carrier).toLowerCase() === w);
}

function legProgress(s) {
  if (!s.is_multileg) return null;
  const legs = s.legs || [];
  const done = legs.filter((l) => l.status === "SETTLED" || l.status === "ABORTED").length;
  return { done, total: legs.length };
}

function ShipmentCard({ s, onOpen, onCopy, wallet }) {
  const prog = legProgress(s);
  const units = s.is_multileg ? s.legs || [] : [s];
  const awaiting = units.find((u) => u.status === "AWAITING_APPEAL" && Number(u.appeal_deadline) > 0);
  return (
    <button
      onClick={() => onOpen(s.id)}
      className="card card-hover animate-enter w-full p-5 text-left"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mono text-xs text-stone-500 dark:text-slate-500">#{s.id}</p>
          <h3 className="mt-0.5 truncate font-display text-lg font-bold text-inktext dark:text-white">
            {s.label}
          </h3>
        </div>
        <StatusPill status={s.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 dark:text-slate-400">
        <span>Escrow <Wei wei={s.escrow_wei} className="font-bold text-inktext dark:text-slate-200" /></span>
        <span>Shipper <Addr value={s.shipper} onCopy={onCopy} /></span>
        {!s.is_multileg && <span>Carrier <Addr value={s.carrier} onCopy={onCopy} /></span>}
        {s.is_multileg && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-bold text-branddeep dark:text-brand">{prog.total}-leg route</span>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#e9e0c9] pt-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <VerdictPill verdict={s.verdict} confidence={s.confidence} />
          {prog && (
            <span className="mono text-[11px] text-stone-500 dark:text-slate-500">
              {prog.done}/{prog.total} legs settled
            </span>
          )}
        </div>
        {awaiting ? (
          <span className="mono text-[11px] text-orange-700 dark:text-orange-300">
            appeal <Countdown deadline={awaiting.appeal_deadline} />
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-branddeep hover:underline dark:text-brand">
            Open →
          </span>
        )}
      </div>
    </button>
  );
}

export default function ShipmentsPage({ shipments, wallet, loading, onNav, onCopy }) {
  const [chip, setChip] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = [...(shipments || [])].reverse(); // newest first
    if (chip === "mine") list = list.filter((s) => isMine(s, wallet));
    else if (chip !== "all") list = list.filter((s) => filterBucket(s) === chip);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          String(s.id).includes(q) ||
          String(s.label || "").toLowerCase().includes(q) ||
          String(s.description || "").toLowerCase().includes(q) ||
          String(s.shipper || "").toLowerCase().includes(q) ||
          String(s.carrier || "").toLowerCase().includes(q) ||
          (s.legs || []).some((l) => String(l.carrier || "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [shipments, chip, query, wallet]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Shipments"
        sub={`${filtered.length} of ${(shipments || []).length} on-chain`}
        right={
          <button onClick={() => onNav("create")} className="btn-primary">
            <IconPlus /> New shipment
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            onClick={() => setChip(c.id)}
            disabled={c.id === "mine" && !wallet}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-40 ${
              chip === c.id
                ? "border-branddeep bg-branddeep text-white dark:border-brand dark:bg-brand dark:text-ink"
                : "border-[#d9cfb2] bg-white/50 text-stone-600 hover:border-branddeep/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            }`}
            title={c.id === "mine" && !wallet ? "Connect your wallet first" : ""}
          >
            {c.label}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search id, title, address…"
          className="input !w-auto min-w-[200px] flex-1 sm:flex-none"
        />
      </div>

      {loading && (shipments || []).length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500 dark:text-slate-500">Reading shipments from the contract…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconBox />}
          title={chip === "all" ? "No shipments yet" : "Nothing in this view"}
          body={chip === "all" ? "Create the first shipment — lock GEN escrow and let the AI jury do the inspecting." : "Try a different filter or search."}
          action={
            chip === "all" ? (
              <button onClick={() => onNav("create")} className="btn-primary">
                <IconPlus /> Create shipment
              </button>
            ) : null
          }
        />
      ) : (
        <>
          {/* The grid lives in its own scroll region: with dozens of
              shipments on-chain the page itself must not grow without
              bound — cards scroll inside this frame instead. */}
          <div className="max-h-[calc(100dvh-15rem)] min-h-[12rem] overflow-y-auto overscroll-contain scroll-smooth rounded-2xl pr-1.5 [scrollbar-gutter:stable]">
            <div className="grid gap-4 pb-1 md:grid-cols-2 xl:grid-cols-3 stagger">
              {filtered.map((s) => (
                <ShipmentCard key={s.id} s={s} wallet={wallet} onOpen={(id) => onNav("shipment", { id })} onCopy={onCopy} />
              ))}
            </div>
          </div>
          <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-slate-500">
            {filtered.length} shipment{filtered.length === 1 ? "" : "s"} · scroll the list, or narrow it with the filters above
          </p>
        </>
      )}
    </div>
  );
}
