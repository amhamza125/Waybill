// Dashboard home: protocol stat cards, "Needs your attention" panel, recent
// on-chain activity. Every number comes from chain reads.

import {
  IconAlert, IconBell, IconBox, IconCheck, IconClock, IconGavel, IconTruck,
  IconWallet, EmptyState, SectionHeader, StatCard, StatusPill, VerdictPill,
} from "../components/ui";
import { useMemo } from "react";
import { compactGen, fmtCountdown, timeAgo } from "../lib/format";
import { TAB_LABELS } from "../lib/events";
import { transcriptLine } from "../lib/transcript";

const SIX_HOURS = 6 * 3600;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export function buildAttention(shipments, wallet) {
  const items = [];
  const now = nowSec();
  const w = String(wallet || "").toLowerCase();

  for (const s of shipments || []) {
    const isShipper = w && String(s.shipper).toLowerCase() === w;
    const isCarrier = w && String(s.carrier).toLowerCase() === w;
    const mine = isShipper || isCarrier;
    const units = s.is_multileg
      ? (s.legs || []).map((l) => ({ ...l, legCarrier: l.carrier, legIndex: l.index }))
      : [{ ...s, legCarrier: s.carrier, legIndex: null }];

    for (const u of units) {
      const legTag = u.legIndex != null ? ` (leg ${u.legIndex})` : "";
      const party = w && (String(u.legCarrier).toLowerCase() === w || isShipper);

      if (u.status === "CREATED" || u.status === "PENDING") {
        if (party) {
          items.push({
            kind: "action",
            urgent: false,
            shipmentId: s.id,
            legIndex: u.legIndex,
            title: `Submit delivery evidence — #${s.id}${legTag}`,
            body: isShipper && !isCarrier ? "As shipper you may submit on the carrier's behalf." : "The carrier delivers; photo evidence starts the jury.",
          });
        }
      } else if (u.status === "IN_REVIEW") {
        if (party) {
          items.push({
            kind: "action",
            urgent: true,
            shipmentId: s.id,
            legIndex: u.legIndex,
            title: `Run the AI jury — #${s.id}${legTag}`,
            body: "Evidence is committed. Trigger assessment to record the verdict.",
          });
        }
      } else if (u.status === "AWAITING_APPEAL") {
        const dl = Number(u.appeal_deadline || 0);
        const left = dl - now;
        if (dl > 0 && left < SIX_HOURS && left > 0) {
          items.push({
            kind: "window",
            urgent: true,
            shipmentId: s.id,
            legIndex: u.legIndex,
            title: `Appeal window closing — #${s.id}${legTag}`,
            body: `${fmtCountdown(dl)} to appeal (0.05 GEN bond) or let it settle.`,
          });
        } else if (mine && dl > now) {
          items.push({
            kind: "action",
            urgent: false,
            shipmentId: s.id,
            legIndex: u.legIndex,
            title: `Appeal window open — #${s.id}${legTag}`,
            body: `${fmtCountdown(dl)}. File a bonded appeal or wait for permissionless settlement.`,
          });
        }
      } else if (u.status === "APPEALED") {
        if (party) {
          items.push({
            kind: "action",
            urgent: true,
            shipmentId: s.id,
            legIndex: u.legIndex,
            title: `Resolve the appeal — #${s.id}${legTag}`,
            body: "A bonded appeal is filed. Run the second jury on the same hash-bound photo.",
          });
        }
      }
    }
  }
  // Urgent first, then by kind.
  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

export function protocolStats(protocol, shipments) {
  let escrowLocked = 0n;
  let openAppeals = 0;
  const verdicts = { INTACT: 0, MINOR_DAMAGE: 0, MAJOR_DAMAGE: 0, TOTAL_LOSS: 0 };
  let active = 0;
  for (const s of shipments || []) {
    if (s.status === "RESOLVED" || s.status === "CANCELLED") continue;
    active += 1;
    try {
      escrowLocked += BigInt(s.escrow_wei || "0");
    } catch { /* ignore */ }
    const units = s.is_multileg ? s.legs || [] : [s];
    for (const u of units) {
      if (u.status === "AWAITING_APPEAL" || u.status === "APPEALED") openAppeals += 1;
      if (verdicts[u.verdict] != null && u.verdict !== "N/A") verdicts[u.verdict] += 1;
    }
  }
  return {
    escrowLocked,
    active,
    openAppeals,
    verdicts,
    totalVerdicts: Object.values(verdicts).reduce((a, b) => a + b, 0),
    shipmentCount: Number(protocol?.shipment_count || (shipments || []).length),
    contractBalance: protocol?.contract_balance_wei || "0",
  };
}

export default function DashboardPage({ protocol, shipments, history, wallet, loading, onNav }) {
  const stats = protocolStats(protocol, shipments);
  const attention = buildAttention(shipments, wallet);
  const recent = (history || []).slice(-8).reverse();
  const shipmentsById = useMemo(() => {
    const m = {};
    for (const s of shipments || []) m[s.id] = s;
    return m;
  }, [shipments]);
  const paused = protocol?.paused === true || protocol?.paused === "true";

  return (
    <div className="space-y-6">
      {paused && (
        <div className="card flex items-center gap-3 border-red-700/40 bg-red-700/10 p-4 text-sm font-semibold text-red-800 dark:text-red-300">
          <IconAlert />
          The protocol is paused by the owner. Jury runs, appeals and settlements are blocked until it resumes.
        </div>
      )}

      <SectionHeader
        title="Dashboard"
        sub={`Overview · StudioNet · ${stats.shipmentCount} shipment${stats.shipmentCount === 1 ? "" : "s"} on-chain`}
        right={
          <button onClick={() => onNav("create")} className="btn-primary">
            New shipment
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger">
        <StatCard
          label="Escrow locked"
          value={compactGen(stats.escrowLocked.toString())}
          sub={`${stats.active} active shipment${stats.active === 1 ? "" : "s"} · contract holds ${compactGen(stats.contractBalance)}`}
          icon={<IconBox />}
        />
        <StatCard
          label="Shipments"
          value={stats.shipmentCount}
          sub={loading ? "syncing…" : "total created on-chain"}
          icon={<IconTruck />}
        />
        <StatCard
          label="Verdicts recorded"
          value={stats.totalVerdicts}
          sub={`Intact ${stats.verdicts.INTACT} · Minor ${stats.verdicts.MINOR_DAMAGE} · Major ${stats.verdicts.MAJOR_DAMAGE} · Loss ${stats.verdicts.TOTAL_LOSS}`}
          icon={<IconCheck />}
        />
        <StatCard
          label="Open appeals"
          value={stats.openAppeals}
          sub="awaiting appeal or resolution"
          icon={<IconGavel />}
          accent="bg-orange-500/15 text-orange-700 dark:text-orange-300"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <IconBell className="text-branddeep dark:text-brand" />
              <h3 className="font-display text-lg font-bold text-inktext dark:text-white">
                Needs your attention
              </h3>
            </div>
            {!wallet ? (
              <EmptyState
                icon={<IconWallet />}
                title="Connect your wallet"
                body="Your pending actions and closing appeal windows appear here once your wallet is connected."
              />
            ) : attention.length === 0 ? (
              <EmptyState
                icon={<IconCheck />}
                title="All clear"
                body="No pending actions on your shipments, and no appeal windows close in the next 6 hours."
              />
            ) : (
              <ul className="space-y-2.5">
                {attention.slice(0, 8).map((a, i) => (
                  <li key={i}>
                    <button
                      onClick={() => onNav("shipment", { id: a.shipmentId })}
                      className="flex w-full items-start gap-3 rounded-xl border border-[#e3d9bf] bg-white/50 p-3.5 text-left transition-colors hover:border-branddeep/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-brand/40"
                    >
                      <span className={`mt-0.5 rounded-lg p-1.5 ${a.urgent ? "bg-red-700/10 text-red-700 dark:bg-red-500/15 dark:text-red-300" : "bg-amber-500/15 text-branddeep dark:text-brand"}`}>
                        {a.kind === "window" ? <IconClock /> : <IconAlert />}
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-inktext dark:text-slate-100">{a.title}</span>
                        <span className="mt-0.5 block text-xs text-stone-500 dark:text-slate-400">{a.body}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-inktext dark:text-white">Recent activity</h3>
              <button onClick={() => onNav("history")} className="text-xs font-bold text-branddeep hover:underline dark:text-brand">
                View all
              </button>
            </div>
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-stone-500 dark:text-slate-500">
                No on-chain activity yet — create the first shipment.
              </p>
            ) : (
              <ul className="space-y-1">
                {recent.map((e, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => (e.shipment_id != null ? onNav("shipment", { id: e.shipment_id }) : onNav("history"))}
                      className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    >
                      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-branddeep dark:bg-brand" />
                      <span className="min-w-0">
                        <span className="block leading-relaxed text-inktext dark:text-slate-200">
                          {transcriptLine(e, shipmentsById)}
                        </span>
                        <span className="mono mt-0.5 block text-[11px] text-stone-500 dark:text-slate-500">
                          {TAB_LABELS[e._tab] || e.type} · {e._ts ? timeAgo(e._ts) : "time not recorded"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
