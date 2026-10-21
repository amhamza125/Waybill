// Admin: owner-only emergency controls (pause / resume). The panel renders
// only when the connected wallet equals the contract owner (read from
// get_protocol_state); everyone else gets an explicit owner-only notice.

import { useState } from "react";
import {
  EmptyState, SectionHeader, Spinner, Wei,
  IconAlert, IconCheck, IconShield, IconWallet,
} from "../components/ui";

export default function AdminPage({ wallet, isOwner, protocol, busy, onPause, onResume, onNav }) {
  const [confirm, setConfirm] = useState(null); // 'pause' | 'resume' | null
  const paused = protocol?.paused === true || protocol?.paused === "true";

  if (!wallet) {
    return (
      <EmptyState
        icon={<IconWallet />}
        title="Connect your wallet"
        body="The admin panel is visible only to the contract owner. Connect the owner wallet to continue."
      />
    );
  }

  if (!isOwner) {
    return (
      <EmptyState
        icon={<IconShield />}
        title="Owner only"
        body="This panel is restricted to the contract owner's wallet. Pause and resume are emergency controls — they never touch escrow accounting."
        action={<button onClick={() => onNav("dashboard")} className="btn-ghost">Back to dashboard</button>}
      />
    );
  }

  const ask = (kind) => setConfirm(kind);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionHeader title="Admin" sub="Emergency controls — owner wallet only." />

      <div className="card grid gap-3 p-5 text-sm sm:grid-cols-3">
        <div>
          <p className="stat-label">Protocol state</p>
          <p className={`mt-1 font-display text-lg font-bold ${paused ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
            {paused ? "PAUSED" : "LIVE"}
          </p>
        </div>
        <div>
          <p className="stat-label">Shipments</p>
          <p className="mono mt-1 text-lg font-bold text-inktext dark:text-white">{protocol?.shipment_count || 0}</p>
        </div>
        <div>
          <p className="stat-label">Contract balance</p>
          <p className="mt-1"><Wei wei={protocol?.contract_balance_wei || "0"} className="text-base font-bold text-inktext dark:text-white" /></p>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-red-700/50 bg-red-700/[0.06] p-6 dark:border-red-500/50 dark:bg-red-500/[0.06]">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-red-700/15 p-2.5 text-red-700 dark:bg-red-500/15 dark:text-red-300">
            <IconAlert />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-inktext dark:text-white">Emergency stop</h3>
            <p className="mt-1 max-w-xl text-sm text-stone-600 dark:text-slate-400">
              Pausing blocks jury runs, appeals and settlements — it never moves or redirects escrow,
              and it never auto-resumes. Appeal windows keep their deadlines while paused; pausing only
              delays, it can't change outcomes.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!paused ? (
            confirm === "pause" ? (
              <>
                <button onClick={() => { setConfirm(null); onPause(); }} disabled={busy} className="btn-danger">
                  {busy ? <Spinner /> : <IconAlert />} Confirm — pause the protocol
                </button>
                <button onClick={() => setConfirm(null)} className="btn-ghost">Cancel</button>
              </>
            ) : (
              <button onClick={() => ask("pause")} className="btn-danger">
                <IconAlert /> Pause protocol
              </button>
            )
          ) : confirm === "resume" ? (
            <>
              <button onClick={() => { setConfirm(null); onResume(); }} disabled={busy} className="btn-primary">
                {busy ? <Spinner /> : <IconCheck />} Confirm — resume the protocol
              </button>
              <button onClick={() => setConfirm(null)} className="btn-ghost">Cancel</button>
            </>
          ) : (
            <button onClick={() => ask("resume")} className="btn-primary">
              <IconCheck /> Resume protocol
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

