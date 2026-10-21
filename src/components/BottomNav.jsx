// Mobile bottom tab bar (lg:hidden). Same six destinations as the sidebar.

import {
  IconDashboard, IconTruck, IconHistory, IconTrophy, IconGear, IconShield,
} from "./ui";

const ITEMS = [
  { id: "dashboard", label: "Home", icon: IconDashboard },
  { id: "shipments", label: "Ships", icon: IconTruck },
  { id: "history", label: "History", icon: IconHistory },
  { id: "reputation", label: "Repute", icon: IconTrophy },
  { id: "settings", label: "Settings", icon: IconGear },
  { id: "admin", label: "Admin", icon: IconShield, ownerOnly: true },
];

export default function BottomNav({ view, onNav, isOwner }) {
  const items = ITEMS.filter((i) => !i.ownerOnly || isOwner);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e3d9bf] bg-paper/95 backdrop-blur-xl dark:border-white/10 dark:bg-ink/90 lg:hidden">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map(({ id, label, icon: Icon }) => {
          const active = view === id || (id === "shipments" && (view === "create" || view === "shipment"));
          return (
            <button
              key={id}
              onClick={() => onNav(id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                active
                  ? "text-branddeep dark:text-brand"
                  : "text-stone-500 hover:text-inktext dark:text-slate-500 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="!w-5 !h-5" />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
