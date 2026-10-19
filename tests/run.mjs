// Waybill v3 regression test suite (v2's 11 scenarios, adapted for the appeal lifecycle).
// Run from tests/:  WB_CONTRACT=0x... WB_KEY_A=0x... WB_KEY_B=0x... WB_KEY_C=0x... node run.mjs
// Then: node run_appeals.mjs && node finalize.mjs
// Keys are NEVER committed — pass them via environment only.
// The suite expects a FRESH Waybill v3 deployment (shipment ids start at 0).
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

const ADDR = process.env.WB_CONTRACT;
if (!ADDR) { console.error('Set WB_CONTRACT env var.'); process.exit(1); }
const KEY_A = process.env.WB_KEY_A;
const KEY_B = process.env.WB_KEY_B;
if (!KEY_A || !KEY_B) {
  console.error('Set WB_KEY_A (shipper) and WB_KEY_B (carrier) env vars. Keys are never stored in the repo.');
  process.exit(1);
}
// Outsider wallet for negative tests: third key from env, or fresh ephemeral key funded below.
const KEY_C = process.env.WB_KEY_C || generatePrivateKey();
const shipperAcct = privateKeyToAccount(KEY_A);
const carrierAcct = privateKeyToAccount(KEY_B);
const outsiderAcct = privateKeyToAccount(KEY_C);
const shipper = createClient({ chain: studionet, account: shipperAcct });
const carrier = createClient({ chain: studionet, account: carrierAcct });
const outsider = createClient({ chain: studionet, account: outsiderAcct });
const ro = createClient({ chain: studionet });
const GEN = 10n ** 18n;
const WIN = 300; // 5-minute appeal windows for test shipments (on-chain minimum)
const results = { contract: ADDR, shipper: shipperAcct.address, carrier: carrierAcct.address, outsider: outsiderAcct.address, steps: [], txs: {} };
const log = (...a) => console.log(...a);
const step = (name, pass, info) => { results.steps.push({ name, pass, info }); log(`[${pass ? 'PASS' : 'FAIL'}] ${name} :: ${info}`); };
const bal = async (a) => { const r = await fetch('https://studio.genlayer.com/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [a, 'latest'] }) }); return BigInt((await r.json()).result); };
const wait = (client, hash) => client.waitForTransactionReceipt({ hash, status: 'ACCEPTED', retries: 240, interval: 5000 });
const readShip = async (id) => JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_shipment', args: [id] }));
const sha256hex = (bytes) => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
// Extract any error text from a receipt for negative-test assertions.
const errText = (rp) => {
  try { return JSON.stringify(rp.consensus_data?.leader_receipt?.[0] ?? rp); } catch { return ''; }
};
const execErr = (rp) => rp.consensus_data?.leader_receipt?.[0]?.execution_result === 'ERROR';

// Fund the outsider with gas money from the shipper BEFORE the balance snapshot,
// so payout math in finalize.mjs stays exact.
const fundAmt = GEN / 5n; // 0.2 GEN
{
  const fh = await shipper.sendTransaction({ to: outsiderAcct.address, value: fundAmt });
  await shipper.waitForTransactionReceipt({ hash: fh, status: 'ACCEPTED', retries: 120, interval: 5000 });
  results.txs.fundOutsider = fh;
  log('funded outsider', outsiderAcct.address, 'tx', fh);
}

const balShip0 = await bal(shipperAcct.address); const balCarr0 = await bal(carrierAcct.address);
log('shipper start GEN:', Number(balShip0) / 1e18, '| carrier start GEN:', Number(balCarr0) / 1e18);
results.balances = { shipper_start: balShip0.toString(), carrier_start: balCarr0.toString() };

const intactBytes = new Uint8Array(readFileSync('./intact-800.jpg'));
const dmgBytes = new Uint8Array(readFileSync('./damaged-800.jpg'));
const intactHash = sha256hex(intactBytes);
const dmgHash = sha256hex(dmgBytes);

// 1. protocol state
const ps = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
step('protocol_state', ps.shipment_count === '0', JSON.stringify(ps));

// 1b. appeal window validation: too short and too long must revert
for (const [w, tag] of [[60, 'short'], [90000, 'long']]) {
  const hh = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'bad-window', 'x', w], value: GEN / 4n });
  const rpw = await wait(shipper, hh);
  step(`window_rejected_${tag}`, execErr(rpw) && errText(rpw).includes('INVALID_APPEAL_WINDOW'), `window=${w}s -> ${execErr(rpw) ? 'reverted' : 'ACCEPTED (BAD)'}`);
}
// 1c. 3-arg create uses the 24h default window
{
  const hh = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'default-window', 'Default window check parcel'], value: GEN / 4n });
  await wait(shipper, hh); results.txs.createDefault = hh;
  const sd = await readShip(0);
  step('default_window_24h', sd.appeal_window_sec === 86400, `window=${sd.appeal_window_sec}`);
  // cancel it to recover escrow (keeps finalize math clean)
  const hc = await shipper.writeContract({ address: ADDR, functionName: 'cancel_shipment', args: [0] });
  await wait(shipper, hc);
}

// 2. create shipment 1 (intact), 0.5 GEN escrow, 300s window
let h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'intact-parcel-1', 'Sealed retail box, 12 ceramic mugs, fragile', WIN], value: GEN / 2n });
await wait(shipper, h); results.txs.create0 = h; log('create1 tx', h);
let s0 = await readShip(1);
step('create_shipment_escrow', s0.status === 'CREATED' && s0.escrow_wei === (GEN / 2n).toString() && s0.appeal_window_sec === WIN, `status=${s0.status} escrow=${s0.escrow_wei} window=${s0.appeal_window_sec}`);

// 3. carrier submits evidence (with SHA-256 commitment of the photo bytes)
h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence', args: [1, 'evidence://waybill-test/intact-1.jpg', 'Delivered to porch, box sealed and clean', intactHash] });
await wait(carrier, h); results.txs.evidence0 = h; log('evidence1 tx', h);
s0 = await readShip(1);
step('submit_evidence', s0.status === 'IN_REVIEW' && s0.evidence_sha256 === intactHash, `status=${s0.status} hash=${s0.evidence_sha256?.slice(0, 16)}…`);

// 4. jury assessment with intact photo bytes -> AWAITING_APPEAL, no payout yet
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [1, intactBytes] });
results.txs.assess0 = h; log('assess1 tx (jury running)', h);
await wait(carrier, h);
s0 = await readShip(1);
const bpsMap = { INTACT: 10000, MINOR_DAMAGE: 8500, MAJOR_DAMAGE: 4000, TOTAL_LOSS: 0 };
const expCarrier = (GEN / 2n) * BigInt(bpsMap[s0.verdict] ?? -1) / 10000n;
const psMid = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
step('jury_intact_awaits_appeal',
  s0.status === 'AWAITING_APPEAL' && s0.carrier_payout_wei === expCarrier.toString()
    && BigInt(psMid.contract_balance_wei) >= GEN / 2n,
  `verdict=${s0.verdict} conf=${s0.confidence} tentative_carrier=${s0.carrier_payout_wei} refund=${s0.shipper_refund_wei} deadline=${s0.appeal_deadline} contract_holds=${psMid.contract_balance_wei}`);

// 5. damaged shipment 2
h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'damaged-parcel-2', 'Cardboard box of glass bottles', WIN], value: GEN / 2n });
await wait(shipper, h); results.txs.create1 = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence', args: [2, 'evidence://waybill-test/damaged-2.jpg', 'Box arrived crushed, corner torn', dmgHash] });
await wait(carrier, h); results.txs.evidence1 = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [2, dmgBytes] });
results.txs.assess1 = h; log('assess2 tx (jury running)', h);
await wait(carrier, h);
const s1 = await readShip(2);
const expC1 = (GEN / 2n) * BigInt(bpsMap[s1.verdict] ?? -1) / 10000n;
step('jury_damaged_awaits_appeal',
  s1.status === 'AWAITING_APPEAL' && s1.carrier_payout_wei === expC1.toString() && s1.verdict !== 'INTACT',
  `verdict=${s1.verdict} conf=${s1.confidence} tentative_carrier=${s1.carrier_payout_wei} refund=${s1.shipper_refund_wei}`);

// 6. cancel flow shipment 3
h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'cancel-me-3', 'Order cancelled by customer', WIN], value: GEN / 4n });
await wait(shipper, h); results.txs.create2 = h;
h = await shipper.writeContract({ address: ADDR, functionName: 'cancel_shipment', args: [3] });
await wait(shipper, h); results.txs.cancel2 = h;
const s2 = await readShip(3);
step('cancel_refund', s2.status === 'CANCELLED', `status=${s2.status}`);

// 7. pause gate: shipment 4 -> evidence -> pause -> assess must fail -> resume -> assess works
h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'pause-gate-4', 'Pause gate test parcel', WIN], value: GEN / 4n });
await wait(shipper, h); results.txs.create3 = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence', args: [4, 'evidence://waybill-test/gate-4.jpg', 'At depot, ready', intactHash] });
await wait(carrier, h);
h = await shipper.writeContract({ address: ADDR, functionName: 'pause_protocol', args: [] });
await wait(shipper, h); results.txs.pause = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [4, intactBytes] });
results.txs.assessPaused = h;
const rp = await wait(carrier, h);
step('pause_gate', execErr(rp), `assess while paused -> execution_result=${rp.consensus_data?.leader_receipt?.[0]?.execution_result}`);
h = await shipper.writeContract({ address: ADDR, functionName: 'resume_protocol', args: [] });
await wait(shipper, h); results.txs.resume = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [4, intactBytes] });
results.txs.assess3 = h; await wait(carrier, h);
const s3 = await readShip(4);
step('resume_then_assess', s3.status === 'AWAITING_APPEAL', `verdict=${s3.verdict} status=${s3.status}`);

// 8. outsider assessment: shipment 5, third wallet calls assess_delivery -> ONLY_PARTY_ASSESS
h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'outsider-gate-5', 'Outsider assessment gate test', WIN], value: GEN / 4n });
await wait(shipper, h); results.txs.create4 = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence', args: [5, 'evidence://waybill-test/gate-5.jpg', 'Sealed box at hub', intactHash] });
await wait(carrier, h); results.txs.evidence4 = h;
h = await outsider.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [5, intactBytes] });
results.txs.assessOutsider = h; log('assessOutsider tx', h);
const rp10 = await wait(outsider, h);
const err10 = errText(rp10);
const s4 = await readShip(5);
step('outsider_assessment_blocked',
  execErr(rp10) && err10.includes('ONLY_PARTY_ASSESS') && s4.status === 'IN_REVIEW'
    && s4.carrier_payout_wei === '0' && s4.shipper_refund_wei === '0',
  `err_has_ONLY_PARTY_ASSESS=${err10.includes('ONLY_PARTY_ASSESS')} status=${s4.status}`);

// 9. mismatched evidence: shipment 6, evidence commits sha256(intact) but assess with DAMAGED bytes
h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'mismatch-gate-6', 'Evidence mismatch gate test', WIN], value: GEN / 4n });
await wait(shipper, h); results.txs.create5 = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence', args: [6, 'evidence://waybill-test/gate-6.jpg', 'Box looks fine', intactHash] });
await wait(carrier, h); results.txs.evidence5 = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [6, dmgBytes] });
results.txs.assessMismatch = h; log('assessMismatch tx', h);
const rp11 = await wait(carrier, h);
const err11 = errText(rp11);
const s5 = await readShip(6);
step('evidence_mismatch_blocked',
  execErr(rp11) && err11.includes('EVIDENCE_MISMATCH') && s5.status === 'IN_REVIEW'
    && s5.carrier_payout_wei === '0' && s5.shipper_refund_wei === '0',
  `err_has_EVIDENCE_MISMATCH=${err11.includes('EVIDENCE_MISMATCH')} status=${s5.status}`);

// 10. settle phase: wait for all appeal windows to close, then settle 1, 2, 4.
//     Shipment 2's settle goes out from the OUTSIDER (permissionless liveness).
const deadlines = [1, 2, 4].map(async (id) => Number((await readShip(id)).appeal_deadline));
const maxDl = Math.max(...await Promise.all(deadlines));
const waitMs = maxDl * 1000 - Date.now() + 15000;
if (waitMs > 0) { log(`waiting ${(waitMs / 1000).toFixed(0)}s for appeal windows to close…`); await new Promise(r => setTimeout(r, waitMs)); }
h = await shipper.writeContract({ address: ADDR, functionName: 'settle_shipment', args: [1] });
await wait(shipper, h); results.txs.settle1 = h;
h = await outsider.writeContract({ address: ADDR, functionName: 'settle_shipment', args: [2] });
await wait(outsider, h); results.txs.settle2 = h; log('outsider settled shipment 2', h);
h = await shipper.writeContract({ address: ADDR, functionName: 'settle_shipment', args: [4] });
await wait(shipper, h); results.txs.settle4 = h;
const r1 = await readShip(1), r2 = await readShip(2), r4 = await readShip(4);
step('settle_releases_payouts',
  r1.status === 'RESOLVED' && r2.status === 'RESOLVED' && r4.status === 'RESOLVED'
    && r1.carrier_payout_wei === expCarrier.toString() && r2.carrier_payout_wei === expC1.toString(),
  `s1=${r1.status}/${r1.carrier_payout_wei} s2=${r2.status}/${r2.carrier_payout_wei} s4=${r4.status}`);
// 10b. double settle must fail
{
  const hh = await shipper.writeContract({ address: ADDR, functionName: 'settle_shipment', args: [1] });
  const rpp = await wait(shipper, hh);
  step('double_settle_blocked', execErr(rpp) && errText(rpp).includes('BAD_STATUS'), 'second settle reverted');
}

// 11. aggregate reads
const all = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_all_shipments', args: [] }));
const hist = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_assessment_history', args: [500] }));
const psEnd = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
step('aggregate_reads', all.length === 7 && psEnd.shipment_count === '7', `shipments=${all.length} history_events=${hist.length} assessed=${psEnd.total_assessed} contract_balance_wei=${psEnd.contract_balance_wei}`);
results.finalState = psEnd;
writeFileSync('./results/results.json', JSON.stringify(results, null, 2));
const passed = results.steps.filter(s => s.pass).length;
log(`DONE: ${passed}/${results.steps.length} scenarios passed`);
process.exit(passed === results.steps.length ? 0 : 1);
