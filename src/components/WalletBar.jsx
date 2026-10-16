import { useState } from "react";
import { shortAddress, explorerAddressUrl } from "../lib/genlayer";
import { STUDIO_CHAIN_NAME } from "../lib/config";

export function BrandMark() {
  return (
    <svg className="h-9 w-9" viewBox="0 0 40 40" fill="none">
      <rect x="2" y="2" width="36" height="36" rx="10" fill="#f59e0b" />
      <path
        d="M11 27h6l3-7h4l5-7"
        stroke="#070b14"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="27" r="2.6" fill="#070b14" />
      <circle cx="29" cy="13" r="2.6" fill="#070b14" />
      <circle cx="29" cy="13" r="4.6" stroke="#070b14" strokeWidth="1.4" opacity="0.55" />
    </svg>
  );
}

export default function WalletBar({
  wallet,
  connecting,
  onConnect,
  onDisconnect,
  contractAddress,
  onSaveContract,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(contractAddress || "");

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <h1 className="font-display text-lg font-bold leading-tight text-white">
              Waybill
            </h1>
            <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
              Trustless freight settlement
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {STUDIO_CHAIN_NAME}
          </span>

          {editing ? (
            <div className="flex items-center gap-2">
              <input
                className="input w-64 !py-1.5 font-mono text-xs"
                placeholder="0x… contract address"
                value={draft}
                onChange={(e) => setDraft(e.target.value.trim())}
              />
              <button
                className="btn-primary !px-3 !py-1.5 text-xs"
                onClick={() => {
                  onSaveContract(draft);
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button
                className="btn-ghost !px-3 !py-1.5 text-xs"
                onClick={() => {
                  setDraft(contractAddress || "");
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              title={contractAddress || "No contract configured"}
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-slate-300 transition-colors hover:border-brand/40 md:inline-flex"
            >
              <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {contractAddress ? shortAddress(contractAddress) : "Set contract"}
            </button>
          )}

          {wallet ? (
            <div className="flex items-center gap-2">
              <a
                href={explorerAddressUrl(wallet)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-slate-200 hover:border-brand/40"
              >
                {shortAddress(wallet)}
              </a>
              <button onClick={onDisconnect} className="btn-ghost !px-3 !py-1.5 text-xs">
                Disconnect
              </button>
            </div>
          ) : (
            <button onClick={onConnect} disabled={connecting} className="btn-primary !py-2 text-sm">
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
