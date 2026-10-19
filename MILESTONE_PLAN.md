# Waybill v3 — Milestone Plan ("Trust Upgrades")

**Target:** GenLayer Milestone submission (20–4,000 pts), aiming upper-middle range.
**Baseline:** v2 approved 2026-10-19 (`0x22e6c4314c4c8D07b1875cB447C89778DbB11f42`).
**Rule:** everything additive — v2 single-leg behavior stays identical. v2's steward fixes are NOT part of the milestone.

Full adversarial research: `MILESTONE_RESEARCH.md` (30 attack vectors + mitigations, dashboard IA, scoring guidance).

---

## Phase 1 — Contract v3 (4 features, 1 commit each)

### Commit 1: `feat(appeals)` — bonded appeal flow
- `assess_delivery` records the verdict but does NOT pay out → status `AWAITING_APPEAL`, per-shipment `appeal_window_sec` (default 86400 = 24h; **on-chain enforced 300s min / 86400s max** — the floor stops shippers griefing carriers with tiny windows, the ceiling stops appeal windows holding escrow hostage; 5-min floor makes live StudioNet testing feasible).
- `appeal_assessment` (payable, 0.05 GEN bond, shipper/carrier only, one per shipment, before deadline).
- `resolve_appeal` — second jury on the same hash-bound photo + dispute note: note labeled UNTRUSTED with injection neutralization (GMV pattern) **plus sanitization** — strip newlines/control chars, 280-char limit, wrapped in explicit tags, system rule that photo pixels override text claims.
- `settle_shipment` — permissionless, after deadline, executes the recorded payout (liveness if parties vanish).
- **Directional bond:** refunded ONLY if the new verdict improves the appellant's payout share (carrier: new_bps > old_bps; shipper: new_bps < old_bps). Otherwise slashed to the counterparty — never left as residual wei in the contract (keeps the finalize balance equation exact). No appeal-of-appeal.
- Key attacks killed: spam appeals (bond + one-per-shipment), prompt injection via dispute note (labeled untrusted + sanitized + dedicated test), post-payout appeals (state machine), paused-protocol limbo (appeals respect pause; pause only delays, never redirects).

### Commit 2: `feat(penalties)` — late-delivery penalties
- `create_shipment` accepts optional `deadline_unix` + `penalty_bps` (**1h minimum lead time enforced on-chain** — never UI-only, so bypassing the UI can't create predatory deadlines; max 20%).
- `evidence_time` = consensus-pinned tx time recorded at `submit_evidence` — never user-supplied, backdating impossible. Deadline checked against `evidence_time`, NOT assessment/settle time (so a slow assessor can't manufacture lateness).
- Penalty = carrier's post-verdict share × bps / 10000 (can't underflow by construction).
- Deterministic math — NOT jury-decided, NOT appealable. TOTAL_LOSS → carrier share 0 → penalty no-op.
- **Live-test strategy:** order the suite so the late shipment's evidence lands last (jury rounds on StudioNet take a while); the 1h floor stays on-chain.

### Commit 3: `feat(reputation)` — on-chain reputation
- `reputation: TreeMap[str, str]` (keys normalized `.strip().lower()`), updated ONLY on terminal settlement.
- Self-dealt (shipper==carrier) and dust (< 0.1 GEN) shipments excluded; cancelled never count.
- Failed appeals hurt the appellant (`appeals_lost`); score = weighted intact-rate, formula public.
- New `get_reputation` view **plus `get_reputation_leaderboard`** — tracked participant list, single walletless RPC read for the dashboard board. Fresh wallets show "Unproven", never a fake-good score.

### Commit 4: `feat(multileg)` — multi-leg shipments
- `create_shipment` accepts ordered `legs_json` (1–8 legs, per-leg carrier + amount; amounts must sum to escrow).
- Sequential legs; per-leg evidence (hash-bound), verdict, appeal window, penalty.
- **Chain-of-custody:** leg N's jury sees leg N−1's verdict as labeled baseline — blame-shifting solved structurally. Verdict semantics are incremental: INTACT = no *new* damage beyond the baseline.
- **Strict gating:** leg N must be SETTLED (appeal window closed, payout released) before leg N+1 can be assessed — the baseline is only usable once it's final.
- TOTAL_LOSS aborts the route (downstream escrow refunds, no standby fees); 72h per-leg stall timeout with shipper-only `cancel_leg`.
- Invariant: at most one non-terminal leg at a time (auditable state machine).

---

## Cross-cutting implementation notes (merged from review)
- Bump `_MAX_HISTORY` 200 → 500 — appeals, per-leg events, and settlements across 6 history tabs would clip the v2 buffer during full test runs.
- Update `tests/finalize.mjs` balance equation — v2 sums escrow/payout/refund only; v3 must also account appeal bond deposits, bond refunds/slashes, and ABORTED-leg refunds, or the wei-exact check breaks.
- Appeal window rationale (documented): default 24h covers all timezones for a global carrier base while not holding escrow hostage; the 300s floor exists so live StudioNet tests can settle; the 86400s ceiling prevents indefinite escrow lock.
---

## Phase 2 — Dashboard overhaul (1 commit)

### Commit 5: `feat(dashboard)` — sidebar app, tabbed history, leg timeline
- **Sidebar** (desktop) / bottom nav (mobile): Dashboard · Shipments · History · Reputation · Settings · Admin (owner-only).
- **Dashboard home:** stat cards + "Needs your attention" panel (your pending actions, appeal windows closing < 6h).
- **Shipments:** create form (own page) + grid with status filters + **shipment detail view with leg timeline stepper** (the 5-second steward visual).
- **History:** 6 tabs — All / Shipments / Verdicts / Appeals / Payouts & Penalties / Protocol — with composed filters (search, verdict, date, "only mine") + CSV export.
- **Reputation:** leaderboard, address lookup ("check a carrier before you ship"), exact formula footnote.
- **Settings:** contract override, RPC status, theme toggle, notification prefs.
- **Admin:** owner pause/resume moved out of the main flow.

---

## Phase 3 — Verification (1 commit)

### Commit 6: `docs(milestone)` — proof package
- Full adversarial suite: all v2 scenarios + new attack-vector tests (outsider appeal, double appeal, hostile appeal note, late-penalty math to the wei, self-deal reputation exclusion, 3-leg happy path, blame-shift liability, stall cancel, cross-leg permission rejection).
- `docs/VERIFICATION.md`: new deployment, scenario matrix, explorer-linked txs, to-the-wei accounting.
- `CHANGELOG.md` v3 section + README "What's new in v3" before/after table.
- 2–3 min demo walkthrough (multi-leg → appeal → penalty → reputation).

---

## Phase 4 — Ship
1. Deploy v3 to StudioNet (new address, Atlas).
2. Ameer: repo push (Termux), dashboard redeploy (Vercel), milestone submission (portal, field-by-field).

---

## Commit strategy (GitHub clarity)
Six commits, one feature each, conventional-commit style, each body stating the v2→v3 delta. A steward opening the repo sees exactly what changed in 30 seconds; the README before/after table + verification doc prove it in 5 minutes.

## Pitfalls guarded
- v2 fixes are NOT the milestone (would fail "beyond the original").
- No UI-only milestone — contract features lead, dashboard follows.
- Single-leg v2 behavior regression-tested unchanged.
- Reputation only on terminal states; penalty never appealable; appeal window on-chain bounded (300s–86400s, default 24h) with rationale documented.
- **Every control must be real (2026-10-19, Ameer's rule):** no dummy clicks anywhere — every button wired to the contract, every number from chain, no placeholder tabs or mock data. A control that can't work yet doesn't ship.
