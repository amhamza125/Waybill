# Waybill test suite (v2)

Runnable end-to-end verification for the Waybill intelligent contract. It runs
against a live StudioNet deployment and exercises the full shipment lifecycle
with three wallets: escrow, evidence with SHA-256 commitment, the AI vision
jury, payouts, cancellation, the pause gate, the two v2 security gates
(outsider assessment blocked, evidence mismatch blocked), and aggregate reads.

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

- `WB_CONTRACT` — the Waybill v2 deployment to test. Documented in
  `docs/VERIFICATION.md`.
- `WB_KEY_A` — shipper wallet (creates shipments, locks escrow, owns the pause switch).
- `WB_KEY_B` — carrier wallet (submits evidence, receives payouts).
- `WB_KEY_C` — optional outsider wallet for the S10 negative test. If unset,
  the suite generates an ephemeral key and funds it with 0.2 GEN from the
  shipper before the balance snapshot, so payout math stays exact.
- Keys go through environment variables only. Nothing with a private key is
  committed to this repo, ever.
- The suite expects a **fresh** deployment (shipment ids start at 0).

`run.mjs` writes `results/results.json` (11 scenarios + every tx hash).
`finalize.mjs` waits for the payout transactions to reach FINALIZED and checks
every wei moved exactly as the contract recorded, writing
`results/finalize.json`.

The `results/` folder also holds the recorded run from the StudioNet
deployment: `results.json`, `finalize.json`, and the human-readable
`test-log.txt`. Re-running the suite overwrites them with fresh results.

The jury photos used by the suite are `intact-800.jpg` and `damaged-800.jpg`.
Every `submit_evidence` call commits the SHA-256 of the exact photo bytes,
and `assess_delivery` verifies the binding on-chain.
