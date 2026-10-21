// Waybill v3 dashboard — sidebar app (Dashboard / Shipments / History /
// Reputation / Settings / Admin), bottom tab bar on mobile, ink-on-paper
// light theme by default with a dark toggle. Every number comes from chain
// reads; every button maps to a real contract write or read.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  connectWallet,
  parseJson,
  parseResult,
  readView,
  sendWrite,
  friendlyError,
  explorerTxUrl,
  weiToGen,
  shortAddress,
} from "./lib/genlayer";
import {
  APPEAL_BOND_WEI,
  DEFAULT_CONTRACT_ADDRESS,
  HISTORY_FETCH_LIMIT,
  LS_CONTRACT_KEY,
  LS_PREFS_KEY,
  LS_THEME_KEY,
  POLL_MS,
} from "./lib/config";
import { downscaleImage, blobToHex } from "./lib/upload";
import { prepareEvidence, hashMatches } from "./lib/evidence";
import { enrichEvents } from "./lib/events";
import {
  loadSeen,
  saveSeen,
  notificationPermission,
  findAppealWarnings,
  findVerdictAlerts,
  fireAlerts,
} from "./lib/notify";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import Toasts from "./components/Toasts";
import { IconAlert } from "./components/ui";
import DashboardPage from "./pages/DashboardPage";
import ShipmentsPage from "./pages/ShipmentsPage";
import CreateShipmentPage from "./pages/CreateShipmentPage";
import ShipmentDetailPage from "./pages/ShipmentDetailPage";
import HistoryPage from "./pages/HistoryPage";
import ReputationPage from "./pages/ReputationPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";

let toastSeq = 0;

export default function App() {
  const [view, setView] = useState({ name: "dashboard", params: {} });
  const [wallet, setWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [contractAddress, setContractAddress] = useState(
    () => localStorage.getItem(LS_CONTRACT_KEY) || DEFAULT_CONTRACT_ADDRESS
  );
  const [protocol, setProtocol] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [rawHistory, setRawHistory] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null); // null = v3 view unavailable
  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState({});
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem(LS_THEME_KEY) || "light");
  const [prefs, setPrefs] = useState(() => {
    try {
      return { notifyAppeals: false, notifyVerdicts: false, ...JSON.parse(localStorage.getItem(LS_PREFS_KEY) || "{}") };
    } catch {
      return { notifyAppeals: false, notifyVerdicts: false };
    }
  });
  const refreshTimer = useRef(null);

  /* ---------------- theme ---------------- */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(LS_THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LS_PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  /* ---------------- toasts ---------------- */
  const dismissToast = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((kind, title, message = "", link = "") => {
    const id = ++toastSeq;
    setToasts((ts) => [...ts.slice(-4), { id, kind, title, message, link }]);
    return id;
  }, []);

  const updateToast = useCallback((id, kind, title, message = "", link = "") => {
    setToasts((ts) => ts.map((t) => (id === t.id ? { id, kind, title, message, link } : t)));
  }, []);

  const copyText = useCallback(
    (text) => {
      navigator.clipboard?.writeText(text).then(
        () => pushToast("success", "Copied", shortAddress(text)),
        () => pushToast("error", "Copy failed", "Your browser blocked clipboard access.")
      );
    },
    [pushToast]
  );

  /* ---------------- data ---------------- */
  const shipmentsById = useMemo(() => {
    const m = {};
    for (const s of shipments) m[s.id] = s;
    return m;
  }, [shipments]);

  const events = useMemo(() => enrichEvents(rawHistory, shipmentsById), [rawHistory, shipmentsById]);

  const refresh = useCallback(async () => {
    if (!contractAddress) return;
    setLoading(true);
    setLoadError("");
    try {
      const [pRaw, sRaw, hRaw] = await Promise.all([
        readView(contractAddress, "get_protocol_state", []),
        readView(contractAddress, "get_all_shipments", []),
        readView(contractAddress, "get_assessment_history", [HISTORY_FETCH_LIMIT]),
      ]);
      setProtocol(parseJson(pRaw));
      setShipments(parseJson(sRaw) || []);
      setRawHistory(parseJson(hRaw) || []);
      // v3-only view: null (not []) when the contract doesn't serve it.
      try {
        const lb = await readView(contractAddress, "get_reputation_leaderboard", [50]);
        setLeaderboard(parseJson(lb) || []);
      } catch {
        setLeaderboard(null);
      }
    } catch (e) {
      setLoadError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    refresh();
    refreshTimer.current = setInterval(refresh, POLL_MS);
    return () => clearInterval(refreshTimer.current);
  }, [refresh]);

  const isOwner =
    !!wallet && !!protocol?.owner &&
    wallet.toLowerCase() === String(protocol.owner).toLowerCase();
  const paused = protocol?.paused === true || protocol?.paused === "true";

  /* ---------------- navigation ---------------- */
  const onNav = useCallback((name, params = {}) => {
    setView({ name, params });
    window.scrollTo({ top: 0 });
  }, []);

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

  function handleSaveContract(addr) {
    setContractAddress(addr);
    if (addr) localStorage.setItem(LS_CONTRACT_KEY, addr);
    else localStorage.removeItem(LS_CONTRACT_KEY);
    setLookup(null);
    pushToast("info", addr ? "Contract address updated" : "Contract address cleared");
  }

  /* ---------------- writes ---------------- */
  function setBusyKey(key, on) {
    setBusy((b) => {
      const n = { ...b };
      if (on) n[key] = true;
      else delete n[key];
      return n;
    });
  }

  async function runWrite(key, label, functionName, args, value = 0n) {
    if (!wallet) {
      pushToast("error", "Wallet required", "Connect your wallet first.");
      return null;
    }
    if (!contractAddress) {
      pushToast("error", "Contract required", "Set the contract address first.");
      return null;
    }
    setBusyKey(key, true);
    const toastId = pushToast("pending", label, "Waiting for wallet signature…");
    try {
      const { hash } = await sendWrite(wallet, contractAddress, functionName, args, value);
      updateToast(toastId, "pending", label, "Finalizing on GenLayer…", explorerTxUrl(hash));
      await refresh();
      updateToast(toastId, "success", label, "Finalized on-chain.", explorerTxUrl(hash));
      return hash;
    } catch (e) {
      updateToast(toastId, "error", label, friendlyError(e));
      return null;
    } finally {
      setBusyKey(key, false);
    }
  }

  const handleCreate = (f) =>
    runWrite(
      "create",
      `Locking ${weiToGen(f.wei.toString())} GEN escrow`,
      "create_shipment",
      [f.carrier, f.label, f.description, f.windowSec, f.deadlineUnix, f.penaltyBps, f.legsJson],
      f.wei
    ).then((h) => !!h);

  const handleCancelShipment = (id) =>
    runWrite(`cancel-${id}`, "Cancelling shipment", "cancel_shipment", [id]);

  const handlePause = () => runWrite("pause", "Pausing protocol", "pause_protocol", []);
  const handleResume = () => runWrite("resume", "Resuming protocol", "resume_protocol", []);

  /** Photo bytes for assess/resolve (no upload needed — evidence URL already on-chain). */
  async function photoBytes(file) {
    const small = await downscaleImage(file);
    const hex = await blobToHex(small);
    const digest = await crypto.subtle.digest("SHA-256", await small.arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return { hex, sha256 };
  }

  /**
   * Combined evidence + jury flow (single click): commit the photo hash,
   * then run the AI jury on the same bytes. Works for single-leg
   * (submit_evidence → assess_delivery) and legs
   * (submit_leg_evidence → assess_leg).
   */
  async function handleSubmitEvidence(s, legIndex, file, note, urlFallback) {
    const key = `ev-${s.id}-${legIndex ?? "s"}`;
    if (!file) {
      pushToast("error", "Photo required", "Choose the delivery photo — the jury inspects the actual image bytes.");
      return;
    }
    if (!wallet || !contractAddress) {
      pushToast("error", "Wallet/contract required", "Connect and set the contract first.");
      return;
    }
    setBusyKey(key, true);
    const toastId = pushToast("pending", "Preparing photo", "Downscaling image…");
    try {
      const { url, hex, sha256 } = await prepareEvidence(file, urlFallback);
      const single = legIndex == null;
      updateToast(toastId, "pending", "Step 1/2 — submitting evidence", "Waiting for signature…");
      const h1 = single
        ? await sendWrite(wallet, contractAddress, "submit_evidence", [s.id, url, note || "", sha256])
        : await sendWrite(wallet, contractAddress, "submit_leg_evidence", [s.id, legIndex, url, note || "", sha256]);
      updateToast(toastId, "pending", "Step 2/2 — AI jury deliberating", "Validators are inspecting the photo…", explorerTxUrl(h1.hash));
      const h2 = single
        ? await sendWrite(wallet, contractAddress, "assess_delivery", [s.id, hex])
        : await sendWrite(wallet, contractAddress, "assess_leg", [s.id, legIndex, hex]);
      await refresh();
      updateToast(toastId, "success", "Jury verdict recorded", "Payouts execute after the appeal window, unless appealed.", explorerTxUrl(h2.hash));
    } catch (e) {
      updateToast(toastId, "error", "Evidence/assessment failed", friendlyError(e));
    } finally {
      setBusyKey(key, false);
    }
  }

  /** Jury assessment when evidence was submitted in an earlier step. */
  async function handleAssess(s, legIndex, file) {
    const key = `as-${s.id}-${legIndex ?? "s"}`;
    if (!file) {
      pushToast("error", "Photo required", "Re-select the delivery photo for the jury.");
      return;
    }
    const single = legIndex == null;
    const label = single ? "Running AI jury" : `Running AI jury — leg ${legIndex}`;
    setBusyKey(key, true);
    const toastId = pushToast("pending", label, "Preparing photo…");
    try {
      const { hex } = await photoBytes(file);
      const { hash } = await sendWrite(
        wallet, contractAddress,
        single ? "assess_delivery" : "assess_leg",
        single ? [s.id, hex] : [s.id, legIndex, hex]
      );
      updateToast(toastId, "pending", label, "Validators are inspecting the photo…", explorerTxUrl(hash));
      await refresh();
      updateToast(toastId, "success", "Jury verdict recorded", "Payouts execute after the appeal window, unless appealed.", explorerTxUrl(hash));
    } catch (e) {
      updateToast(toastId, "error", "Assessment failed", friendlyError(e));
    } finally {
      setBusyKey(key, false);
    }
  }

  async function handleAppeal(s, legIndex, note) {
    const key = `ap-${s.id}-${legIndex ?? "s"}`;
    const single = legIndex == null;
    await runWrite(
      key,
      single ? "Filing appeal" : `Filing appeal — leg ${legIndex}`,
      single ? "appeal_assessment" : "appeal_leg",
      single ? [s.id, note] : [s.id, legIndex, note],
      APPEAL_BOND_WEI
    );
  }

  /** Second jury on the same hash-bound photo. Pre-checks the hash client-side. */
  async function handleResolveAppeal(s, legIndex, file) {
    const key = `rs-${s.id}-${legIndex ?? "s"}`;
    if (!file) {
      pushToast("error", "Photo required", "Re-select the exact delivery photo used at evidence time.");
      return;
    }
    const unit = legIndex == null ? s : (s.legs || [])[legIndex];
    const single = legIndex == null;
    setBusyKey(key, true);
    const toastId = pushToast("pending", "Preparing photo", "Checking bytes against the committed hash…");
    try {
      const { hex, sha256 } = await photoBytes(file);
      if (!hashMatches(sha256, unit?.evidence_sha256)) {
        throw new Error("These bytes don't match the committed evidence hash — re-select the exact photo used at evidence time.");
      }
      const label = single ? "Resolving appeal" : `Resolving appeal — leg ${legIndex}`;
      updateToast(toastId, "pending", label, "Second jury re-grading the photo…");
      const { hash } = await sendWrite(
        wallet, contractAddress,
        single ? "resolve_appeal" : "resolve_leg_appeal",
        single ? [s.id, hex] : [s.id, legIndex, hex]
      );
      await refresh();
      updateToast(toastId, "success", "Appeal resolved", "Bond refunded or slashed per the directional rule; payouts released.", explorerTxUrl(hash));
    } catch (e) {
      updateToast(toastId, "error", "Appeal resolution failed", friendlyError(e));
    } finally {
      setBusyKey(key, false);
    }
  }

  async function handleSettle(s, legIndex) {
    const key = `se-${s.id}-${legIndex ?? "s"}`;
    const single = legIndex == null;
    await runWrite(
      key,
      single ? "Settling shipment" : `Settling leg ${legIndex}`,
      single ? "settle_shipment" : "settle_leg",
      single ? [s.id] : [s.id, legIndex]
    );
  }

  async function handleCancelLeg(s, legIndex) {
    await runWrite(`cancelleg-${s.id}-${legIndex}`, `Cancelling stalled leg ${legIndex}`, "cancel_leg", [s.id, legIndex]);
  }

  /* ---------------- reputation lookup ---------------- */
  async function handleLookup(address) {
    if (leaderboard === null) {
      pushToast("error", "Lookup unavailable", "This contract doesn't serve get_reputation (needs the v3 deployment).");
      return;
    }
    try {
      const raw = await readView(contractAddress, "get_reputation", [address]);
      const r = parseResult(raw);
      setLookup({ address, rec: r === "UNPROVEN" ? "UNPROVEN" : parseJson(raw) });
    } catch (e) {
      pushToast("error", "Lookup failed", friendlyError(e));
    }
  }

  /* ---------------- notification poller ---------------- */
  useEffect(() => {
    if ((!prefs.notifyAppeals && !prefs.notifyVerdicts) || !wallet || !contractAddress) return;
    if (notificationPermission() !== "granted") return;
    const seen = loadSeen();
    const tick = () => {
      let next = { ...loadSeen() };
      if (prefs.notifyAppeals) {
        const warns = findAppealWarnings(shipments, wallet);
        next = fireAlerts(warns, next);
      }
      if (prefs.notifyVerdicts) {
        const seqKey = `seq-${contractAddress}`;
        const { alerts, maxSeq } = findVerdictAlerts(events, shipmentsById, wallet, next[seqKey] || 0);
        next = fireAlerts(alerts, next);
        next[seqKey] = maxSeq;
      }
      saveSeen(next);
    };
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [prefs, wallet, contractAddress, shipments, events, shipmentsById]);

  const togglePref = useCallback((key, v) => {
    setPrefs((p) => ({ ...p, [key]: v }));
  }, []);

  /* ---------------- render ---------------- */
  const selectedShipment = view.name === "shipment" ? shipmentsById[view.params.id] : null;

  return (
    <div className="min-h-screen font-body">
      <TopBar
        wallet={wallet}
        connecting={connecting}
        onConnect={handleConnect}
        onDisconnect={() => setWallet(null)}
        contractAddress={contractAddress}
        onCopy={copyText}
        onNewShipment={onNav}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        dark={theme === "dark"}
        onBell={() => onNav("settings")}
      />

      <div className="mx-auto flex max-w-[1400px]">
        <Sidebar view={view.name} onNav={onNav} isOwner={isOwner} />

        <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-10">
          {!contractAddress ? (
            <section className="card mx-auto mt-10 max-w-xl p-8 text-center">
              <h2 className="font-display text-2xl font-bold text-inktext dark:text-white">
                Point the dashboard at your contract
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-slate-400">
                Deploy <span className="mono">Waybill.py</span> on GenLayer StudioNet, then paste
                the contract address in <span className="font-semibold">Settings</span> — or set{" "}
                <span className="mono">VITE_CONTRACT_ADDRESS</span> when deploying to Vercel.
              </p>
              <button onClick={() => onNav("settings")} className="btn-primary mt-6">
                Open settings
              </button>
            </section>
          ) : (
            <>
              {loadError && (
                <div className="card mb-5 flex items-center gap-3 border-red-700/40 bg-red-700/10 p-4 text-sm font-semibold text-red-800 dark:text-red-300">
                  <IconAlert /> Failed to load contract state: {loadError}
                </div>
              )}

              {view.name === "dashboard" && (
                <DashboardPage
                  protocol={protocol}
                  shipments={shipments}
                  history={events}
                  wallet={wallet}
                  loading={loading}
                  onNav={onNav}
                />
              )}
              {view.name === "shipments" && (
                <ShipmentsPage
                  shipments={shipments}
                  wallet={wallet}
                  loading={loading}
                  onNav={onNav}
                  onCopy={copyText}
                />
              )}
              {view.name === "create" && (
                <CreateShipmentPage
                  onCreate={handleCreate}
                  busy={!!busy.create}
                  walletConnected={!!wallet}
                  onNav={onNav}
                />
              )}
              {view.name === "shipment" && (
                <ShipmentDetailPage
                  shipment={selectedShipment}
                  wallet={wallet}
                  paused={paused}
                  busy={busy}
                  onCopy={copyText}
                  onNav={onNav}
                  onSubmitEvidence={handleSubmitEvidence}
                  onAssess={handleAssess}
                  onAppeal={handleAppeal}
                  onResolveAppeal={handleResolveAppeal}
                  onSettle={handleSettle}
                  onCancelShipment={handleCancelShipment}
                  onCancelLeg={handleCancelLeg}
                />
              )}
              {view.name === "history" && (
                <HistoryPage
                  events={events}
                  shipmentsById={shipmentsById}
                  wallet={wallet}
                  onCopy={copyText}
                  onNav={onNav}
                />
              )}
              {view.name === "reputation" && (
                <ReputationPage
                  leaderboard={leaderboard}
                  lookup={lookup}
                  onLookup={handleLookup}
                  onCopy={copyText}
                  contractOk={leaderboard !== null}
                />
              )}
              {view.name === "settings" && (
                <SettingsPage
                  contractAddress={contractAddress}
                  defaultContract={DEFAULT_CONTRACT_ADDRESS}
                  onSaveContract={handleSaveContract}
                  onCopy={copyText}
                  theme={theme}
                  onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                  prefs={prefs}
                  onTogglePref={togglePref}
                  onNotifyRequest={(p) =>
                    pushToast("error", "Notifications blocked", p === "denied" ? "Allow notifications in your browser settings, then try again." : "This browser doesn't support notifications.")
                  }
                />
              )}
              {view.name === "admin" && (
                <AdminPage
                  wallet={wallet}
                  isOwner={isOwner}
                  protocol={protocol}
                  busy={!!busy.pause || !!busy.resume}
                  onPause={handlePause}
                  onResume={handleResume}
                  onNav={onNav}
                />
              )}

              <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3d9bf] pt-6 pb-4 dark:border-white/10">
                <p className="mono text-stone-500 dark:text-slate-600">
                  Waybill v3 · StudioNet 61999 · testnet escrow — payouts finalize after the appeal window
                </p>
              </footer>
            </>
          )}
        </main>
      </div>

      <BottomNav view={view.name} onNav={onNav} isOwner={isOwner} />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
