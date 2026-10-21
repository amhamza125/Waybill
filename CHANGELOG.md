# Changelog

All notable changes to this project are documented here. The format follows
Keep a Changelog, and versioning follows SemVer.

## [Unreleased]

## [3.0.0] - 2026-10-21

### Added
- Bonded appeals: `assess_delivery` records the verdict without paying out
  (status `AWAITING_APPEAL`, per-shipment window default 24h, on-chain bounds
  300s–86400s). `appeal_assessment` (0.05 GEN bond, parties only, one per
  shipment) triggers `resolve_appeal` — a second jury on the same
  hash-bound photo plus a sanitized, injection-neutralized dispute note.
  `settle_shipment` is permissionless after the window for liveness. The
  bond is directional: refunded only if the new verdict improves the
  appellant's payout share, otherwise slashed to the counterparty.
- Late-delivery penalties: `create_shipment` accepts optional `deadline_unix`
  (minimum 1h lead, enforced on-chain) and `penalty_bps` (max 20%).
  Evidence time is consensus-pinned at submission; the penalty is
  deterministic math on the carrier's post-verdict share — not jury-decided,
  not appealable.
- On-chain reputation: `reputation` TreeMap (string keys), updated only on
  terminal settlement; self-dealt and dust (< 0.1 GEN) shipments excluded;
  failed appeals recorded against the appellant; new `get_reputation` and
  `get_reputation_leaderboard` views; fresh wallets read UNPROVEN.
- Multi-leg shipments: `create_shipment` accepts ordered `legs_json` (1–8
  legs, amounts summing to escrow); per-leg evidence, verdict, appeal
  window, and penalty; strictly sequential legs; leg N's jury sees leg N−1's
  final verdict as a labeled chain-of-custody baseline; TOTAL_LOSS aborts
  the route with downstream escrow refunded; 72h per-leg stall timeout with
  shipper-only `cancel_leg`. New writes: `submit_leg_evidence`,
  `assess_leg`, `appeal_leg`, `resolve_leg_appeal`, `settle_leg`,
  `cancel_leg`.
- Dashboard overhaul (`src/`): sidebar app (Dashboard / Shipments / History
  / Reputation / Settings / Admin) with mobile bottom nav; shipment detail
  with a leg timeline stepper; History split into six tabs with composed
  filters and CSV export; reputation leaderboard + address lookup; Settings
  with contract override, RPC status, and theme toggle; owner-only Admin.
  Every control is wired to the contract — no dummy clicks, every number
  from chain.
- `tests/`: full v3 suite — all v2 regressions plus appeal, penalty,
  reputation, and multi-leg scenarios including outsider/double-appeal/
  hostile-note negatives, blame-shift liability, and stall-cancel negatives;
  `finalize.mjs` balance equation extended for bond deposits, refunds,
  slashes, and ABORTED-leg refunds.

### Verified
- Deployed and tested on GenLayer StudioNet (chain 61999).
- Deployment: `0xBA3Fef7ddcC768d4E770aec62413706Ef4735e80`
  (https://explorer-studio.genlayer.com/address/0xBA3Fef7ddcC768d4E770aec62413706Ef4735e80)
- 65/65 scenarios passed across five suites; 69/69 write transactions
  FINALIZED. The directional bond-refund branch was exercised on a genuine
  jury flip (MINOR_DAMAGE 75% → MAJOR_DAMAGE 82%): 0.05 GEN bond refunded,
  new-verdict split paid to the wei, contract drained to exactly 0.
- Fund conservation proven per settlement branch for all 26 shipments;
  contract balance matches locked value and the protocol's reported balance
  exactly; carrier and all seven satellite test wallets reconcile to the
  wei.

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
