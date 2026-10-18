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
- **Cryptographically bound evidence (v2).** When evidence is submitted, the
  SHA-256 of the photo bytes is committed on-chain. The jury can only grade
  bytes that hash to the committed value — swapping the photo afterwards
  fails closed with no state change.
- **Participant-only assessment (v2).** Only the shipper or the carrier of a
  shipment can trigger the jury. Outsiders are rejected before any verdict
  logic runs.
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

The suite in `tests/` runs against the StudioNet deployment of this
exact contract file:

- Test contract: `0x22e6c4314c4c8D07b1875cB447C89778DbB11f42`
  ([explorer](https://explorer-studio.genlayer.com/address/0x22e6c4314c4c8D07b1875cB447C89778DbB11f42))
- Network: GenLayer StudioNet, chain 61999
- Wallets: three test wallets — one as shipper (creates shipments, locks
  escrow), one as carrier (submits evidence, receives payouts), and a third
  as an outsider for the negative security tests
- The suite is runnable: `tests/README.md` has the commands. Keys go through
  environment variables only — nothing with a private key is in this repo.

**11/11 scenarios passed.** Raw results are committed in
`tests/results/results.json`, `tests/results/finalize.json`, and the
human-readable `tests/results/test-log.txt`.

| # | Scenario | Result | What it proved |
|---|----------|--------|----------------|
| 1 | protocol_state | PASS | Clean start: not paused, 0 shipments, 0 balance |
| 2 | create_shipment_escrow | PASS | 0.5 GEN locked, status CREATED |
| 3 | submit_evidence | PASS | Photo + note + SHA-256 commitment accepted, status IN_REVIEW |
| 4 | jury_intact | PASS | INTACT at 98% confidence, carrier paid the full 0.5 GEN |
| 5 | jury_damaged | PASS | TOTAL_LOSS at 99% confidence, shipper refunded the full 0.5 GEN |
| 6 | cancel_refund | PASS | Shipment cancelled before evidence, status CANCELLED |
| 7 | pause_gate | PASS | Assessment while paused fails with execution ERROR, state untouched |
| 8 | resume_then_assess | PASS | After resume, assessment works: INTACT, RESOLVED |
| 9 | outsider_assessment_blocked | PASS | Third wallet's assessment rejected with ONLY_PARTY_ASSESS, shipment stays IN_REVIEW, no payout |
| 10 | evidence_mismatch_blocked | PASS | Assessment with swapped photo bytes rejected with EVIDENCE_MISMATCH, shipment stays IN_REVIEW, no payout |
| 11 | aggregate_reads | PASS | 6 shipments, 17 history events, balances consistent |

**Payouts verified to the wei** (`tests/results/finalize.json`):

| Wallet | Before | After | Expected | Match |
|--------|--------|-------|----------|-------|
| Shipper | 83.5500 GEN | 82.3000 GEN | 82.3000 GEN | yes |
| Carrier | 6.7500 GEN | 7.5000 GEN | 7.5000 GEN | yes |

Every write transaction below reached FINALIZED on StudioNet. Click any hash
to see it on the explorer:

| Tx | Hash |
|----|------|
| deploy | [0x62a876a2…ca4ab6](https://explorer-studio.genlayer.com/tx/0x62a876a2aaf9dc882954f1276e4967328be1f648d9690645731fb9bffca4ab6a) |
| create0 | [0x5716ba8f…5e88d02](https://explorer-studio.genlayer.com/tx/0x5716ba8ff3352d263384ac7dacb469b2cbd8ed8d7cef94cfc2ad162cc5e88d02) |
| evidence0 | [0xb56048e0…9f2c3d](https://explorer-studio.genlayer.com/tx/0xb56048e0e840d293d65eee3fa2c276b850acc51a37fd7b2be5509998509f2c3d) |
| assess0 | [0x5c813bbe…4527ac8](https://explorer-studio.genlayer.com/tx/0x5c813bbe8fe3e23e44a5b1841a7c5beb8718a822be7b17de50b3074527ac8543) |
| create1 | [0x6536e648…438b7f52](https://explorer-studio.genlayer.com/tx/0x6536e648267a6ce9c15ef44a1598b312e97ba7ac2db1721d6098d968438b7f52) |
| evidence1 | [0xd2783573…05c23a61](https://explorer-studio.genlayer.com/tx/0xd2783573acb919c3cd2fac15beea7effb18d6561d4f2fb4036bbfff05c23a61b) |
| assess1 | [0x6bd7975e…b621963d](https://explorer-studio.genlayer.com/tx/0x6bd7975e0d7fb5a10e803534befb53befb6dac43da8360f24e7d6b5b621963d1) |
| create2 | [0x0b823400…517945b3](https://explorer-studio.genlayer.com/tx/0x0b82340088e3ca7c87968d75fd528af9234c18df1af7a647c9ccc0b3517945b3) |
| cancel2 | [0x5f7741f6…6363d9eb](https://explorer-studio.genlayer.com/tx/0x5f7741f614186b3c06f7be0305d0d23eba857aec43bf01c4e2e2bf166363d9eb) |
| create3 | [0xbfc2da86…f732d70](https://explorer-studio.genlayer.com/tx/0xbfc2da866f816e109f80188a5c093b294e44e9829549d13dc5e9ae046f732d70) |
| pause | [0x02dcff67…0f440a52](https://explorer-studio.genlayer.com/tx/0x02dcff67932f9a2c2e8d24d6bb09ec7f304a7bb1369ff328bfcb5dae0f440a52) |
| assessPaused | [0xe685f0a1…b96a607](https://explorer-studio.genlayer.com/tx/0xe685f0a18cb90078d8d6ed29859b34c7e6db2e30dc041a935007ea825b96a607) |
| resume | [0xa00f82c3…54cfc28](https://explorer-studio.genlayer.com/tx/0xa00f82c3dce8ef66bc6a3f67ca1a6246c4f140e8e3c2390a73145141f54cfc28) |
| assess3 | [0xdfb03e73…70f5cfce](https://explorer-studio.genlayer.com/tx/0xdfb03e7375ffb1fa3d9451d3430585a6a76b135298dc37b93fe16e170f5cfce5) |
| create4 | [0x81caf064…57707b8](https://explorer-studio.genlayer.com/tx/0x81caf0649dd2df98a8bf4e9a4f6f1f96e825596e0fffc4539214c9757b7707b8) |
| evidence4 | [0xbb451d3e…96f8317b](https://explorer-studio.genlayer.com/tx/0xbb451d3e2a3ffa0158c042acf1384b1039065634c2bd0f458a35183b96f8317b) |
| assessOutsider | [0x6ba7ad42…61ba766](https://explorer-studio.genlayer.com/tx/0x6ba7ad42429f984ff72c87fd3af435221c0424f866b77e0cb8a70423761ba766) |
| create5 | [0x7d96e428…94a44419](https://explorer-studio.genlayer.com/tx/0x7d96e4285d55e99e5ae21d6bc668e06ed77962ee788eaaa96ffed57994a44419) |
| evidence5 | [0x3463de48…4263725e](https://explorer-studio.genlayer.com/tx/0x3463de488f0ac4fe43ceef5496fc0eb92713b82e6de7419c90af74b4263725e9) |
| assessMismatch | [0xd23b3ab7…a4bd2](https://explorer-studio.genlayer.com/tx/0xd23b3ab7a911371d09afe2d10c38732464c1686ed18b2971a66a463f206a4bd2) |

## 3. Honest notes

- These tests ran against the StudioNet deployment of this contract. The
  verdicts, splits, and payouts above are real on-chain results, not
  simulations.
- The contract file is final.
- The jury is only as good as the photo: a clear, well-lit picture of the
  goods gives a confident verdict. That is by design — unclear evidence fails
  safe toward the shipper.
- The two negative scenarios (S9, S10) leave their shipments IN_REVIEW with
  escrow locked, exactly as designed — a blocked assessment changes nothing.
