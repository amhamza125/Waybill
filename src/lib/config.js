// Central configuration for the Waybill dashboard.
// The deployed contract address can be supplied via the VITE_CONTRACT_ADDRESS
// environment variable (Vercel) or overridden in the UI (saved to localStorage).

export const STUDIO_CHAIN_ID_HEX = "0xf22f"; // 61999
export const STUDIO_CHAIN_NAME = "GenLayer StudioNet";
export const STUDIO_RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const STUDIO_URL = "https://studio.genlayer.com";
// StudioNet funds test accounts from inside Studio (faucet button), no external form needed.
export const FAUCET_URL = "https://studio.genlayer.com";
export const DOCS_URL = "https://docs.genlayer.com";

export const DEFAULT_CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || "";

export const HISTORY_PAGE_SIZE = 50;

// Jury verdicts and the carrier's share of escrow (basis points).
export const VERDICT_INFO = {
  INTACT: { bps: 10000, label: "Intact" },
  MINOR_DAMAGE: { bps: 8500, label: "Minor damage" },
  MAJOR_DAMAGE: { bps: 4000, label: "Major damage" },
  TOTAL_LOSS: { bps: 0, label: "Total loss" },
};
