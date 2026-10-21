// Desktop sidebar navigation.

import {
  IconDashboard, IconTruck, IconHistory, IconTrophy, IconGear, IconShield, LogoMark,
} from "./ui";
import { APP_VERSION } from "../lib/config";

const ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: IconDashboard },
  { id: "shipments", label: "Shipments", icon: IconTruck },
  { id: "history", label: "History", icon: IconHistory },
  { id: "reputation", label: "Reputation", icon: IconTrophy },
  { id: "settings", label: "Settings", icon: IconGear },
  { id: "admin", label: "Admin", icon: IconShield, ownerOnly: true },
];

export default function Sidebar({ view, onNav, isOwner }) {
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-[#e3d9bf] bg-[#fbf8ef]/80 px-4 py-6 backdrop-blur-xl dark:border-white/10 dark:bg-ink/60 lg:flex">
      <nav className="flex-1 space-y-1.5">
        {ITEMS.map(({ id, label, icon: Icon, ownerOnly }) => {
          if (ownerOnly && !isOwner) return null;
          const active = view === id || (id === "shipments" && (view === "create" || view === "shipment"));
          return (
            <button
              key={id}
              onClick={() => onNav(id)}
              className={`navlink ${active ? "navlink-active" : ""}`}
            >
              <Icon />
              {label}
              {ownerOnly && (
                <span className="ml-auto rounded bg-red-700/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-800 dark:bg-red-500/15 dark:text-red-300">
                  owner
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="rounded-xl border border-[#e3d9bf] bg-white/50 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <div className="leading-tight">
            <p className="text-xs font-bold text-inktext dark:text-slate-200">Waybill v{APP_VERSION}</p>
            <p className="text-[11px] text-stone-500 dark:text-slate-500">GenLayer StudioNet</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-stone-500 dark:text-slate-500">
          AI jury freight settlement — escrow in GEN, verdicts by validator consensus.
        </p>
      </div>
    </aside>
  );
}
