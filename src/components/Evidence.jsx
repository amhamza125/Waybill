// Evidence photo rendering — honest by construction.
//
// What the contract stores in `evidence_url` is whatever string the
// submitter passed. Two real cases exist on-chain:
//   1. Shipments created from this dashboard: a hosted https:// image URL
//      (Catbox upload, or a manual URL fallback) — displayable, shown here.
//   2. Everything else (the test suites, other clients): an `evidence://…`
//      identifier. The photo bytes went to the jury as calldata and are
//      bound by the committed SHA-256, but no web-hosted copy exists, so
//      there is NO image a browser could load. Rendering <img src> for
//      those produced the broken-image glyph users reported.
// This component therefore shows a photo only for real http(s) URLs and
// otherwise renders the on-chain reference itself — never a broken glyph,
// never a fake placeholder image.

import { useState } from "react";
import { IconCamera, IconCopy, IconExternal } from "./ui";

export const isWebUrl = (u) => /^https?:\/\//i.test(String(u || "").trim());

function truncRef(url) {
  const s = String(url || "");
  return s.length > 44 ? `${s.slice(0, 26)}…${s.slice(-14)}` : s;
}

/** Full-width evidence block for the shipment detail header. */
export function EvidencePhoto({ url, sha256, alt = "Delivery evidence" }) {
  const [failed, setFailed] = useState(false);
  if (!url) return null;

  if (isWebUrl(url) && !failed) {
    return (
      <figure className="mt-4">
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="max-h-64 w-full rounded-xl border border-[#e3d9bf] object-cover dark:border-white/10"
        />
        <figcaption className="mt-1.5 text-right">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-branddeep hover:underline dark:text-brand"
          >
            Open original <IconExternal className="!w-3 !h-3" />
          </a>
        </figcaption>
      </figure>
    );
  }

  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-[#d9cfb2] bg-white/40 p-4 dark:border-white/15 dark:bg-white/[0.03]">
      <span className="rounded-lg bg-amber-500/15 p-2 text-branddeep dark:text-brand">
        <IconCamera />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-inktext dark:text-slate-100">
          Evidence photo committed on-chain
        </p>
        <p className="mono mt-0.5 truncate text-xs text-stone-500 dark:text-slate-400" title={url}>
          {url}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-slate-400">
          The jury graded the photo bytes bound to this reference
          {sha256 ? (
            <>
              {" "}(SHA-256 <span className="mono">{String(sha256).slice(0, 16)}…</span>)
            </>
          ) : null}
          . The reference isn't a hosted web image, so there is no preview to load here.
        </p>
      </div>
    </div>
  );
}

/** Compact evidence block for leg cards in the route timeline. */
export function EvidenceThumb({ url, sha256 }) {
  const [failed, setFailed] = useState(false);
  if (!url) return null;

  if (isWebUrl(url) && !failed) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-3 block" title="Open evidence photo">
        <img
          src={url}
          alt="Leg evidence"
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-24 w-full rounded-lg border border-[#e3d9bf] object-cover dark:border-white/10"
        />
      </a>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-[#d9cfb2] bg-white/40 px-2.5 py-2 dark:border-white/15 dark:bg-white/[0.03]">
      <IconCamera className="!w-4 !h-4 shrink-0 text-branddeep dark:text-brand" />
      <span className="mono min-w-0 truncate text-[11px] text-stone-500 dark:text-slate-400" title={url}>
        {truncRef(url)}
      </span>
      {sha256 ? (
        <span className="mono ml-auto shrink-0 text-[10px] text-stone-400 dark:text-slate-500" title={`SHA-256 ${sha256}`}>
          #{String(sha256).slice(0, 8)}
        </span>
      ) : null}
    </div>
  );
}

/** Header chip: a real link for hosted photos; for on-chain references a
 * chip that copies the reference (a real action) instead of a dead link. */
export function EvidenceChip({ url, onCopy }) {
  if (!url) return null;
  if (isWebUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg border border-[#e3d9bf] bg-white/50 px-2.5 py-1 text-[11px] font-bold text-branddeep hover:underline dark:border-white/10 dark:bg-white/5 dark:text-brand"
      >
        View evidence photo ↗
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onCopy && onCopy(url)}
      title={`Evidence reference — tap to copy: ${url}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-dashed border-[#d9cfb2] bg-white/50 px-2.5 py-1 text-[11px] font-bold text-stone-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-300"
    >
      <IconCamera className="!w-3.5 !h-3.5" />
      <span className="mono truncate font-medium">{truncRef(url)}</span>
      <IconCopy className="!w-3 !h-3 opacity-60" />
    </button>
  );
}
