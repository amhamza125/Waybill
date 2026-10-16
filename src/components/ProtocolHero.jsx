import { shortAddress, weiToGen } from "../lib/genlayer";

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card card-hover p-5">
      <p className="stat-label">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${accent || "text-white"}`}>
        {value}
      </p>
      {sub && <p className="mono mt-1.5 text-slate-500">{sub}</p>}
    </div>
  );
}

const SPLITS = [
  { verdict: "INTACT", carrier: 100, color: "bg-emerald-400", text: "text-emerald-300" },
  { verdict: "MINOR_DAMAGE", carrier: 85, color: "bg-amber-400", text: "text-amber-300" },
  { verdict: "MAJOR_DAMAGE", carrier: 40, color: "bg-orange-400", text: "text-orange-300" },
  { verdict: "TOTAL_LOSS", carrier: 0, color: "bg-red-400", text: "text-red-300" },
];

const STEPS = [
  { n: "1", title: "Ship", desc: "Shipper locks GEN escrow into the contract" },
  { n: "2", title: "Deliver", desc: "Carrier submits a photo of the goods" },
  { n: "3", title: "Judge", desc: "AI vision jury classifies the damage" },
  { n: "4", title: "Settle", desc: "Contract splits escrow automatically" },
];

function PayoutSplits() {
  return (
    <div className="card mt-4 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-slate-300">
          Jury payout splits
        </h2>
        <p className="text-xs text-slate-500">carrier share · shipper refund</p>
      </div>
      <div className="mt-4 space-y-3">
        {SPLITS.map((s) => (
          <div key={s.verdict}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className={`font-mono font-semibold ${s.text}`}>{s.verdict}</span>
              <span className="font-mono text-slate-400">
                {s.carrier}% / {100 - s.carrier}%
              </span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
              <div className={`${s.color} rounded-full`} style={{ width: `${s.carrier}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Payouts are real GEN value transfers executed at finalization. Unusable
        photos fail safe to TOTAL_LOSS — fake evidence can't steal escrow.
      </p>
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {STEPS.map((s) => (
        <div key={s.n} className="card card-hover flex items-start gap-3 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 font-display text-sm font-bold text-brand">
            {s.n}
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{s.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{s.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProtocolHero({ protocol, shipments, loading, isOwner }) {
  if (loading && !protocol) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28 animate-pulse bg-panel" />
        ))}
      </div>
    );
  }
  if (!protocol) return null;

  const paused = protocol.paused === true || protocol.paused === "true";
  const open = shipments.filter(
    (s) => s.status === "CREATED" || s.status === "IN_REVIEW"
  );
  const lockedWei = open.reduce((acc, s) => {
    try {
      return acc + BigInt(s.escrow_wei || "0");
    } catch {
      return acc;
    }
  }, 0n);

  return (
    <section className="animate-enter">
      {paused && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3.5">
          <svg
            className="h-5 w-5 shrink-0 text-red-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
            />
          </svg>
          <p className="text-sm font-semibold text-red-300">
            Protocol is PAUSED — all jury assessments are halted until the owner
            resumes.
          </p>
        </div>
      )}

      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          GenLayer Intelligent Contract
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
          Freight settlement{" "}
          <span className="text-gradient">without trust issues</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Shippers lock GEN escrow per shipment. An AI vision jury inspects the
          delivery photo and the contract pays out automatically — no
          inspectors, no disputes, no chargebacks.
        </p>
      </div>

      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Network status"
          value={paused ? "PAUSED" : "LIVE"}
          sub="StudioNet · chain 61999"
          accent={paused ? "text-red-400" : "text-brand"}
        />
        <StatCard
          label="Escrow locked"
          value={`${weiToGen(lockedWei.toString())} GEN`}
          sub={`${open.length} open shipment${open.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Shipments"
          value={String(shipments.length)}
          sub="on-chain registry"
        />
        <StatCard
          label="Jury verdicts"
          value={String(protocol.total_assessed ?? "0")}
          sub={
            isOwner
              ? `owner: ${shortAddress(protocol.owner)} (you)`
              : `owner: ${shortAddress(protocol.owner)}`
          }
        />
      </div>

      <HowItWorks />
      <PayoutSplits />
    </section>
  );
}
