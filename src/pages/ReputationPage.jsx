// Reputation: on-chain carrier leaderboard (single walletless view) plus an
// address lookup. Fresh wallets read "Unproven" — never a fake score.

import { useState } from "react";
import {
  Addr, EmptyState, Field, IconSearch, IconTrophy, ProgressBar, SectionHeader,
} from "../components/ui";
import { timeAgo } from "../lib/format";

function scorePct(rec) {
  return (Number(rec.score_bps || 0) / 100).toFixed(1);
}

function intactRate(rec) {
  const n = Number(rec.as_carrier_completed || 0);
  if (!n) return "—";
  const good = Number(rec.intact || 0) + Number(rec.minor || 0) * 0.6 + Number(rec.major || 0) * 0.25;
  return `${((good / n) * 100).toFixed(1)}%`;
}

function LeaderboardTable({ rows, onCopy }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-[#e3d9bf] text-left dark:border-white/10">
            {["#", "Carrier", "Score", "Completed", "Intact-rate", "Appeals lost", "Last active"].map((h) => (
              <th key={h} className="stat-label px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.address} className="border-b border-[#efe8d6] last:border-0 hover:bg-amber-500/[0.04] dark:border-white/5 dark:hover:bg-white/[0.03]">
              <td className="px-4 py-3 font-display font-bold text-clay dark:text-slate-400">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </td>
              <td className="px-4 py-3"><Addr value={r.address} onCopy={onCopy} className="text-inktext dark:text-slate-100" /></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <ProgressBar pct={Number(r.score_bps || 0) / 100} className="w-20" />
                  <span className="mono font-bold text-inktext dark:text-white">{scorePct(r)}%</span>
                </div>
              </td>
              <td className="mono px-4 py-3 text-inktext dark:text-slate-200">{r.as_carrier_completed}</td>
              <td className="mono px-4 py-3 text-inktext dark:text-slate-200">{intactRate(r)}</td>
              <td className="mono px-4 py-3 text-inktext dark:text-slate-200">{r.appeals_lost || 0}</td>
              <td className="px-4 py-3 text-xs text-stone-500 dark:text-slate-500">{timeAgo(r.last_active)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordCard({ rec, address, onCopy }) {
  if (rec === "UNPROVEN") {
    return (
      <div className="card flex items-center gap-4 p-5">
        <span className="rounded-xl bg-stone-200 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-stone-600 dark:bg-slate-500/15 dark:text-slate-300">
          Unproven
        </span>
        <p className="text-sm text-stone-600 dark:text-slate-400">
          <span className="mono">{address}</span> has no settled shipments on this contract yet.
          Reputation accrues only on terminal settlement — self-dealt and dust (&lt; 0.1 GEN) shipments are excluded.
        </p>
      </div>
    );
  }
  if (!rec) return null;
  const rows = [
    ["Carrier deliveries completed", rec.as_carrier_completed],
    ["Intact / Minor / Major / Total loss", `${rec.intact} / ${rec.minor} / ${rec.major} / ${rec.total_loss}`],
    ["Score", `${scorePct(rec)}%`],
    ["As shipper (shipments)", rec.as_shipper_completed],
    ["Appeals filed / won / lost", `${rec.appeals_filed} / ${rec.appeals_won} / ${rec.appeals_lost}`],
    ["Last active", timeAgo(rec.last_active)],
  ];
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <Addr value={rec.address} onCopy={onCopy} className="font-bold text-inktext dark:text-white" />
        <span className="mono text-lg font-bold text-branddeep dark:text-brand">{scorePct(rec)}%</span>
      </div>
      <ProgressBar pct={Number(rec.score_bps || 0) / 100} className="mb-4" />
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-[#efe8d6] pb-1.5 dark:border-white/5">
            <dt className="text-stone-500 dark:text-slate-500">{k}</dt>
            <dd className="mono font-semibold text-inktext dark:text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function ReputationPage({ leaderboard, lookup, onLookup, onCopy, contractOk }) {
  const [addr, setAddr] = useState("");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reputation"
        sub="Carrier delivery records, settled on-chain. Check a carrier before you ship."
      />

      {!contractOk ? (
        <EmptyState
          icon={<IconTrophy />}
          title="Leaderboard needs the v3 contract"
          body="This contract address doesn't serve get_reputation_leaderboard yet — point Settings at the v3 deployment to see the board."
        />
      ) : !leaderboard || leaderboard.length === 0 ? (
        <EmptyState
          icon={<IconTrophy />}
          title="No ranked carriers yet"
          body="The board ranks carriers with at least one settled delivery. Settle a shipment and the first names appear here."
        />
      ) : (
        <LeaderboardTable rows={leaderboard} onCopy={onCopy} />
      )}

      <div className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-inktext dark:text-white">
          <IconSearch /> Look up an address
        </h3>
        <form
          onSubmit={(e) => { e.preventDefault(); if (addr.trim()) onLookup(addr.trim()); }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            className="input mono flex-1"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="0x…"
          />
          <button type="submit" className="btn-primary" disabled={!contractOk || !addr.trim()}>
            <IconSearch /> Check reputation
          </button>
        </form>
        {!contractOk && (
          <p className="mt-2 text-xs text-stone-500 dark:text-slate-500">
            Lookup needs the v3 contract — this address doesn't expose get_reputation.
          </p>
        )}
        <div className="mt-4">
          {lookup && <RecordCard rec={lookup.rec} address={lookup.address} onCopy={onCopy} />}
        </div>
      </div>

      <div className="card p-5 text-sm text-stone-600 dark:text-slate-400">
        <h4 className="mb-2 font-bold text-inktext dark:text-slate-100">How the score works</h4>
        <p>
          <span className="mono">score = (intact + 0.6 × minor + 0.25 × major) / completed deliveries</span>,
          computed on-chain in basis points at every terminal settlement. Failed appeals increment the
          appellant's <span className="mono">appeals_lost</span>. Self-dealt shipments (shipper = carrier)
          and dust shipments under 0.1 GEN never count. Cancelled shipments never reach settlement.
        </p>
      </div>
    </div>
  );
}
