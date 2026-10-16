// Waybill adversarial/verification test suite.
// Run from tests/:  WB_CONTRACT=0x... WB_KEY_A=0x... WB_KEY_B=0x... node run.mjs
// Then: node finalize.mjs  (verifies finalization + exact payouts)
// Keys are NEVER committed — pass them via environment only.
// The suite expects a FRESH Waybill deployment (shipment ids start at 0).
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';

const ADDR = process.env.WB_CONTRACT || '0x1290Bb9a5B6b897f01184bdC5650c5065896E570';
const KEY_A = process.env.WB_KEY_A;
const KEY_B = process.env.WB_KEY_B;
if (!KEY_A || !KEY_B) {
  console.error('Set WB_KEY_A (shipper) and WB_KEY_B (carrier) env vars. Keys are never stored in the repo.');
  process.exit(1);
}
const shipperAcct = privateKeyToAccount(KEY_A);
const carrierAcct = privateKeyToAccount(KEY_B);
const shipper = createClient({ chain: studionet, account: shipperAcct });
const carrier = createClient({ chain: studionet, account: carrierAcct });
const ro = createClient({ chain: studionet });
const GEN = 10n ** 18n;
const results = { contract: ADDR, shipper: shipperAcct.address, carrier: carrierAcct.address, steps: [], txs: {} };
const log = (...a) => console.log(...a);
const step = (name, pass, info) => { results.steps.push({ name, pass, info }); log(`[${pass ? 'PASS' : 'FAIL'}] ${name} :: ${info}`); };
const bal = async (a) => { const r = await fetch('https://studio.genlayer.com/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [a, 'latest'] }) }); return BigInt((await r.json()).result); };
const wait = (client, hash) => client.waitForTransactionReceipt({ hash, status: 'ACCEPTED', retries: 240, interval: 5000 });
const readShip = async (id) => JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_shipment', args: [id] }));

const balShip0 = await bal(shipperAcct.address); const balCarr0 = await bal(carrierAcct.address);
log('shipper start GEN:', Number(balShip0) / 1e18, '| carrier start GEN:', Number(balCarr0) / 1e18);
results.balances = { shipper_start: balShip0.toString(), carrier_start: balCarr0.toString() };

// 1. protocol state
const ps = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
step('protocol_state', ps.shipment_count === '0', JSON.stringify(ps));

// 2. create shipment 0 (intact), 0.5 GEN escrow
let h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'intact-parcel-1', 'Sealed retail box, 12 ceramic mugs, fragile'], value: GEN / 2n });
await wait(shipper, h); results.txs.create0 = h; log('create0 tx', h);
let s0 = await readShip(0);
step('create_shipment_escrow', s0.status === 'CREATED' && s0.escrow_wei === (GEN / 2n).toString(), `status=${s0.status} escrow=${s0.escrow_wei}`);

// 3. carrier submits evidence
h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence', args: [0, 'evidence://waybill-test/intact-1.jpg', 'Delivered to porch, box sealed and clean'] });
await wait(carrier, h); results.txs.evidence0 = h; log('evidence0 tx', h);
s0 = await readShip(0);
step('submit_evidence', s0.status === 'IN_REVIEW', `status=${s0.status}`);

// 4. jury assessment with intact photo bytes
const intactBytes = new Uint8Array(readFileSync('./intact-800.jpg'));
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [0, intactBytes] });
results.txs.assess0 = h; log('assess0 tx (jury running)', h);
await wait(carrier, h);
s0 = await readShip(0);
const bpsMap = { INTACT: 10000, MINOR_DAMAGE: 8500, MAJOR_DAMAGE: 4000, TOTAL_LOSS: 0 };
const expCarrier = (GEN / 2n) * BigInt(bpsMap[s0.verdict] ?? -1) / 10000n;
step('jury_intact', s0.status === 'RESOLVED' && s0.carrier_payout_wei === expCarrier.toString(), `verdict=${s0.verdict} conf=${s0.confidence} carrier_payout=${s0.carrier_payout_wei} refund=${s0.shipper_refund_wei} notes="${s0.jury_notes}"`);

// 5. damaged shipment 1
h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'damaged-parcel-2', 'Cardboard box of glass bottles'], value: GEN / 2n });
await wait(shipper, h); results.txs.create1 = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence', args: [1, 'evidence://waybill-test/damaged-2.jpg', 'Box arrived crushed, corner torn'] });
await wait(carrier, h); results.txs.evidence1 = h;
const dmgBytes = new Uint8Array(readFileSync('./damaged-800.jpg'));
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [1, dmgBytes] });
results.txs.assess1 = h; log('assess1 tx (jury running)', h);
await wait(carrier, h);
const s1 = await readShip(1);
const expC1 = (GEN / 2n) * BigInt(bpsMap[s1.verdict] ?? -1) / 10000n;
step('jury_damaged', s1.status === 'RESOLVED' && s1.carrier_payout_wei === expC1.toString() && s1.verdict !== 'INTACT', `verdict=${s1.verdict} conf=${s1.confidence} carrier_payout=${s1.carrier_payout_wei} refund=${s1.shipper_refund_wei} notes="${s1.jury_notes}"`);

// 6. cancel flow shipment 2
h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'cancel-me-3', 'Order cancelled by customer'], value: GEN / 4n });
await wait(shipper, h); results.txs.create2 = h;
h = await shipper.writeContract({ address: ADDR, functionName: 'cancel_shipment', args: [2] });
await wait(shipper, h); results.txs.cancel2 = h;
const s2 = await readShip(2);
step('cancel_refund', s2.status === 'CANCELLED', `status=${s2.status}`);

// 7. pause gate: shipment 3 -> evidence -> pause -> assess must fail -> resume -> assess works
h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment', args: [carrierAcct.address, 'pause-gate-4', 'Pause gate test parcel'], value: GEN / 4n });
await wait(shipper, h); results.txs.create3 = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence', args: [3, 'evidence://waybill-test/gate-4.jpg', 'At depot, ready'] });
await wait(carrier, h);
h = await shipper.writeContract({ address: ADDR, functionName: 'pause_protocol', args: [] });
await wait(shipper, h); results.txs.pause = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [3, intactBytes] });
results.txs.assessPaused = h;
const rp = await wait(carrier, h);
const execRes = rp.consensus_data?.leader_receipt?.[0]?.execution_result;
step('pause_gate', execRes === 'ERROR', `assess while paused -> execution_result=${execRes}`);
h = await shipper.writeContract({ address: ADDR, functionName: 'resume_protocol', args: [] });
await wait(shipper, h); results.txs.resume = h;
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [3, intactBytes] });
results.txs.assess3 = h; await wait(carrier, h);
const s3 = await readShip(3);
step('resume_then_assess', s3.status === 'RESOLVED', `verdict=${s3.verdict} status=${s3.status}`);

// 8. aggregate reads
const all = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_all_shipments', args: [] }));
const hist = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_assessment_history', args: [50] }));
const psEnd = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
step('aggregate_reads', all.length === 4 && psEnd.shipment_count === '4', `shipments=${all.length} history_events=${hist.length} assessed=${psEnd.total_assessed} contract_balance_wei=${psEnd.contract_balance_wei}`);
results.finalState = psEnd;
writeFileSync('./results/results.json', JSON.stringify(results, null, 2));
const passed = results.steps.filter(s => s.pass).length;
log(`DONE: ${passed}/${results.steps.length} scenarios passed`);
process.exit(passed === results.steps.length ? 0 : 1);
