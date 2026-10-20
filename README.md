# Waybill

Trustless freight settlement on GenLayer: the shipper locks real GEN escrow,
an AI vision jury grades the delivery from a photo, and the contract pays out
automatically. No intermediary, no chargebacks, no "he said, she said."

## Live deployments (GenLayer StudioNet, chain `61999`)

- **Contract (v2):** `0x22e6c4314c4c8D07b1875cB447C89778DbB11f42` — [explorer](https://explorer-studio.genlayer.com/address/0x22e6c4314c4c8D07b1875cB447C89778DbB11f42) · deployed and verified on StudioNet.
- **Contract (v1):** `0x1290Bb9a5B6b897f01184bdC5650c5065896E570` — [explorer](https://explorer-studio.genlayer.com/address/0x1290Bb9a5B6b897f01184bdC5650c5065896E570) · superseded by v2.
- **Verification record:** [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — specs, the 11/11 pass table, and every transaction hash with explorer links.
- **Test suite:** [`tests/`](tests/) — the runnable end-to-end suite, with raw results in [`tests/results/`](tests/results/).

## What changed in v2

A steward review asked for four hardening changes, and I built them in:

1. **Only the shipment's shipper or carrier can trigger the jury.** Anyone
   else gets rejected before any verdict logic runs.
2. **The photo is cryptographically bound to the evidence.** Submitting
   evidence commits the SHA-256 of the photo bytes; the jury can only grade
   bytes that hash to the committed value. Swapped photos fail closed.
3. **Storage key types fixed.** `shipments` and `assessment_history` now use
   string keys instead of the incompatible integer-key declarations.
4. **Two new adversarial scenarios** cover both gates, and all 9 original
   scenarios still pass — 11/11, payouts verified to the wei.

## What's new in v3

### On-chain reputation

Every settled shipment accrues a reputation record for its participants:

- **Carrier score** — a weighted intact-rate over completed deliveries:
  `score = (intact + 0.6 × minor + 0.25 × major) / completed`
  (stored in basis points). Only real jury-assessed shipments count.
- **Self-dealt and dust shipments are excluded** — a shipment where the
  shipper and carrier are the same wallet, or escrow is under 0.1 GEN,
  never touches reputation.
- **Appeal track record** — filing an appeal records `appeals_filed`; if the
  second jury upholds the verdict (bond slashed), `appeals_lost` increments
  on the appellant. Appeal win-rate is surfaced separately from the score.
- **Views** — `get_reputation(address)` returns the record; fresh wallets
  read `UNPROVEN`, never a fake-good score. `get_reputation_leaderboard(n)`
  returns the ranked carrier board in a single walletless read.

### Multi-leg shipments

A shipment can now be an ordered route of 1–8 legs, each with its own
carrier, escrow slice, photo evidence, jury verdict, appeal window, and
optional deadline/penalty:

- **Strictly sequential** — leg N+1 can't start until leg N is settled; at
  most one non-terminal leg exists at a time. Per-leg amounts must sum
  exactly to the escrow.
- **Chain-of-custody baseline** — leg N's jury sees leg N−1's final verdict
  as labeled context and grades *new* damage beyond it. Blame-shifting
  between carriers is solved structurally.
- **TOTAL_LOSS aborts the route** — downstream legs are marked ABORTED and
  their escrow refunds to the shipper in full; settled legs keep payouts.
- **Stall timeout** — if a leg's carrier goes silent for 72h, the shipper
  alone can `cancel_leg` the stalled leg; downstream escrow refunds.
- New writes: `submit_leg_evidence`, `assess_leg`, `appeal_leg`,
  `resolve_leg_appeal`, `settle_leg` (permissionless), `cancel_leg`
  (shipper-only). Single-leg shipments behave exactly as before.

## What it is

Freight delivery has a trust problem. The shipper pays upfront and hopes the
goods arrive intact; the carrier delivers and hopes to get paid. Waybill
removes both hopes from the equation:

1. **Ship** — I create a shipment as the shipper, name the carrier's wallet,
   and lock GEN escrow into the contract.
2. **Deliver** — the carrier delivers the goods and submits a photo plus a
   condition note as evidence.
3. **Judge** — GenLayer validators look at the actual photo and classify the
   damage: INTACT, MINOR_DAMAGE, MAJOR_DAMAGE, or TOTAL_LOSS.
4. **Settle** — the contract splits the escrow by the verdict and sends real
   GEN to both sides at finalization. Nobody clicks "release payment."

| Verdict | Carrier gets | Shipper refunded |
|---------|--------------|------------------|
| INTACT | 100% | 0% |
| MINOR_DAMAGE | 85% | 15% |
| MAJOR_DAMAGE | 40% | 60% |
| TOTAL_LOSS | 0% | 100% |

## Why this architecture

The hard constraint: a photo can't be hashed into a verdict by normal smart
contract logic — damage assessment is subjective, and whoever grades it holds
all the power. So I split the system the way GenLayer intends: the contract
(`Waybill.py`) owns the money and the rules, and the subjective call goes to
validator consensus over the real image bytes. The contract never trusts the
photo URL or the carrier's note for the verdict — only the jury's
classification, agreed by validators, moves funds. Unusable photos fail safe
to TOTAL_LOSS, so fake evidence can't steal escrow.

## Status

Tested end-to-end on StudioNet: 11/11 scenarios passed, payouts verified to the
wei — see `docs/VERIFICATION.md` for the full evidence with explorer links.

- [x] Contract written, deployed, and verified on StudioNet
- [x] Dashboard built (shipment cards, jury verdicts, owner controls)
- [x] Test suite runnable with committed raw results
- [ ] Vercel dashboard with the contract address

## Stack

- **Contract:** Python, GenLayer Intelligent Contracts (GenVM)
- **Consensus:** validator `exec_prompt` with image inputs + comparative agreement
- **Dashboard:** React 18 + Vite + Tailwind, `genlayer-js`
- **Tests:** Node.js scripts against StudioNet (`tests/`)
- **Network:** GenLayer StudioNet, chain 61999

## Architecture at a glance

`Waybill.py` holds shipments, escrow, evidence URLs, verdicts, and a full
history log. `create_shipment` is payable (escrow = msg.value).
`submit_evidence` records the photo URL and flips the shipment to IN_REVIEW.
`assess_delivery` takes the raw image bytes, runs the vision jury, records
the verdict, and queues both transfers. The dashboard (`src/`) downscales
photos client-side, uploads a viewable copy, and drives the two-step
evidence flow. Everything state-changing is a signed write; all reads are
walletless views.

## Repository layout

```
Waybill.py              # the intelligent contract (GenVM Python)
src/                    # dashboard (React + Vite + Tailwind)
  components/           # shipment cards, forms, owner panel, history feed
  lib/                  # genlayer client, config, photo upload
tests/
  run.mjs               # end-to-end suite (9 scenarios, env keys only)
  finalize.mjs          # finalization + exact-payout verifier
  README.md             # how to run the suite
  results/              # recorded run: results.json, finalize.json, test-log.txt
  intact-800.jpg / damaged-800.jpg   # jury test photos
docs/
  VERIFICATION.md       # specs, 9/9 results, explorer-linked tx hashes
index.html / package.json / vite.config.js  # dashboard scaffolding
```

## Deploy the contract

1. Open [GenLayer Studio](https://studio.genlayer.com), connect your wallet,
   top up from the faucet if needed.
2. New contract → paste the contents of `Waybill.py` → Deploy → confirm.
3. Check the address on the
   [StudioNet explorer](https://explorer-studio.genlayer.com).

## Run the dashboard locally

```bash
npm install
cp .env.example .env   # set VITE_CONTRACT_ADDRESS to your deployed address
npm run dev
```

For production: push this repo to GitHub, import it in Vercel (Vite is
auto-detected), and set `VITE_CONTRACT_ADDRESS`. The dashboard also has a
**Set contract** button at runtime (saved to localStorage).

## Run the tests

```bash
cd tests
WB_CONTRACT=0xYourContract WB_KEY_A=0xShipperKey WB_KEY_B=0xCarrierKey node run.mjs
node finalize.mjs
```

See `tests/README.md` and `docs/VERIFICATION.md` for details. Keys are never
committed.

## Smoke test (two wallets)

1. Fund two wallets with test GEN from inside GenLayer Studio.
2. As shipper: create a shipment with `0.5 GEN` escrow, carrier = second wallet.
3. As carrier: attach a delivery photo + note → **Submit photo & run jury**.
4. Watch the verdict card, then check the explorer — payouts land at finalization.
5. As owner: **Pause protocol** → assessments block → **Resume**.

## License

MIT — see LICENSE.
