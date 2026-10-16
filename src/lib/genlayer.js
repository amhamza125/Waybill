// Thin wrapper around the official genlayer-js SDK.
// Reads are walletless; writes go through the user's injected wallet
// (MetaMask / Rabby) after switching it to GenLayer StudioNet.

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import {
  STUDIO_CHAIN_ID_HEX,
  STUDIO_CHAIN_NAME,
  STUDIO_RPC_URL,
  EXPLORER_URL,
} from "./config.js";

function studioRpcUrl() {
  try {
    const urls = studionet?.rpcUrls?.default?.http;
    if (Array.isArray(urls) && urls.length > 0) return urls[0];
  } catch {
    /* ignore */
  }
  return STUDIO_RPC_URL;
}

export async function connectWallet() {
  const eth = window.ethereum;
  if (!eth) {
    throw new Error("No EVM wallet detected. Install MetaMask or Rabby first.");
  }
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIO_CHAIN_ID_HEX }],
    });
  } catch (err) {
    if (err && err.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: STUDIO_CHAIN_ID_HEX,
            chainName: STUDIO_CHAIN_NAME,
            rpcUrls: [studioRpcUrl()],
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            blockExplorerUrls: [EXPLORER_URL],
          },
        ],
      });
    } else {
      throw err;
    }
  }
  const accounts = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts authorized in wallet.");
  }
  return accounts[0];
}

export function readClient() {
  return createClient({ chain: studionet });
}

export function writeClient(account) {
  return createClient({
    chain: studionet,
    account,
    provider: window.ethereum,
  });
}

/** GenLayer may wrap string returns in an extra layer of quotes. */
export function parseResult(raw) {
  if (typeof raw !== "string") return raw;
  const s = raw.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  return s;
}

/** Parse a JSON-string view result, returning null on failure. */
export function parseJson(raw) {
  const s = parseResult(raw);
  if (typeof s !== "string") return s;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function readView(contractAddress, functionName, args = []) {
  const client = readClient();
  return client.readContract({ address: contractAddress, functionName, args });
}

/**
 * Send a write transaction and wait for FINALIZED consensus.
 * `value` is native GEN in wei (bigint) for payable methods.
 * Resolves with { hash, receipt }. Throws with a readable message on failure.
 */
export async function sendWrite(
  account,
  contractAddress,
  functionName,
  args = [],
  value = 0n
) {
  const client = writeClient(account);
  const hash = await client.writeContract({
    address: contractAddress,
    functionName,
    args,
    value,
  });
  let receipt = null;
  try {
    receipt = await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
      retries: 120,
      interval: 5000,
    });
  } catch {
    // Receipt polling can time out on slow consensus; the tx hash is still
    // usable in the explorer, so don't fail the whole flow here.
  }
  return { hash, receipt };
}

export const explorerTxUrl = (hash) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddressUrl = (addr) => `${EXPLORER_URL}/address/${addr}`;

export function friendlyError(err) {
  const msg =
    (err && (err.shortMessage || err.message)) || "Transaction failed.";
  // Trim verbose revert dumps to something readable.
  return msg.length > 220 ? msg.slice(0, 220) + "…" : msg;
}

export function shortAddress(addr) {
  if (!addr || addr.length < 12) return addr || "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

/** 1 GEN = 10^18 wei. Parses a decimal GEN string into wei (bigint). */
export function genToWei(gen) {
  const s = String(gen).trim();
  if (!s || Number.isNaN(Number(s)) || Number(s) <= 0) {
    throw new Error("Enter a GEN amount greater than 0.");
  }
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0");
}

/** Formats wei (bigint or numeric string) as a readable GEN string. */
export function weiToGen(wei) {
  try {
    const w = BigInt(wei);
    const whole = w / 10n ** 18n;
    const frac = w % 10n ** 18n;
    if (frac === 0n) return whole.toString();
    const fracStr = frac
      .toString()
      .padStart(18, "0")
      .replace(/0+$/, "")
      .slice(0, 6);
    return `${whole.toString()}.${fracStr}`;
  } catch {
    return "0";
  }
}
