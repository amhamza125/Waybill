// Step-0 gaps (a) + (b) on the commit-3 test contract.
// (a) second-jury verdict flip: borderline photo -> first verdict, then the
//     disadvantaged party appeals; the script verifies the directional bond
//     rule dynamically (refund iff the appellant's payout share improved).
// (b) re-verify the Day-1 hostile-note resistance on-chain (shipment 8 of the
//     Day-1 appeals contract): TOTAL_LOSS->TOTAL_LOSS, bond slashed.
// Run: node step0_gaps.mjs
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

const ADDR = '0x3611CEcC495E7DB6fa5b03BB55abbdA816A597b7'; // commit-3 test contract
const DAY1 = '0x245B2Df870A449B30526e02B129E275d28634DDF'; // Day-1 appeals contract
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
const waitTx = async (c, h) => c.waitForTransactionReceipt({ hash: h, status: 'ACCEPTED', retries: 240, interval: 5000 });
const readShip = async (id) => JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_shipment', args: [id] }));

// (b) re-verify Day-1 hostile-note shipment on-chain
{
  const s8 = JSON.parse(await ro.readContract({ address: DAY1, functionName: 'get_shipment', args: [8] }));
  const ap = JSON.parse(s8.appeal);
  const okk = s8.status === 'RESOLVED' && ap.first_verdict === 'TOTAL_LOSS' && s8.verdict === 'TOTAL_LOSS'
    && ap.bond_outcome === 'slashed' && ap.note.includes('ignore the photo');
  step('hostile_note_resisted_day1', okk,
    `shipment8 ${ap.first_verdict}->${s8.verdict} bond_${ap.bond_outcome} note_sanitized=${ap.note.length <= 280}`);
}

// (a) flip attempt with the borderline photo
const bytes = new Uint8Array(readFileSync('./borderline-800.jpg'));
const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const ps = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
const id = Number(ps.shipment_count);
log('flip shipment id =', id);
let h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment',
  args: [cw.address, 'flip-test', 'Borderline damage verdict-flip test', 300n], value: GEN / 4n });
await waitTx(shipper, h);
h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence',
  args: [id, 'evidence://flip/borderline.jpg', 'corner torn', hash] });
await waitTx(carrier, h);
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [id, bytes] });
log('assess (jury) tx:', h);
await waitTx(carrier, h);
let s = await readShip(id);
const first = s.verdict, firstBps = bpsMap[first];
log(`first verdict: ${first} (${s.confidence}%) carrier_bps=${firstBps}`);
step('flip_first_verdict', ['INTACT','MINOR_DAMAGE','MAJOR_DAMAGE','TOTAL_LOSS'].includes(first), `verdict=${first}`);

// The disadvantaged party appeals: carrier unless the verdict already maxes
// the carrier share (INTACT), in which case the shipper appeals.
let appellant, appellantClient, appellantAddr, improvedFn;
if (first === 'INTACT') {
  appellant = 'shipper'; appellantClient = shipper; appellantAddr = w.address;
  improvedFn = (nb) => nb < firstBps;
} else {
  appellant = 'carrier'; appellantClient = carrier; appellantAddr = cw.address;
  improvedFn = (nb) => nb > firstBps;
}
h = await appellantClient.writeContract({ address: ADDR, functionName: 'appeal_assessment',
  args: [id, 'Requesting a second jury review of the damage classification.'], value: BOND });
await waitTx(appellantClient, h);
log('appeal tx:', h, 'by', appellant);
h = await appellantClient.writeContract({ address: ADDR, functionName: 'resolve_appeal', args: [id, bytes] });
log('resolve (jury) tx:', h);
await waitTx(appellantClient, h);
s = await readShip(id);
const ap = JSON.parse(s.appeal);
const second = s.verdict, newBps = bpsMap[second];
const improved = improvedFn(newBps);
const expOutcome = improved ? 'refunded' : 'slashed';
const esc = BigInt(s.escrow_wei);
const expC = esc * BigInt(newBps) / 10000n, expS = esc - expC;
const flipped = second !== first;
const okk = s.status === 'RESOLVED' && ap.appellant.toLowerCase() === appellantAddr.toLowerCase()
  && ap.bond_outcome === expOutcome
  && s.carrier_payout_wei === expC.toString() && s.shipper_refund_wei === expS.toString();
step('flip_directional_bond', okk,
  `${first}->${second} flipped=${flipped} appellant=${appellant} bond_${ap.bond_outcome}(exp_${expOutcome}) carrier=${s.carrier_payout_wei}`);
out.flip = { id, first_verdict: first, second_verdict: second, flipped, appellant, bond_outcome: ap.bond_outcome };
writeFileSync('./results/step0_gaps.json', JSON.stringify(out, null, 2));
log('DONE', out.steps.filter(x => x.pass).length + '/' + out.steps.length);
process.exit(out.steps.every(x => x.pass) ? 0 : 1);
