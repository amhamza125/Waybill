// Shipment detail: full lifecycle view. Single-leg shows the state machine
// panels; multi-leg shows the LEG TIMELINE STEPPER (horizontal on desktop,
// vertical on mobile) with per-leg action panels gated by wallet role.
// Every button maps to an exact contract method — see the handler audit in
// BUILD_REPORT.md.

import { useMemo, useState } from "react";
import {
  Addr, Countdown, EmptyState, Field, SectionHeader, Spinner, StatusPill,
  TxLink, VerdictPill, Wei,
  IconAlert, IconCamera, IconCheck, IconClock, IconGavel, IconTruck, IconX,
} from "../components/ui";
import { EvidenceChip, EvidencePhoto, EvidenceThumb } from "../components/Evidence";
import { fmtDate, isExpired, parseAppeal, statusLabel, timeAgo } from "../lib/format";
import { APPEAL_BOND_GEN } from "../lib/config";

const LEG_STALL_TIMEOUT = 259200; // 72h — mirrors the contract constant

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

const eq = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();

/* ---------------- gating ---------------- */

function gate({ wallet, party, paused, reason }) {
  if (!wallet) return "Connect your wallet to act.";
  if (party === false) return "Only the shipment's shipper or carrier can do this.";
  if (paused && reason !== "cancel") return "Protocol is paused by the owner.";
  return null;
}

function stallDeadline(s, i) {
  if (i === 0) return Number(s.creation_time || 0) + LEG_STALL_TIMEOUT;
  const prev = (s.legs || [])[i - 1];
  return Number(prev?.settle_time || 0) + LEG_STALL_TIMEOUT;
}

function activeLegIndex(s) {
  const legs = s.legs || [];
  for (let i = 0; i < legs.length; i++) {
    if (legs[i].status !== "SETTLED" && legs[i].status !== "ABORTED") return i;
  }
  return -1;
}

/* ---------------- small panels ---------------- */

function Reason({ text }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-stone-500 dark:text-slate-500">
      <IconAlert className="!w-3.5 !h-3.5 mt-0.5 shrink-0" /> {text}
    </p>
  );
}

function EvidenceForm({ onGo, busyKey, busy, disabledReason }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [urlFallback, setUrlFallback] = useState("");
  return (
    <div className="space-y-3 rounded-xl border border-[#e3d9bf] bg-white/50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <h4 className="flex items-center gap-2 text-sm font-bold text-inktext dark:text-slate-100">
        <IconCamera /> Submit delivery evidence
      </h4>
      <Field label="Delivery photo" hint="The jury grades these exact bytes — the SHA-256 is committed on-chain.">
        <input type="file" accept="image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </Field>
      <Field label="Condition note (optional)">
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Two cartons show corner crushing…" />
      </Field>
      <Field label="Manual photo URL (fallback)" hint="Used only if the automatic upload fails.">
        <input className="input mono" value={urlFallback} onChange={(e) => setUrlFallback(e.target.value)} placeholder="https://…" />
      </Field>
      {disabledReason ? (
        <Reason text={disabledReason} />
      ) : (
        <button
          onClick={() => onGo(file, note, urlFallback)}
          disabled={busy || !file}
          className="btn-primary"
        >
          {busy ? <Spinner /> : <IconCamera />}
          {busy ? "Working…" : "Submit evidence & run jury"}
        </button>
      )}
      <p className="text-xs text-stone-500 dark:text-slate-500">
        One click does both on-chain steps: commit the evidence hash, then run the AI jury on the same bytes.
      </p>
    </div>
  );
}

function AssessForm({ onGo, busyKey, busy, disabledReason }) {
  const [file, setFile] = useState(null);
  return (
    <div className="space-y-3 rounded-xl border border-[#e3d9bf] bg-white/50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <h4 className="flex items-center gap-2 text-sm font-bold text-inktext dark:text-slate-100">
        <IconGavel /> Run the AI jury
      </h4>
      <Field label="Delivery photo" hint="Re-select the same photo — the contract rejects bytes that don't match the committed hash.">
        <input type="file" accept="image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </Field>
      {disabledReason ? (
        <Reason text={disabledReason} />
      ) : (
        <button onClick={() => onGo(file)} disabled={busy || !file} className="btn-primary">
          {busy ? <Spinner /> : <IconGavel />}
          {busy ? "Jury deliberating…" : "Assess delivery"}
        </button>
      )}
    </div>
  );
}

function AppealForm({ onGo, busy, disabledReason, deadline }) {
  const [note, setNote] = useState("");
  const left = 280 - note.length;
  return (
    <div className="space-y-3 rounded-xl border border-orange-700/30 bg-orange-600/5 p-4 dark:border-orange-500/30 dark:bg-orange-500/[0.05]">
      <h4 className="flex items-center gap-2 text-sm font-bold text-inktext dark:text-slate-100">
        <IconGavel /> File a bonded appeal
      </h4>
      <p className="text-xs text-stone-600 dark:text-slate-400">
        A second jury re-grades the same hash-bound photo plus your note (labeled untrusted).
        Bond <span className="mono font-bold">{APPEAL_BOND_GEN} GEN</span> — refunded only if the new
        verdict improves your payout share, otherwise slashed to the counterparty.
      </p>
      <Field label="Dispute note" hint={`${left} characters left — sanitized on-chain.`}>
        <textarea className="input" rows={3} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Argue what the photo genuinely shows…" />
      </Field>
      {disabledReason ? (
        <Reason text={disabledReason} />
      ) : (
        <button onClick={() => onGo(note)} disabled={busy || !note.trim()} className="btn-primary">
          {busy ? <Spinner /> : <IconGavel />}
          {busy ? "Filing…" : `File appeal · ${APPEAL_BOND_GEN} GEN bond`}
        </button>
      )}
    </div>
  );
}

function ResolveForm({ onGo, busy, disabledReason, committedHash }) {
  const [file, setFile] = useState(null);
  return (
    <div className="space-y-3 rounded-xl border border-purple-700/30 bg-purple-600/5 p-4 dark:border-purple-500/30 dark:bg-purple-500/[0.05]">
      <h4 className="flex items-center gap-2 text-sm font-bold text-inktext dark:text-slate-100">
        <IconGavel /> Resolve the appeal
      </h4>
      <p className="text-xs text-stone-600 dark:text-slate-400">
        Re-select the <span className="font-bold">exact delivery photo</span> used at evidence time —
        the contract re-grades it and fails closed on any byte mismatch.
      </p>
      <Field label="Delivery photo (same bytes)">
        <input type="file" accept="image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </Field>
      {committedHash && (
        <p className="mono break-all text-[11px] text-stone-500 dark:text-slate-500">
          committed sha256: {committedHash}
        </p>
      )}
      {disabledReason ? (
        <Reason text={disabledReason} />
      ) : (
        <button onClick={() => onGo(file)} disabled={busy || !file} className="btn-primary">
          {busy ? <Spinner /> : <IconCheck />}
          {busy ? "Second jury deliberating…" : "Resolve appeal"}
        </button>
      )}
    </div>
  );
}

function SettleBox({ onGo, busy, disabledReason, deadline, label }) {
  const expired = isExpired(deadline);
  return (
    <div className="space-y-3 rounded-xl border border-[#e3d9bf] bg-white/50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <h4 className="flex items-center gap-2 text-sm font-bold text-inktext dark:text-slate-100">
        <IconClock /> {label || "Settle"}
      </h4>
      <p className="text-xs text-stone-600 dark:text-slate-400">
        Permissionless — anyone can trigger it once the appeal window closes. It executes the
        recorded verdict with zero discretion.
      </p>
      <p className="mono text-xs text-stone-500 dark:text-slate-500">
        appeal deadline: {fmtDate(deadline)} · <Countdown deadline={deadline} />
      </p>
      {disabledReason ? (
        <Reason text={disabledReason} />
      ) : (
        <button onClick={onGo} disabled={busy || !expired} className="btn-ghost">
          {busy ? <Spinner /> : <IconCheck />}
          {busy ? "Settling…" : expired ? "Settle now" : "Settle (after deadline)"}
        </button>
      )}
    </div>
  );
}

function AppealRecord({ appealRaw }) {
  const a = parseAppeal(appealRaw);
  if (!a) return null;
  return (
    <div className="rounded-xl border border-purple-700/30 bg-purple-600/5 p-4 text-sm dark:border-purple-500/30 dark:bg-purple-500/[0.05]">
      <h4 className="mb-2 flex items-center gap-2 font-bold text-inktext dark:text-slate-100">
        <IconGavel /> Appeal record
      </h4>
      <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
        <div><dt className="stat-label">Appellant</dt><dd className="mono">{a.appellant}</dd></div>
        <div><dt className="stat-label">Filed</dt><dd>{fmtDate(a.appeal_time)}</dd></div>
        <div><dt className="stat-label">First verdict</dt><dd>{a.first_verdict}</dd></div>
        <div><dt className="stat-label">Second verdict</dt><dd>{a.second_verdict || "— pending second jury"}</dd></div>
        <div><dt className="stat-label">Bond</dt><dd className="mono">{a.bond_outcome ? `${a.bond_outcome}` : "locked"} · 0.05 GEN</dd></div>
      </dl>
      <p className="mt-2 rounded-lg bg-black/5 p-2.5 text-xs italic text-stone-600 dark:bg-white/5 dark:text-slate-400">
        “{a.note}”
      </p>
    </div>
  );
}

function PayoutSummary({ unit }) {
  return (
    <div className="grid gap-3 rounded-xl border border-emerald-700/30 bg-emerald-600/5 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/[0.05] sm:grid-cols-3">
      <div>
        <p className="stat-label">Carrier payout</p>
        <Wei wei={unit.carrier_payout_wei} className="text-base font-bold text-inktext dark:text-white" />
      </div>
      <div>
        <p className="stat-label">Shipper refund</p>
        <Wei wei={unit.shipper_refund_wei} className="text-base font-bold text-inktext dark:text-white" />
      </div>
      <div>
        <p className="stat-label">Verdict</p>
        <VerdictPill verdict={unit.verdict} confidence={unit.confidence} />
        {unit.penalty_wei && Number(unit.penalty_wei) > 0 && (
          <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
            incl. late penalty <span className="mono">{unit.penalty_wei} wei</span>
          </p>
        )}
      </div>
      {unit.jury_notes && (
        <p className="text-xs italic text-stone-600 dark:text-slate-400 sm:col-span-3">
          Jury: “{unit.jury_notes}”
        </p>
      )}
    </div>
  );
}

/* ---------------- the leg stepper ---------------- */

function LegNode({ leg, selected, onSelect, onCopy }) {
  const appeal = parseAppeal(leg.appeal);
  return (
    <button
      onClick={() => onSelect(leg.index)}
      className={`relative flex w-full flex-col rounded-2xl border p-4 text-left transition-all ${
        selected
          ? "border-branddeep bg-amber-500/10 shadow-paper dark:border-brand dark:bg-brand/10"
          : "card card-hover"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-xs font-bold text-clay dark:text-slate-400">LEG {leg.index}</span>
        <StatusPill status={leg.status} />
      </div>
      <p className="mt-2 truncate text-sm font-bold text-inktext dark:text-slate-100">
        <Addr value={leg.carrier} onCopy={onCopy} />
      </p>
      <p className="mono mt-1 text-xs text-stone-500 dark:text-slate-500">
        <Wei wei={leg.amount_wei} />
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <VerdictPill verdict={leg.verdict} confidence={leg.confidence} />
        {appeal && (
          <span className="rounded-full border border-purple-700/30 bg-purple-600/10 px-2 py-1 text-[10px] font-bold uppercase text-purple-800 dark:text-purple-300">
            appeal {appeal.bond_outcome || "open"}
          </span>
        )}
      </div>
      <EvidenceThumb url={leg.evidence_url} sha256={leg.evidence_sha256} />
      {(Number(leg.deadline_unix) > 0 || Number(leg.penalty_bps) > 0) && (
        <p className="mono mt-2 text-[11px] text-stone-500 dark:text-slate-500">
          {Number(leg.deadline_unix) > 0 ? `dl ${fmtDate(leg.deadline_unix)}` : "no deadline"}
          {Number(leg.penalty_bps) > 0 ? ` · −${Number(leg.penalty_bps) / 100}% late` : ""}
        </p>
      )}
    </button>
  );
}

/* ---------------- main page ---------------- */

export default function ShipmentDetailPage(props) {
  const { shipment: s, wallet, paused, busy, onCopy, onNav } = props;
  const [selectedLeg, setSelectedLeg] = useState(null);

  const activeIdx = useMemo(() => (s && s.is_multileg ? activeLegIndex(s) : -1), [s]);
  const sel = selectedLeg != null ? selectedLeg : activeIdx >= 0 ? activeIdx : 0;

  if (!s) {
    return (
      <EmptyState
        icon={<IconTruck />}
        title="Shipment not found"
        body="It may not exist on this contract yet — check the contract address in Settings."
        action={<button onClick={() => onNav("shipments")} className="btn-ghost">Back to shipments</button>}
      />
    );
  }

  const isShipper = eq(s.shipper, wallet);
  const w = String(wallet || "").toLowerCase();

  const renderUnitActions = (unit, legIndex) => {
    const isParty = wallet && (eq(unit.carrier || s.carrier, wallet) || isShipper);
    const label = legIndex != null ? `leg ${legIndex}` : "shipment";
    const B = (k) => busy[k];

    switch (unit.status) {
      case "CREATED":
      case "PENDING": {
        const g = gate({ wallet, party: isParty, paused });
        return (
          <div className="space-y-4">
            <EvidenceForm
              busy={B(`ev-${s.id}-${legIndex ?? "s"}`)}
              disabledReason={g}
              onGo={(file, note, url) => props.onSubmitEvidence(s, legIndex, file, note, url)}
            />
            {legIndex == null && (
              isShipper ? (
                <button
                  onClick={() => props.onCancelShipment(s.id)}
                  disabled={B(`cancel-${s.id}`) || !wallet}
                  className="btn-danger"
                >
                  {B(`cancel-${s.id}`) ? <Spinner /> : <IconX />} Cancel shipment — refund escrow
                </button>
              ) : (
                <Reason text="Only the shipper can cancel before evidence is submitted." />
              )
            )}
            {legIndex != null && (
              <CancelLegBox s={s} i={legIndex} wallet={wallet} isShipper={isShipper} busy={B(`cancelleg-${s.id}-${legIndex}`)} onCancel={() => props.onCancelLeg(s, legIndex)} />
            )}
          </div>
        );
      }
      case "IN_REVIEW": {
        const g = gate({ wallet, party: isParty, paused });
        return <AssessForm busy={B(`as-${s.id}-${legIndex ?? "s"}`)} disabledReason={g} onGo={(file) => props.onAssess(s, legIndex, file)} />;
      }
      case "AWAITING_APPEAL": {
        const expired = isExpired(unit.appeal_deadline);
        const gAppeal = expired
          ? "The appeal window has closed — settle the recorded verdict instead."
          : gate({ wallet, party: isParty, paused });
        const gSettle = !wallet ? "Connect your wallet to settle." : paused ? "Protocol is paused by the owner." : null;
        return (
          <div className="grid gap-4 lg:grid-cols-2">
            <AppealForm busy={B(`ap-${s.id}-${legIndex ?? "s"}`)} disabledReason={gAppeal} deadline={unit.appeal_deadline} onGo={(note) => props.onAppeal(s, legIndex, note)} />
            <SettleBox busy={B(`se-${s.id}-${legIndex ?? "s"}`)} disabledReason={gSettle} deadline={unit.appeal_deadline} label={`Settle ${label}`} onGo={() => props.onSettle(s, legIndex)} />
          </div>
        );
      }
      case "APPEALED": {
        const g = gate({ wallet, party: isParty, paused });
        return (
          <div className="space-y-4">
            <AppealRecord appealRaw={unit.appeal} />
            <ResolveForm busy={B(`rs-${s.id}-${legIndex ?? "s"}`)} disabledReason={g} committedHash={unit.evidence_sha256} onGo={(file) => props.onResolveAppeal(s, legIndex, file)} />
          </div>
        );
      }
      case "RESOLVED":
      case "SETTLED":
        return (
          <div className="space-y-4">
            <AppealRecord appealRaw={unit.appeal} />
            <PayoutSummary unit={unit} />
          </div>
        );
      case "CANCELLED":
      case "ABORTED":
        return <Reason text={unit.status === "ABORTED" ? "This leg was aborted after a TOTAL_LOSS upstream — its escrow refunded to the shipper." : "Cancelled before evidence — escrow refunded to the shipper."} />;
      default:
        return null;
    }
  };

  const deadlineChip = Number(s.deadline_unix) > 0 && (
    <span className="mono rounded-lg border border-[#e3d9bf] bg-white/50 px-2.5 py-1 text-[11px] text-stone-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
      deadline {fmtDate(s.deadline_unix)}{Number(s.penalty_bps) > 0 ? ` · −${Number(s.penalty_bps) / 100}% if late` : ""}
    </span>
  );

  return (
    <div className="space-y-6">
      <button onClick={() => onNav("shipments")} className="text-sm font-bold text-branddeep hover:underline dark:text-brand">
        ← All shipments
      </button>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mono text-xs text-stone-500 dark:text-slate-500">SHIPMENT #{s.id} · created {timeAgo(s.creation_time)}</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-inktext dark:text-white sm:text-3xl">{s.label}</h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-600 dark:text-slate-400">{s.description}</p>
          </div>
          <StatusPill status={s.status} />
        </div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#e9e0c9] bg-white/40 p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <p className="stat-label">Escrow</p>
            <Wei wei={s.escrow_wei} className="text-base font-bold text-inktext dark:text-white" />
          </div>
          <div className="rounded-xl border border-[#e9e0c9] bg-white/40 p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <p className="stat-label">Shipper</p>
            <Addr value={s.shipper} onCopy={onCopy} className="text-inktext dark:text-slate-200" />
          </div>
          <div className="rounded-xl border border-[#e9e0c9] bg-white/40 p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <p className="stat-label">{s.is_multileg ? "Route carrier (leg 0)" : "Carrier"}</p>
            <Addr value={s.carrier} onCopy={onCopy} className="text-inktext dark:text-slate-200" />
          </div>
          <div className="rounded-xl border border-[#e9e0c9] bg-white/40 p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <p className="stat-label">Appeal window</p>
            <p className="mono text-sm font-bold text-inktext dark:text-white">{Number(s.appeal_window_sec) / 3600}h</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {deadlineChip}
          {s.is_multileg && (
            <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-branddeep dark:text-brand">
              {(s.legs || []).length}-leg route · chain-of-custody jury
            </span>
          )}
          <EvidenceChip url={s.evidence_url} onCopy={onCopy} />
        </div>

        {!s.is_multileg && <EvidencePhoto url={s.evidence_url} sha256={s.evidence_sha256} />}
      </div>

      {s.is_multileg ? (
        <div className="space-y-5">
          <SectionHeader title="Route timeline" sub="Legs settle strictly in order — the active leg is highlighted." />
          {/* horizontal on desktop, vertical on mobile */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(s.legs || []).map((leg) => (
              <div key={leg.index} className="relative">
                <LegNode leg={leg} selected={leg.index === sel} onSelect={setSelectedLeg} onCopy={onCopy} />
              </div>
            ))}
          </div>
          <div className="card p-5">
            <h3 className="mb-4 font-display text-lg font-bold text-inktext dark:text-white">
              Leg {sel} actions
            </h3>
            {renderUnitActions((s.legs || [])[sel] || {}, sel)}
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <h3 className="mb-4 font-display text-lg font-bold text-inktext dark:text-white">
            {statusLabel(s.status)} — actions
          </h3>
          {renderUnitActions(s, null)}
        </div>
      )}
    </div>
  );
}

function CancelLegBox({ s, i, wallet, isShipper, busy, onCancel }) {
  const dl = stallDeadline(s, i);
  const stalled = nowSec() >= dl;
  if (!isShipper) return <Reason text="Only the shipper can cancel a stalled leg." />;
  if (!stalled) {
    return (
      <div className="rounded-xl border border-[#e3d9bf] bg-white/50 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
        <p className="font-bold text-inktext dark:text-slate-100">Stall cancel</p>
        <p className="mt-1 text-xs text-stone-600 dark:text-slate-400">
          Available if the leg stalls for 72h with no evidence — <Countdown deadline={dl} /> until you can cancel.
          Cancelling aborts this and all downstream legs, refunding their escrow.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-red-700/40 bg-red-700/5 p-4 text-sm dark:border-red-500/40 dark:bg-red-500/[0.05]">
      <p className="font-bold text-red-800 dark:text-red-300">Leg {i} has stalled (72h, no evidence)</p>
      <p className="mt-1 text-xs text-stone-600 dark:text-slate-400">
        Cancelling aborts this leg and everything downstream; their escrow refunds to you in full.
      </p>
      <button onClick={onCancel} disabled={busy || !wallet} className="btn-danger mt-3">
        {busy ? <Spinner /> : <IconX />} Cancel stalled leg {i}
      </button>
    </div>
  );
}
