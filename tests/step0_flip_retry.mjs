// Step-0 gap (a) retry: verdict flip via a severity-focused appeal.
// Borderline photo; the appellant argues the damage is WORSE than graded.
// If the second jury upgrades severity, the directional bond rule refunds.
// Run: node step0_flip_retry.mjs
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

const ADDR = '0x3611CEcC495E7DB6fa5b03BB55abbdA816A597b7';
const w = JSON.parse(readFileSync('/home/hatch/workspace/waybill-test/test-wallet.json'));
const cw = JSON.parse(readFileSync('/home/hatch/workspace/waybill-test/carrier-wallet.json'));
const shipper = createClient({ chain: studionet, account: privateKeyToAccount(w.privateKey) });
const carrier = createClient({ chain: studionet, account: privateKeyToAccount(cw.privateKey) });
const ro = createClient({ chain: studionet });
const GEN = 10n ** 18n, BOND = GEN / 20n;
const bpsMap = { INTACT: 10000, MINOR_DAMAGE: 8500, MAJOR_DAMAGE: 4000, TOTAL_LOSS: 0 };
const log = (...a) => console.log(...a);
const out = { steps: [] };
const step = (n, p, i) => { out.steps.push({ name: n, pass: p, info: i }); log(`[${p ? 'PASS' : 'FAIL'}] ${n} :: ${i}`); };
const waitTx = (c, h) => c.waitForTransactionReceipt({ hash: h, status: 'ACCEPTED', retries: 240, interval: 5000 });
const readShip = async (id) => JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_shipment', args: [id] }));

const bytes = new Uint8Array(readFileSync('./borderline-800.jpg'));
const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const ps = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
const id = Number(ps.shipment_count);
log('flip-retry shipment id =', id);
let h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment',
  args: [cw.address, 'flip-retry', 'Severity-focused appeal flip test', 300n], value: GEN / 4n });
await waitTx(shipper, h);
h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence',
  args: [id, 'evidence://flip/borderline2.jpg', 'corner torn', hash] });
await waitTx(carrier, h);
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [id, bytes] });
log('assess (jury) tx:', h);
await waitTx(carrier, h);
let s = await readShip(id);
const first = s.verdict, firstBps = bpsMap[first];
log(`first verdict: ${first} (${s.confidence}%)`);
// Shipper appeals, arguing the visible damage is more severe than graded.
h = await shipper.writeContract({ address: ADDR, functionName: 'appeal_assessment',
  args: [id, 'The torn corner is worse than graded: cardboard is ripped open and the contents are exposed. Requesting re-examination of the damage severity.'],
  value: BOND });
await waitTx(shipper, h);
h = await shipper.writeContract({ address: ADDR, functionName: 'resolve_appeal', args: [id, bytes] });
log('resolve (jury) tx:', h);
await waitTx(shipper, h);
s = await readShip(id);
const ap = JSON.parse(s.appeal);
const second = s.verdict, newBps = bpsMap[second];
const improved = newBps < firstBps; // shipper appellant
const expOutcome = improved ? 'refunded' : 'slashed';
const esc = BigInt(s.escrow_wei);
const expC = esc * BigInt(newBps) / 10000n;
const flipped = second !== first;
const okk = s.status === 'RESOLVED' && ap.bond_outcome === expOutcome && s.carrier_payout_wei === expC.toString();
step('flip_retry_directional_bond', okk,
  `${first}->${second} flipped=${flipped} bond_${ap.bond_outcome}(exp_${expOutcome})`);
out.flip = { id, first_verdict: first, second_verdict: second, flipped, bond_outcome: ap.bond_outcome };
writeFileSync('./results/step0_flip_retry.json', JSON.stringify(out, null, 2));
log('DONE', out.steps.filter(x => x.pass).length + '/' + out.steps.length);
process.exit(okk ? 0 : 1);
