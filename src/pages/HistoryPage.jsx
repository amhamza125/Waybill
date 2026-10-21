// History: the on-chain activity log across 6 tabs, with composed filters
// and client-side CSV export. Dates are derived only from timestamps the
// contract stores; events without a recorded time show "—" and are excluded
// when a date range is active.

import { useMemo, useState } from "react";
import {
  EmptyState, Field, SectionHeader,
  IconDownload, IconHistory,
} from "../components/ui";
import { TAB_DEFS, TAB_LABELS } from "../lib/events";
import { timeAgo } from "../lib/format";
import { transcriptLine, eventDetails, TAB_DOT } from "../lib/transcript";
import { isWebUrl } from "../components/Evidence";
import { downloadCsv, eventsToRows } from "../lib/csv";

const VERDICT_OPTIONS = ["INTACT", "MINOR_DAMAGE", "MAJOR_DAMAGE", "TOTAL_LOSS"];
const PAGE = 40;

const eq = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();

function eventParties(e, shipmentsById) {
  const s = e.shipment_id != null ? shipmentsById[e.shipment_id] : null;
  const out = [e.appellant, e.shipper, e.carrier];
  if (s) {
    out.push(s.shipper, s.carrier);
    for (const l of s.legs || []) out.push(l.carrier);
  }
  return out.filter(Boolean);
}

function Chevron({ open }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className={`mt-1.5 shrink-0 text-stone-400 transition-transform duration-200 dark:text-slate-500 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** One transcript line per event — a plain readable sentence built from the
 * structured payload (GEN amounts, short addresses, plain verdicts). The
 * raw contract string lives only inside the expansion, under "Contract
 * log entry". Clicking expands in place: full stored details, a working
 * route to the shipment, and — for hosted evidence — the photo link.
 * The activity log stores no transaction hashes (verified on-chain), so
 * no explorer tx link is offered; inventing one would be a dead link. */
function EventRow({ e, shipmentsById, onNav }) {
  const [open, setOpen] = useState(false);
  const line = transcriptLine(e, shipmentsById);
  const details = eventDetails(e, shipmentsById);
  const canOpen = e.shipment_id != null && typeof onNav === "function";

  return (
    <li className="card animate-enter overflow-hidden !p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] sm:px-5"
      >
        <span className={`mt-[8px] h-2 w-2 shrink-0 rounded-full ${TAB_DOT[e._tab] || TAB_DOT.all}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-relaxed text-inktext dark:text-slate-100">
            {line}
          </span>
          <span className="mono mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-500 dark:text-slate-500">
            <span>{TAB_LABELS[e._tab]}</span>
            <span>{e._ts ? timeAgo(e._ts) : "time not recorded"}</span>
            <span>entry #{e._seq}</span>
          </span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="animate-enter border-t border-[#e9e0c9] bg-white/30 px-4 py-4 dark:border-white/10 dark:bg-white/[0.02] sm:px-5">
          <dl className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
            {details.map((d) => (
              <div
                key={d.label}
                className="flex items-baseline justify-between gap-4 border-b border-dashed border-black/[0.06] pb-1.5 dark:border-white/[0.06]"
              >
                <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-stone-400 dark:text-slate-500">
                  {d.label}
                </dt>
                <dd className={`min-w-0 text-right text-[13px] font-medium text-inktext dark:text-slate-200 ${d.mono ? "mono break-all text-xs" : ""}`}>
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            {canOpen && (
              <button
                type="button"
                onClick={() => onNav("shipment", { id: e.shipment_id })}
                className="btn-ghost !px-3 !py-1.5 text-xs"
              >
                Open shipment #{e.shipment_id} →
              </button>
            )}
            {e.type === "EVIDENCE" && isWebUrl(e.evidence_url) && (
              <a
                href={e.evidence_url}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost !px-3 !py-1.5 text-xs"
              >
                View evidence photo ↗
              </a>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-stone-400 dark:text-slate-500">
            The on-chain activity log doesn't record transaction hashes, so this entry has no
            explorer link — the shipment page shows its full live on-chain state.
          </p>

          {e.message && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-stone-400 transition-colors hover:text-branddeep dark:text-slate-500 dark:hover:text-brand">
                Contract log entry
              </summary>
              <p className="mono mt-1.5 break-all rounded-lg bg-black/[0.04] p-2.5 text-[11px] leading-relaxed text-stone-500 dark:bg-white/[0.04] dark:text-slate-400">
                {e.message}
              </p>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

export default function HistoryPage({ events, shipmentsById, wallet, onCopy, onNav }) {
  const [tab, setTab] = useState("all");
  const [qId, setQId] = useState("");
  const [qParty, setQParty] = useState("");
  const [verdicts, setVerdicts] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    let list = [...(events || [])].reverse(); // newest first
    if (tab !== "all") list = list.filter((e) => e._tab === tab);
    const idq = qId.trim();
    if (idq) list = list.filter((e) => String(e.shipment_id) === idq);
    const pq = qParty.trim().toLowerCase();
    if (pq) list = list.filter((e) => eventParties(e, shipmentsById).some((p) => String(p).toLowerCase().includes(pq)));
    if (verdicts.length) {
      list = list.filter((e) =>
        verdicts.includes(e.verdict) || verdicts.includes(e.second_verdict) || verdicts.includes(e.first_verdict)
      );
    }
    const fromTs = from ? Math.floor(new Date(from).getTime() / 1000) : 0;
    const toTs = to ? Math.floor(new Date(to).getTime() / 1000) : 0;
    if (fromTs || toTs) {
      list = list.filter((e) => {
        if (!e._ts) return false; // no recorded time — excluded from date ranges, honestly
        if (fromTs && e._ts < fromTs) return false;
        if (toTs && e._ts > toTs) return false;
        return true;
      });
    }
    if (onlyMine && wallet) {
      list = list.filter((e) => eventParties(e, shipmentsById).some((p) => eq(p, wallet)));
    }
    return list;
  }, [events, tab, qId, qParty, verdicts, from, to, onlyMine, wallet, shipmentsById]);

  function toggleVerdict(v) {
    setVerdicts((vs) => (vs.includes(v) ? vs.filter((x) => x !== v) : [...vs, v]));
    setShown(PAGE);
  }

  function handleExport() {
    const rows = eventsToRows(filtered);
    downloadCsv(`waybill-history-${tab}-${Date.now()}.csv`, rows);
  }

  const hasFilters = qId || qParty || verdicts.length || from || to || onlyMine;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="History"
        sub={`${filtered.length} event${filtered.length === 1 ? "" : "s"} · full on-chain activity log`}
        right={
          <button onClick={handleExport} disabled={!filtered.length} className="btn-ghost">
            <IconDownload /> Export CSV
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {TAB_DEFS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setShown(PAGE); }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
              tab === t.id
                ? "border-branddeep bg-branddeep text-white dark:border-brand dark:bg-brand dark:text-ink"
                : "border-[#d9cfb2] bg-white/50 text-stone-600 hover:border-branddeep/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Field label="Shipment ID">
          <input className="input mono" value={qId} onChange={(e) => { setQId(e.target.value); setShown(PAGE); }} placeholder="#" inputMode="numeric" />
        </Field>
        <Field label="Party address">
          <input className="input mono" value={qParty} onChange={(e) => { setQParty(e.target.value); setShown(PAGE); }} placeholder="0x…" />
        </Field>
        <Field label="Verdict">
          <div className="flex flex-wrap gap-1.5">
            {VERDICT_OPTIONS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggleVerdict(v)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${verdicts.includes(v) ? "border-branddeep bg-branddeep/10 text-branddeep dark:border-brand dark:bg-brand/15 dark:text-brand" : "border-[#d9cfb2] text-stone-500 dark:border-white/10 dark:text-slate-400"}`}
              >
                {v.replace("_", " ")}
              </button>
            ))}
          </div>
        </Field>
        <Field label="From date">
          <input type="datetime-local" className="input" value={from} onChange={(e) => { setFrom(e.target.value); setShown(PAGE); }} />
        </Field>
        <Field label="To date">
          <input type="datetime-local" className="input" value={to} onChange={(e) => { setTo(e.target.value); setShown(PAGE); }} />
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-inktext dark:text-slate-200">
            <input
              type="checkbox"
              checked={onlyMine}
              disabled={!wallet}
              onChange={(e) => { setOnlyMine(e.target.checked); setShown(PAGE); }}
              className="h-4 w-4 accent-amber-600 disabled:opacity-40"
              title={!wallet ? "Connect your wallet first" : ""}
            />
            Only mine
          </label>
        </div>
      </div>
      {(from || to) && (
        <p className="text-xs text-stone-500 dark:text-slate-500">
          Date filter uses timestamps the contract records (creation, evidence, appeal, settle). Protocol events
          (pauses, settlements without a recorded time) have no on-chain timestamp and are excluded from date ranges.
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconHistory />}
          title={(events || []).length === 0 ? "No activity on-chain yet" : "No events match these filters"}
          body={(events || []).length === 0
            ? "Shipments, jury verdicts, appeals and payouts will appear here as they happen."
            : "Loosen a filter — or clear them all to see the full log."}
          action={hasFilters ? (
            <button
              onClick={() => { setQId(""); setQParty(""); setVerdicts([]); setFrom(""); setTo(""); setOnlyMine(false); setShown(PAGE); }}
              className="btn-ghost"
            >
              Clear filters
            </button>
          ) : null}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {filtered.slice(0, shown).map((e) => (
              <EventRow key={`${e._seq}-${e.type}`} e={e} shipmentsById={shipmentsById} onNav={onNav} />
            ))}
          </ul>
          {shown < filtered.length && (
            <div className="text-center">
              <button onClick={() => setShown((n) => n + PAGE)} className="btn-ghost">
                Show more ({filtered.length - shown} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
