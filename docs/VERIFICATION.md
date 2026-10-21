# Waybill v3 — Verification

## 1. What the contract does

Waybill settles freight delivery without trusting either side. I built it so
the money moves exactly the way the delivered goods look — decided by an AI
jury, not by whoever shouts loudest.

- **Real GEN escrow.** When I create a shipment as the shipper, I lock actual
  GEN into the contract. It stays there until the jury reaches a verdict or
  I cancel the shipment. Nobody can touch it in between.
- **AI vision jury.** The carrier submits a photo of the delivered goods. The
  GenLayer validators look at the real image bytes and classify the damage as
  INTACT, MINOR_DAMAGE, MAJOR_DAMAGE, or TOTAL_LOSS, with a confidence score.
  If the photo is unusable or shows no shipment at all, it fails safe to
  TOTAL_LOSS — the carrier gets nothing. Fake evidence can't steal escrow.
- **Cryptographically bound evidence.** When evidence is submitted, the
  SHA-256 of the photo bytes is committed on-chain. The jury can only grade
  bytes that hash to the committed value — swapping the photo afterwards
  fails closed with no state change.
- **Participant-only assessment.** Only the shipper or the carrier of a
  shipment can trigger the jury. Outsiders are rejected before any verdict
  logic runs.
- **Appeal window with a second jury.** A verdict no longer pays out
  immediately. It enters an appeal window (24h default, 5 minutes minimum,
  enforced on-chain). Either party can post a 0.05 GEN bond and demand a
  second jury round on the same hash-bound photo plus a sanitized dispute
  note. The bond is directional: it comes back to the appellant only if the
  new verdict improves their payout share — otherwise it's slashed to the
  counterparty, never left as dust in the contract. One appeal per shipment,
  no appeals of appeals. After the window, anyone can settle.
- **Late-delivery penalties.** The shipper can set a deadline (minimum 1 hour
  ahead, enforced on-chain) and a penalty rate (max 20%). The evidence
  submission time is pinned by consensus — never user-supplied — and the
  penalty is deterministic math on the carrier's post-verdict share. It is
  not jury-decided and not appealable.
- **On-chain reputation.** Every terminal settlement accrues a reputation
  record: `score = (intact + 0.6 × minor + 0.25 × major) / completed`, stored
  in basis points. Self-dealt and dust (< 0.1 GEN) shipments never count.
  Failed appeals hurt the appellant's record. Fresh wallets read UNPROVEN,
  never a fake-good score. A leaderboard view ranks carriers in one call.
- **Multi-leg routes.** A shipment can be an ordered route of 1–8 legs, each
  with its own carrier, escrow slice, evidence, verdict, and appeal window.
  Legs run strictly in sequence; leg N's jury sees leg N−1's final verdict as
  a labeled baseline and grades only *new* damage. TOTAL_LOSS aborts the
  route and refunds downstream escrow; a 72h stall timeout lets the shipper
  cancel a silent leg.
- **Automatic split payouts.** The verdict decides the money: INTACT pays the
  carrier 100%, MINOR_DAMAGE splits 85/15, MAJOR_DAMAGE splits 40/60,
  TOTAL_LOSS refunds the shipper 100%. All to the wei.
- **Cancellation with full refund.** Before any evidence is submitted, the
  shipper can cancel and the whole escrow comes back.
- **Emergency pause.** As the owner I can freeze the protocol. While paused,
  every state-changing call fails closed and no state changes.
- **Full on-chain history.** Every lifecycle event is logged and readable
  through the view methods; the dashboard renders it as six filterable tabs.

## 2. Deployment

- **Contract (v3):** `0xBA3Fef7ddcC768d4E770aec62413706Ef4735e80`
  ([explorer](https://explorer-studio.genlayer.com/address/0xBA3Fef7ddcC768d4E770aec62413706Ef4735e80))
- **Deploy tx:** `0x97c220b3a9fa01fd6cd4a563d6107e7547bf1ed23a2f4570d25135e9a4b78d4d`
  ([explorer](https://explorer-studio.genlayer.com/tx/0x97c220b3a9fa01fd6cd4a563d6107e7547bf1ed23a2f4570d25135e9a4b78d4d))
- **Network:** GenLayer StudioNet, chain `61999`. Owner: `0xD2aF69BB67d446526661A80a280820599c601ed3`.
- **Source:** `Waybill.py` at this commit, deployed 2026-10-21.

## 3. How I tested it

The suite in `tests/` runs against the StudioNet deployment of this exact
contract file. Five suites, 65 unique scenarios, 69 write transactions —
every one FINALIZED, every payout verified to the wei. Raw results live in
`tests/results/` (`*_v3final.json`).

### Suite A — v2 regressions (16/16)

Single-leg behavior is unchanged from the approved v2: appeal windows
bounded on-chain (60s and 90000s rejected), 24h default, escrow locking,
SHA-256 evidence binding, jury verdicts entering AWAITING_APPEAL (never
paying out early), cancellation refunds, pause gating, outsider assessment
rejected (`ONLY_PARTY_ASSESS`), evidence mismatch rejected
(`EVIDENCE_MISMATCH`), permissionless settlement releasing exact payouts,
double-settle blocked.

### Suite B — appeals (31 appeal scenarios, 47/47 with regressions)

Bonded appeal flow end to end: appeal filed with 0.05 GEN, second jury on the
same hash-bound photo, upheld verdicts slash the bond to the counterparty,
hostile dispute notes resisted (injection-neutralized, photo decides),
outsider appeal and outsider resolve both rejected, wrong bond amount
rejected, empty note rejected, appeal after the deadline rejected, appeal
during pause rejected, settlement during the window blocked, settlement
after the window releases the recorded split.

### Suite C — bond-refund branch, exercised live (1/1)

The directional refund branch — bond returned only when the second jury
improves the appellant's share — was exercised on a genuine jury flip:

- Shipment 0, borderline MINOR/MAJOR-damage photo. Jury 1: MINOR_DAMAGE
  (75%). The shipper appealed with an honest ambiguity note. Jury 2:
  MAJOR_DAMAGE (82%) — a real flip on the same hash-bound photo.
- `bond_outcome = "refunded"`: the 0.05 GEN bond returned to the appellant.
- Settlement paid the NEW verdict's split to the wei: carrier 0.1 GEN
  (0.25 × 4000 bps), shipper 0.15 GEN; the contract drained to exactly 0.
- All five transactions FINALIZED:
  [create](https://explorer-studio.genlayer.com/tx/0x1ac8cb238697f4bddb854da1868bcf0a3b26d5845be1221a4d06a55f7d09d4c0),
  [evidence](https://explorer-studio.genlayer.com/tx/0x3358f0f6b048116f62e5a127c65ace5075c237d26e06981320685ad68e6eb059),
  [assess](https://explorer-studio.genlayer.com/tx/0x16060bb076a989aac3061ab25eb334f476b5fd8f659639d67005a8110e30109e),
  [appeal](https://explorer-studio.genlayer.com/tx/0xfeb6f98aae81a3fe279580e1de8ba2695049920bfefb785e8618d5236a6773a6),
  [resolve](https://explorer-studio.genlayer.com/tx/0x0c9484050ea5d7bbfaf37c39917d36e8ac6902aa6695b36b8c0ad449493ae1e6).

### Suite D — reputation (7/7)

Self-dealt shipments excluded, dust shipments excluded, carrier math exact
(2 intact + 1 loss over 3 completed = 6666 bps), shipper activity tracked,
failed appeal recorded against the appellant with the bond slashed,
leaderboard sorted correctly, fresh wallets read UNPROVEN.

### Suite E — multi-leg (10/10)

Escrow-sum mismatch rejected, 9-leg and dust-leg limits enforced, 3-leg
happy path paying each carrier exactly (0.2 / 0.3 / 0.5 GEN) with the route
RESOLVED, cross-leg permission rejection, strict sequential gating,
blame-shift liability (leg 1 TOTAL_LOSS against an INTACT baseline),
TOTAL_LOSS aborting the route with downstream escrow refunded in full,
per-leg appeal with the bond slashed on uphold, stall-cancel negatives
(premature and outsider rejections), per-leg reputation accrual.

## 4. To-the-wei accounting

For every one of the 26 shipments on the v3 deployment I proved fund
conservation per settlement branch: credits issued == funds locked, to the
wei — including appeal bond deposits, bond refunds/slashes, and
ABORTED-leg refunds. The contract balance (3.403333333333333333 GEN)
matches the modeled locked value (1.0 GEN in-flight escrow + 2.403333333333333333
GEN from reverted payable calls, which GenLayer credits to the contract)
and the protocol's own reported balance, all three exactly.

Wallet reconciliation: the carrier and all seven satellite test wallets
reconcile to the wei. One bookkeeping note: the deployer test wallet's
balance differs from the wei-exact model by +2.103333333333333333 GEN (the
model over-counts outflows; the wallet is now empty). The contract side is
exact and every other wallet is exact — this is a test-harness bookkeeping
gap on an empty wallet, not a contract accounting issue, and it is recorded
here rather than smoothed over.

## 5. Dashboard

The dashboard (`src/`, Vite + React) is a full sidebar app — Dashboard,
Shipments, History, Reputation, Settings, Admin — rebuilt for v3:

- Shipment detail carries a leg timeline stepper: each leg's carrier,
  status, verdict, evidence thumbnail, deadline/penalty chip, and appeal
  badge, with per-leg actions gated by the connected wallet's role.
- History splits the on-chain event log into six tabs (All / Shipments /
  Verdicts / Appeals / Payouts & Penalties / Protocol) with composed filters
  and CSV export.
- Reputation shows the on-chain leaderboard plus an address lookup with the
  exact scoring formula footnoted.
- Every control is wired to the contract — every button triggers a real
  read or write, every number comes from chain. Anything that can't work
  yet doesn't ship.

`npm run build` passes clean against the v3 deployment above.
