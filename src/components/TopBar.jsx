// Top bar: brand, StudioNet badge, contract chip, theme toggle, wallet.

import {
  IconBell, IconCopy, IconExternal, IconPlus, IconSun, IconMoon,
  IconWallet, LogoMark, Spinner,
} from "./ui";
import { shortAddress, explorerAddressUrl } from "../lib/genlayer";
import { STUDIO_CHAIN_ID } from "../lib/config";

export default function TopBar({
  wallet, connecting, onConnect, onDisconnect,
  contractAddress, onCopy, onNewShipment, onToggleTheme, dark, onBell,
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e3d9bf] bg-paper/90 backdrop-blur-xl dark:border-white/10 dark:bg-ink/85">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button
          onClick={() => onNewShipment && onNewShipment("dashboard")}
          className="flex items-center gap-2.5"
          title="Waybill home"
        >
          <LogoMark className="h-9 w-9" />
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-xl font-bold text-inktext dark:text-white">Waybill</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-clay dark:text-slate-500">
              Freight settlement
            </span>
          </span>
        </button>

        <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 lg:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dot-glow text-emerald-500" />
          StudioNet · {STUDIO_CHAIN_ID}
        </span>

        <div className="flex-1" />

        {contractAddress ? (
          <span className="hidden items-center gap-1 rounded-xl border border-[#e3d9bf] bg-white/60 px-2.5 py-1.5 dark:border-white/10 dark:bg-white/5 md:inline-flex">
            <span className="mono text-stone-500 dark:text-slate-400" title={contractAddress}>
              {shortAddress(contractAddress)}
            </span>
            <button
              onClick={() => onCopy(contractAddress)}
              className="rounded p-1 text-stone-400 hover:text-branddeep dark:text-slate-500 dark:hover:text-brand"
              title="Copy contract address"
            >
              <IconCopy className="!w-3.5 !h-3.5" />
            </button>
            <a
              href={explorerAddressUrl(contractAddress)}
              target="_blank"
              rel="noreferrer"
              className="rounded p-1 text-stone-400 hover:text-branddeep dark:text-slate-500 dark:hover:text-brand"
              title="View contract in explorer"
            >
              <IconExternal className="!w-3.5 !h-3.5" />
            </a>
          </span>
        ) : (
          <span className="mono hidden text-xs text-stone-400 dark:text-slate-500 md:inline">
            no contract set
          </span>
        )}

        <button
          onClick={onToggleTheme}
          className="btn-ghost !px-3"
          title={dark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {dark ? <IconSun /> : <IconMoon />}
        </button>

        {onBell && (
          <button onClick={onBell} className="btn-ghost !px-3" title="Notification settings">
            <IconBell />
          </button>
        )}

        <button onClick={() => onNewShipment("create")} className="btn-primary hidden sm:inline-flex">
          <IconPlus /> New shipment
        </button>

        {wallet ? (
          <button
            onClick={onDisconnect}
            className="btn-ghost !px-3"
            title={`Connected: ${wallet}. Click to disconnect.`}
          >
            <IconWallet />
            <span className="mono hidden sm:inline">{shortAddress(wallet)}</span>
          </button>
        ) : (
          <button onClick={onConnect} disabled={connecting} className="btn-primary">
            {connecting ? <Spinner /> : <IconWallet />}
            <span className="hidden sm:inline">{connecting ? "Connecting…" : "Connect wallet"}</span>
            <span className="sm:hidden">Connect</span>
          </button>
        )}
      </div>
    </header>
  );
}
