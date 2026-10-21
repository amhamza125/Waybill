// Create shipment: full form page. Single-leg by default; optional
// multi-leg builder (1–8 legs, amounts summing exactly to the escrow).
// Contract arg order: create_shipment(carrier, label, description,
// appeal_window_sec, deadline_unix, penalty_bps, legs_json) — payable escrow.

import { useMemo, useState } from "react";
import { genToWei } from "../lib/genlayer";
import { Field, SectionHeader, IconPlus, IconX, IconTruck, Spinner } from "../components/ui";

const MIN_WINDOW = 300;
const MAX_WINDOW = 86400;

function blankLeg() {
  return { carrier: "", amount: "", deadline: "", penalty: "" };
}

export default function CreateShipmentPage({ onCreate, busy, walletConnected, onNav }) {
  const [carrier, setCarrier] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [escrow, setEscrow] = useState("");
  const [windowSec, setWindowSec] = useState("86400");
  const [deadline, setDeadline] = useState("");
  const [penalty, setPenalty] = useState("");
  const [multi, setMulti] = useState(false);
  const [legs, setLegs] = useState([blankLeg(), blankLeg()]);
  const [error, setError] = useState("");

  const legsTotal = useMemo(() => {
    let t = 0;
    for (const l of legs) t += Number(l.amount) || 0;
    return t;
  }, [legs]);

  function setLeg(i, key, val) {
    setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: val } : l)));
  }

  function validate() {
    const esc = Number(escrow);
    if (!(esc > 0)) return "Enter an escrow amount in GEN greater than 0.";
    const w = Number(windowSec);
    if (!(w >= MIN_WINDOW && w <= MAX_WINDOW)) return `Appeal window must be ${MIN_WINDOW}–${MAX_WINDOW} seconds.`;
    if (!label.trim() || label.trim().length > 64) return "Title must be 1–64 characters.";
    if (!description.trim()) return "Describe the goods being shipped.";
    const dl = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : 0;
    const pb = penalty ? Number(penalty) : 0;
    if (dl || pb) {
      if (dl <= Math.floor(Date.now() / 1000) + 3600) return "Deadline must be at least 1 hour in the future.";
      if (!(pb >= 1 && pb <= 2000)) return "Penalty must be 1–2000 bps (max 20%).";
    }
    if (multi) {
      if (legs.length < 1 || legs.length > 8) return "Multi-leg routes need 1–8 legs.";
      for (let i = 0; i < legs.length; i++) {
        const l = legs[i];
        if (l.carrier.trim().length < 8) return `Leg ${i}: enter the carrier wallet address.`;
        if (!(Number(l.amount) >= 0.1)) return `Leg ${i}: each leg needs at least 0.1 GEN escrow.`;
        const ldl = l.deadline ? Math.floor(new Date(l.deadline).getTime() / 1000) : 0;
        const lpb = l.penalty ? Number(l.penalty) : 0;
        if (ldl || lpb) {
          if (ldl <= Math.floor(Date.now() / 1000) + 3600) return `Leg ${i}: deadline must be at least 1 hour in the future.`;
          if (!(lpb >= 1 && lpb <= 2000)) return `Leg ${i}: penalty must be 1–2000 bps.`;
        }
      }
      if (Math.abs(legsTotal - esc) > 1e-9) return `Leg amounts (${legsTotal} GEN) must sum exactly to the escrow (${esc} GEN).`;
    } else if (carrier.trim().length < 8) {
      return "Enter the carrier wallet address.";
    }
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    const wei = genToWei(escrow);
    const dl = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : 0;
    const pb = penalty ? Number(penalty) : 0;
    let legsJson = "";
    let topCarrier = carrier.trim();
    if (multi) {
      const arr = legs.map((l) => ({
        carrier: l.carrier.trim(),
        amount_wei: genToWei(l.amount).toString(),
        deadline_unix: l.deadline ? Math.floor(new Date(l.deadline).getTime() / 1000) : 0,
        penalty_bps: l.penalty ? Number(l.penalty) : 0,
      }));
      legsJson = JSON.stringify(arr);
      topCarrier = arr[0].carrier;
    }
    const ok = await onCreate({
      carrier: topCarrier,
      label: label.trim(),
      description: description.trim(),
      windowSec: Number(windowSec),
      deadlineUnix: dl,
      penaltyBps: pb,
      legsJson,
      wei,
    });
    if (ok) onNav("shipments");
  }

  const remaining = (Number(escrow) || 0) - legsTotal;

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="New shipment"
        sub="Lock GEN escrow — the AI jury releases it when the delivery photo is graded."
      />
      {!walletConnected && (
        <div className="card mb-5 border-amber-700/40 bg-amber-600/10 p-4 text-sm text-amber-900 dark:text-amber-200">
          Connect your wallet to sign the escrow transaction. You can draft the form first.
        </div>
      )}
      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" hint="1–64 characters, shown on every card.">
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Container of solar panels" maxLength={64} />
          </Field>
          <Field label="Escrow (GEN)" hint="Locked in the contract until verdict + appeal window.">
            <input className="input mono" value={escrow} onChange={(e) => setEscrow(e.target.value)} placeholder="0.5" inputMode="decimal" />
          </Field>
        </div>
        <Field label="Description" hint="What the jury should expect to see in the photo.">
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="40 cartons of 550W solar panels, palletized and shrink-wrapped…" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Appeal window (seconds)" hint="300–86400. Default 86400 (24h). Enforced on-chain.">
            <input className="input mono" value={windowSec} onChange={(e) => setWindowSec(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Carrier wallet" hint={multi ? "Superseded by leg 0's carrier." : "The delivering party."}>
            <input className="input mono" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="0x…" disabled={multi} />
          </Field>
        </div>

        <div className="grid gap-5 rounded-xl border border-[#e3d9bf] bg-white/40 p-4 dark:border-white/10 dark:bg-white/[0.02] sm:grid-cols-2">
          <Field label="Delivery deadline (optional)" hint="Late delivery deducts the penalty from the carrier's share. Min 1h out.">
            <input type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Field label="Late penalty bps (optional)" hint="1–2000 (max 20%). Deterministic, not jury-decided.">
            <input className="input mono" value={penalty} onChange={(e) => setPenalty(e.target.value)} placeholder="500 = 5%" inputMode="numeric" />
          </Field>
        </div>

        <div className="rounded-xl border border-[#e3d9bf] bg-white/40 p-4 dark:border-white/10 dark:bg-white/[0.02]">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className="h-4 w-4 accent-amber-600" />
            <span className="text-sm font-bold text-inktext dark:text-slate-100">Multi-leg route</span>
            <span className="text-xs text-stone-500 dark:text-slate-500">up to 8 sequential legs, chain-of-custody jury</span>
          </label>

          {multi && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-inktext dark:text-slate-200">
                  Legs total: <span className="mono">{legsTotal.toFixed(6)} GEN</span>
                </span>
                <span className={`mono ${Math.abs(remaining) < 1e-9 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                  {Math.abs(remaining) < 1e-9 ? "✓ matches escrow" : `${remaining.toFixed(6)} GEN remaining`}
                </span>
              </div>
              {legs.map((l, i) => (
                <div key={i} className="grid gap-3 rounded-xl border border-[#e3d9bf] bg-paper/60 p-3.5 dark:border-white/10 dark:bg-black/20 sm:grid-cols-[1fr_130px] lg:grid-cols-[1fr_130px_170px_110px_auto]">
                  <input className="input mono" placeholder={`Leg ${i} carrier 0x…`} value={l.carrier} onChange={(e) => setLeg(i, "carrier", e.target.value)} />
                  <input className="input mono" placeholder="GEN" inputMode="decimal" value={l.amount} onChange={(e) => setLeg(i, "amount", e.target.value)} />
                  <input type="datetime-local" className="input" value={l.deadline} onChange={(e) => setLeg(i, "deadline", e.target.value)} title="Optional leg deadline" />
                  <input className="input mono" placeholder="penalty bps" inputMode="numeric" value={l.penalty} onChange={(e) => setLeg(i, "penalty", e.target.value)} />
                  <button
                    type="button"
                    onClick={() => setLegs((ls) => ls.filter((_, j) => j !== i))}
                    disabled={legs.length <= 1}
                    className="btn-ghost !px-2.5 disabled:opacity-30"
                    title="Remove leg"
                  >
                    <IconX />
                  </button>
                </div>
              ))}
              {legs.length < 8 && (
                <button type="button" onClick={() => setLegs((ls) => [...ls, blankLeg()])} className="btn-ghost text-xs">
                  <IconPlus /> Add leg
                </button>
              )}
              <p className="text-xs text-stone-500 dark:text-slate-500">
                Legs run strictly in order; each leg's jury sees the previous leg's final verdict as the damage baseline.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Spinner /> : <IconTruck />}
            {busy ? "Waiting for signature…" : `Lock ${escrow || "…"} GEN escrow`}
          </button>
          <button type="button" onClick={() => onNav("shipments")} className="btn-ghost">
            Cancel
          </button>
          <p className="text-xs text-stone-500 dark:text-slate-500">
            One wallet signature locks the escrow. Jury grading, appeals and payouts are separate on-chain steps.
          </p>
        </div>
      </form>
    </div>
  );
}
