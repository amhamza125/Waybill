# Changelog

All notable changes to this project are documented here. The format follows
Keep a Changelog, and versioning follows SemVer.

## [Unreleased]

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
- Test deployment: `0x1290Bb9a5B6b897f01184bdC5650c5065896E570`
  (https://explorer-studio.genlayer.com/address/0x1290Bb9a5B6b897f01184bdC5650c5065896E570)
- 9/9 scenarios passed; payout transactions FINALIZED; shipper 100 -> 99.25
  GEN and carrier 0 -> 0.75 GEN matched contract records exactly.
