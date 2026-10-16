# Waybill — Verification

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
- **Automatic split payouts.** The verdict decides the money, and the
  contract sends it as real value transfers at finalization:
  INTACT pays the carrier 100%, MINOR_DAMAGE splits 85/15,
  MAJOR_DAMAGE splits 40/60, TOTAL_LOSS refunds the shipper 100%.
- **Cancellation with full refund.** Before any evidence is submitted, I can
  cancel a shipment and the whole escrow comes back.
- **Emergency pause.** As the owner I can freeze assessments. While paused,
  every assessment fails closed and no state changes.
- **Full on-chain history.** Every shipment, evidence submission, verdict,
  and payout is logged and readable through the view methods.

## 2. How I tested it

I ran the suite in `tests/` against the StudioNet test deployment of this
exact contract file:

- Test contract: `0x1290Bb9a5B6b897f01184bdC5650c5065896E570`
  ([explorer](https://explorer-studio.genlayer.com/address/0x1290Bb9a5B6b897f01184bdC5650c5065896E570))
- Network: GenLayer StudioNet, chain 61999
- Wallets: two test wallets, one as shipper (creates shipments, locks escrow)
  and one as carrier (submits evidence, receives payouts)
- The suite is runnable: `tests/README.md` has the commands. Keys go through
  environment variables only — nothing with a private key is in this repo.

**9/9 scenarios passed.** Raw results are committed in
`tests/results/results.json`, `tests/results/finalize.json`, and the
human-readable `tests/results/test-log.txt`.

| # | Scenario | Result | What it proved |
|---|----------|--------|----------------|
| 1 | protocol_state | PASS | Clean start: not paused, 0 shipments, 0 balance |
| 2 | create_shipment_escrow | PASS | 0.5 GEN locked, status CREATED |
| 3 | submit_evidence | PASS | Photo + note accepted, status IN_REVIEW |
| 4 | jury_intact | PASS | INTACT at 95% confidence, carrier paid the full 0.5 GEN |
| 5 | jury_damaged | PASS | TOTAL_LOSS at 99% confidence, shipper refunded the full 0.5 GEN |
| 6 | cancel_refund | PASS | Shipment cancelled before evidence, status CANCELLED |
| 7 | pause_gate | PASS | Assessment while paused fails with execution ERROR, state untouched |
| 8 | resume_then_assess | PASS | After resume, assessment works: INTACT, RESOLVED |
| 9 | aggregate_reads | PASS | 4 shipments, 13 history events, balances consistent |

**Payouts verified to the wei** (`tests/results/finalize.json`):

| Wallet | Before | After | Expected | Match |
|--------|--------|-------|----------|-------|
| Shipper | 100.0000 GEN | 99.2500 GEN | 99.2500 GEN | yes |
| Carrier | 0.0000 GEN | 0.7500 GEN | 0.7500 GEN | yes |

Every write transaction below reached FINALIZED on StudioNet. Click any hash
to see it on the explorer:

| Tx | Hash |
|----|------|
| create0 | [0x5535c972…e720e8](https://explorer-studio.genlayer.com/tx/0x5535c972fc9c909bb05e8f905a22b334827aaedb439d17e15e6416006ce720e8) |
| evidence0 | [0x9dc1d1ec…209e8](https://explorer-studio.genlayer.com/tx/0x9dc1d1ec413557a00ada106971da92a6c0d39c1011453c858daedee518a209e8) |
| assess0 | [0x26004209…cbfa](https://explorer-studio.genlayer.com/tx/0x260042094e80d173b4ef9410079a79b249f5af5cb91914cdb4759f878fa4cbfa) |
| create1 | [0x6cb26252…9cc24](https://explorer-studio.genlayer.com/tx/0x6cb26252ae0c6961ffc03db93fc097680b4c8946b2662be81d3b3b25e49be278a6b28ce22741c3e9d6f0c69b83d) |
| evidence1 | [0x00343414…49fcb9](https://explorer-studio.genlayer.com/tx/0x003434149948092bd4cb668f6ea8dc21f444a9d56320cb68715e40366049fcb9) |
| assess1 | [0x441274a5…d17dad5](https://explorer-studio.genlayer.com/tx/0x441274a56f36cc1e50f0ef72c7363811c4c60d22673f987c02beffa4fd17dad5) |
| create2 | [0x010c7c58…0ef0a9](https://explorer-studio.genlayer.com/tx/0x010c7c5873c49c545137faf3b3b25e49be278a6b28ce22741c3e9d6f0c69b83d) |
| cancel2 | [0xd1c5687f…2433d68](https://explorer-studio.genlayer.com/tx/0xd1c5687f549e14665135a22a195343431d77a79da0ef0a94146bff3582433d68) |
| create3 | [0x0801c779…12d4f0b](https://explorer-studio.genlayer.com/tx/0x0801c779cc1c6da70155c75a961abfd192cccdfb31fd652810852485f12d4f0b) |
| pause | [0x77840159…0dce2a](https://explorer-studio.genlayer.com/tx/0x7784015965bfdf07a6037172d3d77afcf4f48e75e4f5d07b68677a8d6b0dce2a) |
| assessPaused | [0x9bb452cb…d1434ed79](https://explorer-studio.genlayer.com/tx/0x9bb452cbbb3d8efaa8e845e2df740cce93486b28e03b0f4ddacda18d1434ed79) |
| resume | [0x2fa9bad5…2433d68](https://explorer-studio.genlayer.com/tx/0x2fa9bad5ae3170803b7ae2538485e4346f28a99cbcaacdc6d74a5a60833ab3c2) |
| assess3 | [0x70d1bbc2…7875cb](https://explorer-studio.genlayer.com/tx/0x70d1bbc228ac9dcf73eba90a11cb5e3f26efe271d6ba2f7751986305467875cb) |

## 3. Honest notes

- These tests ran against the StudioNet **test deployment** of this exact
  contract file. The verdicts, splits, and payouts above are real on-chain
  results, not simulations.
- The production deployment from my own wallet is the next step. The contract
  file does not change between the test deployment and production.
- The jury is only as good as the photo: a clear, well-lit picture of the
  goods gives a confident verdict. That is by design — unclear evidence fails
  safe toward the shipper.
