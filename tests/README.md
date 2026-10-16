# Waybill test suite

Runnable end-to-end verification for the Waybill intelligent contract. It runs
against a live StudioNet deployment and exercises the full shipment lifecycle
with two wallets: escrow, evidence, the AI vision jury, payouts, cancellation,
the pause gate, and aggregate reads.

## Run it

```bash
cd tests
npm install   # needs genlayer-js and viem (or reuse the dashboard's node_modules)
WB_CONTRACT=0xYourContract \
WB_KEY_A=0xShipperPrivateKey \
WB_KEY_B=0xCarrierPrivateKey \
node run.mjs
node finalize.mjs
```

- `WB_CONTRACT` — the Waybill deployment to test. Defaults to the StudioNet
  test deployment documented in `docs/VERIFICATION.md`.
- `WB_KEY_A` — shipper wallet (creates shipments, locks escrow, owns the pause switch).
- `WB_KEY_B` — carrier wallet (submits evidence, receives payouts).
- Keys go through environment variables only. Nothing with a private key is
  committed to this repo, ever.
- The suite expects a **fresh** deployment (shipment ids start at 0).

`run.mjs` writes `results/results.json` (9 scenarios + every tx hash).
`finalize.mjs` waits for the payout transactions to reach FINALIZED and checks
every wei moved exactly as the contract recorded, writing
`results/finalize.json`.

The `results/` folder also holds the recorded run from the StudioNet test
deployment: `results.json`, `finalize.json`, and the human-readable
`test-log.txt`. Re-running the suite overwrites them with fresh results.

The jury photos used by the suite are `intact-800.jpg` and `damaged-800.jpg`.
