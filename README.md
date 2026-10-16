# Waybill

Trustless freight settlement on GenLayer: the shipper locks real GEN escrow,
an AI vision jury grades the delivery from a photo, and the contract pays out
automatically. No intermediary, no chargebacks, no "he said, she said."

## Live deployments (GenLayer StudioNet, chain `61999`)

- **Contract:** `0x1290Bb9a5B6b897f01184bdC5650c5065896E570` — [explorer](https://explorer-studio.genlayer.com/address/0x1290Bb9a5B6b897f01184bdC5650c5065896E570) · deployed and verified on StudioNet.
- **Verification record:** [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — specs, the 9/9 pass table, and every transaction hash with explorer links.
- **Test suite:** [`tests/`](tests/) — the runnable end-to-end suite, with raw results in [`tests/results/`](tests/results/).

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

Tested end-to-end on StudioNet: 9/9 scenarios passed, payouts verified to the
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
