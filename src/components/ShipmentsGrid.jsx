import { useState } from "react";
import {
  shortAddress,
  explorerAddressUrl,
  weiToGen,
} from "../lib/genlayer";
import { VERDICT_INFO } from "../lib/config";

const STATUS_STYLE = {
  CREATED: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  IN_REVIEW: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  RESOLVED: "border-brand/40 bg-brand/10 text-brand",
  CANCELLED: "border-white/20 bg-white/5 text-slate-400",
};

const VERDICT_STYLE = {
  INTACT: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  MINOR_DAMAGE: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  MAJOR_DAMAGE: "border-orange-500/50 bg-orange-500/10 text-orange-300",
  TOTAL_LOSS: "border-red-500/50 bg-red-500/10 text-red-300",
};

function Pill({ text, style }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

function PartyLine({ label, addr }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <a
        href={explorerAddressUrl(addr)}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-brand hover:underline"
        title={addr}
      >
        {shortAddress(addr)}
      </a>
    </div>
  );
}

function EvidenceAssessor({ shipment, busy, walletConnected, isParty, onAssess }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [urlFallback, setUrlFallback] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-ink p-4">
      <p className="label">Delivery evidence → AI jury</p>
      <input
        type="file"
        accept="image/*"
        className="mt-1 block w-full text-sm text-slate-400 file:mr-3 file:rounded-xl file:border-0 file:bg-brand/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand hover:file:bg-brand/25"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <input
        className="input mt-2 font-mono"
        placeholder="Carrier note (optional): e.g. two crates visibly dented"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {!showUrl ? (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-slate-500 hover:text-brand"
          onClick={() => setShowUrl(true)}
        >
          …or paste an image URL instead
        </button>
      ) : (
        <input
          className="input mt-2 font-mono"
          placeholder="https://… direct image URL (photo still required below for the jury)"
          value={urlFallback}
          onChange={(e) => setUrlFallback(e.target.value)}
        />
      )}
      <button
        onClick={() => onAssess(shipment, file, note, urlFallback)}
        disabled={busy || !walletConnected || !isParty || (!file && !urlFallback)}
        className="btn-primary mt-3 w-full !py-2 text-sm"
        title={
          !isParty
            ? "Only the shipper or carrier can submit evidence"
            : "Submit photo and run the AI vision jury"
        }
      >
        {busy ? "Jury deliberating…" : "Submit photo & run jury"}
      </button>
      <p className="mono mt-2 text-slate-600">
        two transactions: 1) store evidence 2) jury verdict + payouts
      </p>
    </div>
  );
}

function ShipmentCard({
  s,
  wallet,
  walletConnected,
  isOwner,
  busyId,
  onCancel,
  onAssess,
}) {
  const id = s.id;
  const isParty =
    !!wallet &&
    (wallet.toLowerCase() === String(s.shipper).toLowerCase() ||
      wallet.toLowerCase() === String(s.carrier).toLowerCase());
  const busy = busyId === `ship-${id}`;
  const statusStyle = STATUS_STYLE[s.status] || STATUS_STYLE.CREATED;

  return (
    <div className="card card-hover animate-enter flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-white">
            <span className="mr-2 font-mono text-sm text-slate-500">#{id}</span>
            {s.label}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-400">{s.description}</p>
        </div>
        <Pill text={s.status?.replace("_", " ")} style={statusStyle} />
      </div>

      <div className="mono mt-3 grid gap-1.5 text-xs text-slate-400">
        <PartyLine label="shipper" addr={s.shipper} />
        <PartyLine label="carrier" addr={s.carrier} />
        <div className="flex items-center justify-between">
          <span className="text-slate-600">escrow</span>
          <span className="font-semibold text-white">{weiToGen(s.escrow_wei)} GEN</span>
        </div>
      </div>

      {s.evidence_url && (
        <a href={s.evidence_url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-xl border border-white/10">
          <img
            src={s.evidence_url}
            alt="Delivery evidence"
            className="max-h-44 w-full object-cover transition-transform hover:scale-[1.02]"
            loading="lazy"
          />
        </a>
      )}
      {s.condition_note && (
        <p className="mono mt-2 rounded-xl bg-ink px-3 py-2 text-xs text-slate-400">
          “{s.condition_note}”
        </p>
      )}

      {s.status === "RESOLVED" && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-ink p-4">
          <div className="flex items-center justify-between">
            <span className="label">Jury verdict</span>
            <Pill
              text={VERDICT_INFO[s.verdict]?.label || s.verdict}
              style={VERDICT_STYLE[s.verdict] || STATUS_STYLE.RESOLVED}
            />
          </div>
          <p className="mono mt-2 text-xs text-slate-400">
            confidence {s.confidence}% · {s.jury_notes}
          </p>
          <div className="mono mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/5 p-2.5">
              <p className="text-slate-600">carrier paid</p>
              <p className="mt-0.5 font-semibold text-emerald-300">
                {weiToGen(s.carrier_payout_wei)} GEN
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-2.5">
              <p className="text-slate-600">shipper refund</p>
              <p className="mt-0.5 font-semibold text-sky-300">
                {weiToGen(s.shipper_refund_wei)} GEN
              </p>
            </div>
          </div>
          <p className="mono mt-2 text-slate-600">
            payouts execute at finalization, after the appeal window
          </p>
        </div>
      )}

      <div className="mt-4 flex-1" />

      {s.status === "CREATED" && (
        <div className="flex flex-col gap-2">
          <EvidenceAssessor
            shipment={s}
            busy={busy}
            walletConnected={walletConnected}
            isParty={isParty}
            onAssess={onAssess}
          />
          {isParty && wallet?.toLowerCase() === String(s.shipper).toLowerCase() && (
            <button
              onClick={() => onCancel(id)}
              disabled={busy}
              className="btn-ghost !py-2 text-sm"
            >
              Cancel & refund escrow
            </button>
          )}
        </div>
      )}
      {s.status === "IN_REVIEW" && (
        <p className="mono rounded-xl bg-amber-400/10 px-3 py-2.5 text-center text-xs text-amber-300">
          Evidence submitted — run the jury from a fresh assessment if this card
          is stale, or wait for the assessor's transaction.
        </p>
      )}
    </div>
  );
}

export default function ShipmentsGrid({
  shipments,
  wallet,
  walletConnected,
  isOwner,
  busyId,
  onCancel,
  onAssess,
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">
          Shipments{" "}
          <span className="text-sm font-semibold text-slate-500">
            ({shipments.length})
          </span>
        </h2>
      </div>
      {shipments.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <p className="font-display text-base font-semibold text-slate-300">
            No shipments yet
          </p>
          <p className="max-w-md text-sm text-slate-500">
            Create your first shipment with GEN escrow, then submit a delivery
            photo and let the AI vision jury decide the payout. Try it with a
            photo of a damaged parcel to watch a partial refund happen.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...shipments].reverse().map((s) => (
            <ShipmentCard
              key={s.id}
              s={s}
              wallet={wallet}
              walletConnected={walletConnected}
              isOwner={isOwner}
              busyId={busyId}
              onCancel={onCancel}
              onAssess={onAssess}
            />
          ))}
        </div>
      )}
    </section>
  );
}
