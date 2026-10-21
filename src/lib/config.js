// Central configuration for the Waybill dashboard.
// The deployed contract address can be supplied via the VITE_CONTRACT_ADDRESS
// environment variable (Vercel) or overridden in the UI (saved to localStorage).
// The v2 address below is the placeholder default; the parent swaps in the
// final v3 deployment address before the milestone commit.

export const STUDIO_CHAIN_ID = 61999;
export const STUDIO_CHAIN_ID_HEX = "0xf22f"; // 61999
export const STUDIO_CHAIN_NAME = "GenLayer StudioNet";
export const STUDIO_RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const STUDIO_URL = "https://studio.genlayer.com";
// StudioNet funds test accounts from inside Studio (faucet button), no external form needed.
export const FAUCET_URL = "https://studio.genlayer.com";
export const DOCS_URL = "https://docs.genlayer.com";

export const DEFAULT_CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || "0xBA3Fef7ddcC768d4E770aec62413706Ef4735e80";

export const APP_VERSION = "3.0.0";

// Full on-chain activity log is 500 events (_MAX_HISTORY); fetch it all so
// the six History tabs are complete.
export const HISTORY_FETCH_LIMIT = 500;
export const HISTORY_PAGE_SIZE = 50;

export const POLL_MS = 20000;

// Appeal bond: exactly 0.05 GEN, compared as u256 on-chain.
export const APPEAL_BOND_WEI = 50000000000000000n;
export const APPEAL_BOND_GEN = "0.05";

// Jury verdicts and the carrier's share of escrow (basis points).
export const VERDICT_INFO = {
  INTACT: { bps: 10000, label: "Intact" },
  MINOR_DAMAGE: { bps: 8500, label: "Minor damage" },
  MAJOR_DAMAGE: { bps: 4000, label: "Major damage" },
  TOTAL_LOSS: { bps: 0, label: "Total loss" },
};

export const LS_CONTRACT_KEY = "waybill_contract";
export const LS_THEME_KEY = "waybill_theme";
export const LS_PREFS_KEY = "waybill_prefs";
export const LS_SEEN_KEY = "waybill_notify_seen";
