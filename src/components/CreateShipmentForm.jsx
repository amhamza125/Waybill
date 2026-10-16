import { useState } from "react";
import { genToWei, weiToGen } from "../lib/genlayer";

const initial = { carrier: "", label: "", description: "", escrow: "" };

export default function CreateShipmentForm({ onCreate, busy, walletConnected }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError("");
  };

  function validate() {
    if (form.carrier.trim().length < 8) return "Carrier address looks too short.";
    const label = form.label.trim();
    if (!label) return "Give the shipment a label (e.g. container-42).";
    if (label.length > 64) return "Label is too long (max 64 chars).";
    if (!form.description.trim()) return "Describe the goods being shipped.";
    try {
      genToWei(form.escrow);
    } catch (e) {
      return e.message;
    }
    return "";
  }

  async function submit(e) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    const wei = genToWei(form.escrow);
    const ok = await onCreate({
      carrier: form.carrier.trim(),
      label: form.label.trim(),
      description: form.description.trim(),
      wei,
    });
    if (ok) setForm(initial);
  }

  return (
    <section className="card animate-enter p-6">
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold text-white">New shipment</h2>
        <p className="mt-1 text-sm text-slate-400">
          Lock GEN escrow into the contract. The AI jury releases it after
          inspecting the delivery photo.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Carrier wallet address</label>
          <input
            className="input font-mono"
            placeholder="0x…"
            value={form.carrier}
            onChange={set("carrier")}
          />
        </div>
        <div>
          <label className="label">Shipment label</label>
          <input
            className="input font-mono"
            placeholder="e.g. container-42"
            value={form.label}
            onChange={set("label")}
          />
        </div>
        <div>
          <label className="label">Escrow (GEN)</label>
          <input
            className="input font-mono"
            placeholder="e.g. 1.5"
            inputMode="decimal"
            value={form.escrow}
            onChange={set("escrow")}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Goods description</label>
          <textarea
            className="input min-h-[72px] resize-y"
            placeholder="e.g. 200 ceramic vases, fragile, wooden crates"
            value={form.description}
            onChange={set("description")}
          />
        </div>

        {error && (
          <p className="sm:col-span-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || !walletConnected}
            className="btn-primary w-full"
            title={!walletConnected ? "Connect your wallet first" : "Lock escrow and create shipment"}
          >
            {busy
              ? "Creating…"
              : `Lock escrow & create shipment${form.escrow ? ` (${weiToGenSafe(form.escrow)} GEN)` : ""}`}
          </button>
          <p className="mono mt-2 text-center text-slate-600">
            real GEN leaves your wallet — fund it from the Studio faucet first
          </p>
        </div>
      </form>
    </section>
  );
}

function weiToGenSafe(s) {
  try {
    return weiToGen(genToWei(s));
  } catch {
    return s;
  }
}
