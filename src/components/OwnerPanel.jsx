import { weiToGen } from "../lib/genlayer";

export default function OwnerPanel({
  isOwner,
  walletConnected,
  paused,
  busy,
  balanceWei,
  onPause,
  onResume,
}) {
  if (!walletConnected) return null;

  if (!isOwner) {
    return (
      <section className="card animate-enter border-dashed p-6">
        <h2 className="font-display text-lg font-bold text-white">Protocol controls</h2>
        <p className="mt-2 text-sm text-slate-400">
          The emergency stop is restricted to the contract owner. Connect with
          the deployer wallet to manage it.
        </p>
      </section>
    );
  }

  return (
    <section className="card animate-enter border-gold/30 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Protocol controls</h2>
          <p className="mt-1 text-sm text-slate-400">
            Owner-only actions. Every change is written to the on-chain activity log.
          </p>
        </div>
        <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
          owner
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-ink p-4">
          <label className="label">Contract escrow balance</label>
          <p className="font-display text-2xl font-bold text-white">
            {weiToGen(balanceWei || "0")}{" "}
            <span className="text-sm font-semibold text-slate-500">GEN</span>
          </p>
          <p className="mono mt-2 text-slate-600">locked across open shipments</p>
        </div>

        <div className="flex flex-col justify-center gap-2 rounded-2xl border border-white/10 bg-ink p-4">
          <label className="label">Emergency stop</label>
          {paused ? (
            <button className="btn-primary" disabled={busy} onClick={onResume}>
              Resume protocol
            </button>
          ) : (
            <button className="btn-danger" disabled={busy} onClick={onPause}>
              Pause protocol
            </button>
          )}
          <p className="mono text-slate-600">
            {paused
              ? "Assessments halted — resume to re-enable."
              : "Halts all jury assessments instantly."}
          </p>
        </div>
      </div>
    </section>
  );
}
