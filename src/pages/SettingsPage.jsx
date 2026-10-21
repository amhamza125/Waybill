// Settings: contract override, RPC status, chain info, theme, notification
// preferences, about. Every toggle is wired to real behavior — notification
// toggles drive the localStorage-backed poller in App; nothing is decorative.

import { useEffect, useState } from "react";
import {
  Addr, Field, SectionHeader, Spinner,
  IconBell, IconCheck, IconExternal, IconMoon, IconSun, IconX,
} from "../components/ui";
import {
  APP_VERSION, EXPLORER_URL, STUDIO_CHAIN_ID, STUDIO_CHAIN_NAME, STUDIO_RPC_URL,
} from "../lib/config";
import { explorerAddressUrl, readView } from "../lib/genlayer";
import {
  notificationPermission, notificationSupport, requestNotificationPermission,
} from "../lib/notify";

function Toggle({ on, onChange, disabled, label, hint }) {
  return (
    <label className={`flex cursor-pointer items-start justify-between gap-4 ${disabled ? "opacity-50" : ""}`}>
      <span>
        <span className="block text-sm font-bold text-inktext dark:text-slate-100">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-stone-500 dark:text-slate-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={(e) => { e.preventDefault(); onChange(!on); }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-branddeep dark:bg-brand" : "bg-stone-300 dark:bg-slate-600"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export default function SettingsPage({
  contractAddress, defaultContract, onSaveContract, onCopy,
  theme, onToggleTheme, prefs, onTogglePref, onNotifyRequest,
}) {
  const [draft, setDraft] = useState(contractAddress);
  const [rpc, setRpc] = useState({ state: "idle", ms: null, error: "" });
  const [perm, setPerm] = useState(notificationPermission());

  useEffect(() => { setDraft(contractAddress); }, [contractAddress]);

  async function checkRpc() {
    if (!contractAddress) return;
    setRpc({ state: "checking", ms: null, error: "" });
    const t0 = performance.now();
    try {
      await readView(contractAddress, "get_protocol_state", []);
      setRpc({ state: "ok", ms: Math.round(performance.now() - t0), error: "" });
    } catch (e) {
      setRpc({ state: "fail", ms: null, error: (e && e.message) || "RPC read failed" });
    }
  }

  useEffect(() => { checkRpc(); /* eslint-disable-next-line */ }, [contractAddress]);

  async function enablePref(key) {
    if (!notificationSupport()) return;
    let p = notificationPermission();
    if (p === "default") p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") onTogglePref(key, true);
    else onNotifyRequest(p);
  }

  const notifBlocked = !notificationSupport() || perm === "denied" || perm === "unsupported";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionHeader title="Settings" sub="Connection, appearance and alerts." />

      <div className="card space-y-4 p-5">
        <h3 className="font-display text-base font-bold text-inktext dark:text-white">Contract</h3>
        <Field label="Contract address" hint="Saved on this device only. The dashboard reads every number from this address.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="input mono flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="0x…" />
            <div className="flex gap-2">
              <button onClick={() => draft.trim() && onSaveContract(draft.trim())} className="btn-primary" disabled={!draft.trim()}>
                Save
              </button>
              <button onClick={() => { setDraft(defaultContract); onSaveContract(defaultContract); }} className="btn-ghost" title="Reset to the built-in default">
                Reset
              </button>
            </div>
          </div>
        </Field>
        {contractAddress && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Addr value={contractAddress} onCopy={onCopy} className="text-inktext dark:text-slate-200" />
            <a href={explorerAddressUrl(contractAddress)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-branddeep hover:underline dark:text-brand">
              Verify on explorer <IconExternal className="!w-3.5 !h-3.5" />
            </a>
          </div>
        )}
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-inktext dark:text-white">Network</h3>
          <button onClick={checkRpc} disabled={rpc.state === "checking" || !contractAddress} className="btn-ghost !py-1.5 text-xs">
            {rpc.state === "checking" ? <Spinner /> : null} Recheck RPC
          </button>
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex items-center justify-between border-b border-[#efe8d6] pb-1.5 dark:border-white/5">
            <dt className="text-stone-500 dark:text-slate-500">Network</dt>
            <dd className="font-semibold text-inktext dark:text-slate-100">{STUDIO_CHAIN_NAME}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-[#efe8d6] pb-1.5 dark:border-white/5">
            <dt className="text-stone-500 dark:text-slate-500">Chain ID</dt>
            <dd className="mono font-semibold text-inktext dark:text-slate-100">{STUDIO_CHAIN_ID}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-[#efe8d6] pb-1.5 dark:border-white/5">
            <dt className="text-stone-500 dark:text-slate-500">RPC endpoint</dt>
            <dd className="mono text-xs text-inktext dark:text-slate-100">{STUDIO_RPC_URL.replace("https://", "")}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-[#efe8d6] pb-1.5 dark:border-white/5">
            <dt className="text-stone-500 dark:text-slate-500">RPC status</dt>
            <dd className="flex items-center gap-2 text-xs font-bold">
              {rpc.state === "ok" && (
                <><span className="h-2 w-2 rounded-full bg-emerald-500 dot-glow text-emerald-500" /><span className="text-emerald-700 dark:text-emerald-300">live · {rpc.ms}ms</span></>
              )}
              {rpc.state === "checking" && <span className="text-stone-500">checking…</span>}
              {rpc.state === "fail" && (
                <><span className="h-2 w-2 rounded-full bg-red-500 dot-glow text-red-500" /><span className="text-red-700 dark:text-red-300">unreachable</span></>
              )}
              {rpc.state === "idle" && <span className="text-stone-500">—</span>}
            </dd>
          </div>
        </dl>
        {rpc.state === "fail" && <p className="mono text-xs text-red-700 dark:text-red-300">{rpc.error}</p>}
        <p className="text-xs text-stone-500 dark:text-slate-500">
          Status is a real <span className="mono">get_protocol_state</span> read against the configured contract — not a guess.
        </p>
      </div>

      <div className="card space-y-5 p-5">
        <h3 className="font-display text-base font-bold text-inktext dark:text-white">Appearance</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-inktext dark:text-slate-100">Theme</span>
          <button onClick={onToggleTheme} className="btn-ghost">
            {theme === "dark" ? <IconSun /> : <IconMoon />}
            {theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>
      </div>

      <div className="card space-y-5 p-5">
        <div className="flex items-center gap-2">
          <IconBell className="text-branddeep dark:text-brand" />
          <h3 className="font-display text-base font-bold text-inktext dark:text-white">Notifications</h3>
        </div>
        {notifBlocked && (
          <p className="rounded-xl border border-amber-700/30 bg-amber-600/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
            {!notificationSupport()
              ? "This browser doesn't support notifications — the toggles below are unavailable."
              : "Notifications are blocked for this site. Allow them in your browser settings, then re-enable here."}
          </p>
        )}
        <Toggle
          on={prefs.notifyAppeals}
          disabled={notifBlocked}
          onChange={(v) => (v ? enablePref("notifyAppeals") : onTogglePref("notifyAppeals", false))}
          label="Appeal-window warnings"
          hint="Notify me when an appeal window on one of my shipments closes within 6 hours. Polled locally every minute."
        />
        <Toggle
          on={prefs.notifyVerdicts}
          disabled={notifBlocked}
          onChange={(v) => (v ? enablePref("notifyVerdicts") : onTogglePref("notifyVerdicts", false))}
          label="Verdict finalized"
          hint="Notify me when a jury verdict, appeal outcome or settlement lands on one of my shipments."
        />
      </div>

      <div className="card space-y-2 p-5 text-sm">
        <h3 className="font-display text-base font-bold text-inktext dark:text-white">About</h3>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center justify-between border-b border-[#efe8d6] pb-1.5 dark:border-white/5">
            <dt className="text-stone-500 dark:text-slate-500">Dashboard</dt>
            <dd className="mono font-semibold text-inktext dark:text-slate-100">Waybill v{APP_VERSION}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-[#efe8d6] pb-1.5 dark:border-white/5">
            <dt className="text-stone-500 dark:text-slate-500">Explorer</dt>
            <dd><a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="font-semibold text-branddeep hover:underline dark:text-brand">explorer-studio.genlayer.com</a></dd>
          </div>
        </dl>
        <p className="text-xs text-stone-500 dark:text-slate-500">
          Every control in this app calls the contract or a real local behavior. A control that can't
          work yet doesn't ship — if you find one, that's a bug.
        </p>
      </div>
    </div>
  );
}
