import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectWallet,
  parseJson,
  readView,
  sendWrite,
  friendlyError,
  explorerTxUrl,
  weiToGen,
} from "./lib/genlayer";
import {
  DEFAULT_CONTRACT_ADDRESS,
  FAUCET_URL,
  HISTORY_PAGE_SIZE,
  STUDIO_URL,
} from "./lib/config";
import {
  downscaleImage,
  uploadToCatbox,
  blobToHex,
} from "./lib/upload";
import WalletBar from "./components/WalletBar";
import ProtocolHero from "./components/ProtocolHero";
import CreateShipmentForm from "./components/CreateShipmentForm";
import ShipmentsGrid from "./components/ShipmentsGrid";
import HistoryFeed from "./components/HistoryFeed";
import OwnerPanel from "./components/OwnerPanel";
import Toasts from "./components/Toasts";

let toastSeq = 0;
const LS_KEY = "waybill_contract";

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [contractAddress, setContractAddress] = useState(
    () => localStorage.getItem(LS_KEY) || DEFAULT_CONTRACT_ADDRESS
  );
  const [protocol, setProtocol] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(null); // string key of in-flight write
  const [busyShip, setBusyShip] = useState(null); // shipment id with in-flight write
  const [toasts, setToasts] = useState([]);
  const refreshTimer = useRef(null);

  const isOwner = (() => {
    if (!wallet || !protocol || !protocol.owner) return false;
    return wallet.toLowerCase() === String(protocol.owner).toLowerCase();
  })();

  const paused = protocol?.paused === true || protocol?.paused === "true";

  /* ---------------- toasts ---------------- */
  const dismissToast = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((kind, title, message = "", link = "") => {
    const id = ++toastSeq;
    setToasts((ts) => [...ts.slice(-4), { id, kind, title, message, link }]);
    return id;
  }, []);

  const updateToast = useCallback(
    (id, kind, title, message = "", link = "") => {
      setToasts((ts) =>
        ts.map((t) => (id === t.id ? { id, kind, title, message, link } : t))
      );
    },
    []
  );

  /* ---------------- data ---------------- */
  const refresh = useCallback(async () => {
    if (!contractAddress) return;
    setLoading(true);
    setLoadError("");
    try {
      const [pRaw, sRaw, hRaw] = await Promise.all([
        readView(contractAddress, "get_protocol_state", []),
        readView(contractAddress, "get_all_shipments", []),
        readView(contractAddress, "get_assessment_history", [HISTORY_PAGE_SIZE]),
      ]);
      setProtocol(parseJson(pRaw));
      setShipments(parseJson(sRaw) || []);
      setHistory(parseJson(hRaw) || []);
    } catch (e) {
      setLoadError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    refresh();
    refreshTimer.current = setInterval(refresh, 20000);
    return () => clearInterval(refreshTimer.current);
  }, [refresh]);

  /* ---------------- wallet ---------------- */
  async function handleConnect() {
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setWallet(addr);
      pushToast("success", "Wallet connected", addr);
    } catch (e) {
      pushToast("error", "Connection failed", friendlyError(e));
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    setWallet(null);
  }

  function handleSaveContract(addr) {
    setContractAddress(addr);
    if (addr) localStorage.setItem(LS_KEY, addr);
    else localStorage.removeItem(LS_KEY);
    pushToast("info", addr ? "Contract address updated" : "Contract address cleared");
  }

  /* ---------------- writes ---------------- */
  async function runWrite(key, label, functionName, args, value = 0n, shipId = null) {
    if (!wallet) {
      pushToast("error", "Wallet required", "Connect your wallet first.");
      return false;
    }
    if (!contractAddress) {
      pushToast("error", "Contract required", "Set the contract address first.");
      return false;
    }
    setBusy(key);
    if (shipId != null) setBusyShip(`ship-${shipId}`);
    const toastId = pushToast("pending", label, "Waiting for wallet signature…");
    try {
      const { hash } = await sendWrite(
        wallet,
        contractAddress,
        functionName,
        args,
        value
      );
      updateToast(toastId, "pending", label, "Finalizing on GenLayer…", explorerTxUrl(hash));
      await refresh();
      updateToast(toastId, "success", label, "Finalized on-chain.", explorerTxUrl(hash));
      return true;
    } catch (e) {
      updateToast(toastId, "error", label, friendlyError(e));
      return false;
    } finally {
      setBusy(null);
      setBusyShip(null);
    }
  }

  const handleCreate = (f) =>
    runWrite(
      "create",
      `Locking ${weiToGen(f.wei.toString())} GEN escrow`,
      "create_shipment",
      [f.carrier, f.label, f.description],
      f.wei
    );

  const handleCancel = (id) =>
    runWrite(`cancel-${id}`, "Cancelling shipment", "cancel_shipment", [id], 0n, id);

  const handlePause = () => runWrite("pause", "Pausing protocol", "pause_protocol", []);
  const handleResumeProtocol = () =>
    runWrite("resumeProto", "Resuming protocol", "resume_protocol", []);

  /**
   * Two-step jury flow: 1) store the evidence photo URL + note,
   * 2) send the photo bytes to the AI vision jury for a verdict + payouts.
   */
  async function handleAssess(shipment, file, note, urlFallback) {
    const id = shipment.id;
    if (!file) {
      pushToast(
        "error",
        "Photo required",
        "Choose the delivery photo — the jury inspects the actual image bytes."
      );
      return false;
    }
    if (!wallet || !contractAddress) {
      pushToast("error", "Wallet/contract required", "Connect and set the contract first.");
      return false;
    }
    setBusy(`assess-${id}`);
    setBusyShip(`ship-${id}`);
    const toastId = pushToast("pending", "Preparing photo", "Downscaling image…");
    try {
      const small = await downscaleImage(file);
      let evidenceUrl = "";
      try {
        updateToast(toastId, "pending", "Uploading photo", "Storing a viewable copy…");
        evidenceUrl = await uploadToCatbox(small);
      } catch (e) {
        if (urlFallback && urlFallback.trim().startsWith("http")) {
          evidenceUrl = urlFallback.trim();
        } else {
          throw e;
        }
      }
      const hex = await blobToHex(small);

      updateToast(toastId, "pending", "Step 1/2 — submitting evidence", "Waiting for signature…");
      const { hash: h1 } = await sendWrite(
        wallet,
        contractAddress,
        "submit_evidence",
        [id, evidenceUrl, note || ""]
      );
      updateToast(
        toastId,
        "pending",
        "Step 2/2 — AI jury deliberating",
        "Validators are inspecting the photo…",
        explorerTxUrl(h1)
      );
      const { hash: h2 } = await sendWrite(
        wallet,
        contractAddress,
        "assess_delivery",
        [id, hex]
      );
      await refresh();
      updateToast(
        toastId,
        "success",
        "Jury verdict recorded",
        "Payouts execute at finalization, after the appeal window.",
        explorerTxUrl(h2)
      );
      return true;
    } catch (e) {
      updateToast(toastId, "error", "Assessment failed", friendlyError(e));
      return false;
    } finally {
      setBusy(null);
      setBusyShip(null);
    }
  }

  /* ---------------- render ---------------- */
  return (
    <div className="min-h-screen bg-ink font-body">
      <WalletBar
        wallet={wallet}
        connecting={connecting}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        contractAddress={contractAddress}
        onSaveContract={handleSaveContract}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {!contractAddress ? (
          <section className="card mx-auto mt-10 max-w-xl p-8 text-center">
            <h2 className="font-display text-2xl font-bold text-white">
              Point the dashboard at your contract
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Deploy <span className="font-mono text-slate-300">Waybill.py</span> in{" "}
              <a
                href={STUDIO_URL}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                GenLayer Studio
              </a>{" "}
              (or via the CLI), then paste the contract address using the{" "}
              <span className="font-semibold text-slate-200">“Set contract”</span> button in
              the top bar — or set{" "}
              <span className="font-mono text-slate-200">VITE_CONTRACT_ADDRESS</span> when
              deploying to Vercel.
            </p>
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost mt-6"
            >
              Get testnet GEN from the faucet
            </a>
          </section>
        ) : (
          <>
            {loadError && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3.5 text-sm text-red-300">
                Failed to load contract state: {loadError}
              </div>
            )}

            <ProtocolHero
              protocol={protocol}
              shipments={shipments}
              loading={loading}
              isOwner={isOwner}
            />

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <CreateShipmentForm
                  onCreate={handleCreate}
                  busy={busy === "create"}
                  walletConnected={!!wallet}
                />
              </div>
              <div className="lg:col-span-2">
                <OwnerPanel
                  isOwner={isOwner}
                  walletConnected={!!wallet}
                  paused={paused}
                  busy={!!busy}
                  balanceWei={protocol?.contract_balance_wei}
                  onPause={handlePause}
                  onResume={handleResumeProtocol}
                />
              </div>
            </div>

            <ShipmentsGrid
              shipments={shipments}
              wallet={wallet}
              walletConnected={!!wallet}
              isOwner={isOwner}
              busyId={busyShip}
              onCancel={handleCancel}
              onAssess={handleAssess}
            />

            <HistoryFeed history={history} />

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 pb-4">
              <p className="mono text-slate-600">
                Waybill dashboard · StudioNet · testnet escrow — payouts finalize after the appeal window
              </p>
              <div className="flex gap-4">
                <a
                  href={FAUCET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-slate-400 hover:text-brand"
                >
                  Faucet
                </a>
                <a
                  href={STUDIO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-slate-400 hover:text-brand"
                >
                  Studio
                </a>
              </div>
            </footer>
          </>
        )}
      </main>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
