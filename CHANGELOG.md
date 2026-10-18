# Changelog

All notable changes to this project are documented here. The format follows
Keep a Changelog, and versioning follows SemVer.

## [Unreleased]

## [2.0.0] - 2026-10-18

### Changed (steward review)
- `assess_delivery` now rejects callers who are neither the shipper nor the
  carrier (`ONLY_PARTY_ASSESS`) before any verdict logic runs.
- `submit_evidence` takes a 4th parameter `evidence_sha256` (64-char lowercase
  hex, validated) and commits it on-chain; `assess_delivery` recomputes the
  SHA-256 over the assessed image bytes and fails closed on mismatch
  (`EVIDENCE_MISMATCH`) with state unchanged.
- `shipments` and `assessment_history` changed from `TreeMap[bigint, str]` to
  `TreeMap[str, str]` with stringified integer keys; every access updated
  (`_load`, `_save`, `_log`, all four views).
- Dashboard: the submit flow hashes the photo bytes with SHA-256
  (`crypto.subtle`) and passes the commitment as the 4th `submit_evidence`
  argument.
- `tests/`: 2 new adversarial scenarios (S10 outsider assessment blocked,
  S11 evidence mismatch blocked); all 9 original scenarios re-run and passing.

### Verified
- Deployed and tested on GenLayer StudioNet (chain 61999).
- Deployment: `0x22e6c4314c4c8D07b1875cB447C89778DbB11f42`
  (https://explorer-studio.genlayer.com/address/0x22e6c4314c4c8D07b1875cB447C89778DbB11f42)
- 11/11 scenarios passed; payout transactions FINALIZED; shipper 83.55 ->
  82.30 GEN and carrier 6.75 -> 7.50 GEN matched contract records exactly.

## [1.0.0] - 2026-10-11

### Added
- `Waybill.py`: GenLayer intelligent contract for trustless freight settlement.
  Shipper locks real GEN escrow on `create_shipment`; carrier submits delivery
  photo + note via `submit_evidence`; validator vision jury classifies damage
  (INTACT / MINOR_DAMAGE / MAJOR_DAMAGE / TOTAL_LOSS) in `assess_delivery`;
  contract auto-splits escrow 100/0, 85/15, 40/60, 0/100; `cancel_shipment`
  refunds before evidence; owner `pause_protocol` / `resume_protocol` with
  fail-closed assessments; full shipment + assessment history views.
- Dashboard (React 18 + Vite + Tailwind): shipment creation with escrow,
  client-side photo downscale + upload, two-step evidence flow, jury verdict
  cards, on-chain history feed, owner controls, runtime contract switcher.
- `tests/`: runnable end-to-end suite (`run.mjs`, 9 scenarios) plus
  finalization + exact-payout verifier (`finalize.mjs`); keys via environment
  only.
- `docs/VERIFICATION.md`: contract specs, 9/9 pass table, 13 explorer-linked
  transaction hashes, payout verification to the wei.

### Verified
- Deployed and tested on GenLayer StudioNet (chain 61999).
- Deployment: `0x1290Bb9a5B6b897f01184bdC5650c5065896E570`
  (https://explorer-studio.genlayer.com/address/0x1290Bb9a5B6b897f01184bdC5650c5065896E570)
- 9/9 scenarios passed; payout transactions FINALIZED; shipper 100 -> 99.25
  GEN and carrier 0 -> 0.75 GEN matched contract records exactly.
