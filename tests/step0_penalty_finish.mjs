// Step-0 gap (c) finish: late-penalty settlement on the commit-3 test contract.
// The penalty shipment (id 3) was created with deadline 07:55:58 UTC and 10%
// penalty. This submits evidence AFTER the deadline (late), assesses,
// waits out the 300s appeal window, settles, and verifies the penalty math
// to the wei: carrier_payout = 0.5 - 0.05 = 0.45 GEN, shipper refund = 0.05.
// Run AFTER the deadline: node step0_penalty_finish.mjs
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

const INFO = JSON.parse(readFileSync('./results/step0_penalty.json'));
const ADDR = INFO.contract, ID = INFO.id;
const DEADLINE = Number(INFO.deadline);
const w = JSON.parse(readFileSync('/home/hatch/workspace/waybill-test/test-wallet.json'));
const cw = JSON.parse(readFileSync('/home/hatch/workspace/waybill-test/carrier-wallet.json'));
const shipper = createClient({ chain: studionet, account: privateKeyToAccount(w.privateKey) });
const carrier = createClient({ chain: studionet, account: privateKeyToAccount(cw.privateKey) });
const ro = createClient({ chain: studionet });
const GEN = 10n ** 18n;
const log = (...a) => console.log(...a);
const out = { steps: [] };
const step = (n, p, i) => { out.steps.push({ name: n, pass: p, info: i }); log(`[${p ? 'PASS' : 'FAIL'}] ${n} :: ${i}`); };
const waitTx = (c, h) => c.waitForTransactionReceipt({ hash: h, status: 'ACCEPTED', retries: 240, interval: 5000 });

const now = Math.floor(Date.now() / 1000);
if (now <= DEADLINE) {
  const waitMs = (DEADLINE - now) * 1000 + 15000;
  log(`waiting ${(waitMs / 1000).toFixed(0)}s for the deadline to pass…`);
  await new Promise(r => setTimeout(r, waitMs));
}
const bytes = new Uint8Array(readFileSync('./intact-800.jpg'));
const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
let h = await carrier.writeContract({ address: ADDR, functionName: 'submit_evidence',
  args: [ID, 'evidence://penalty/late.jpg', 'late delivery', hash] });
await waitTx(carrier, h);
log('evidence tx:', h);
let s = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_shipment', args: [ID] }));
const late = Number(s.evidence_time) > Number(s.deadline_unix);
step('penalty_evidence_late', late, `evidence_time=${s.evidence_time} deadline=${s.deadline_unix} late=${late}`);
h = await carrier.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [ID, bytes] });
log('assess (jury) tx:', h);
await waitTx(carrier, h);
s = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_shipment', args: [ID] }));
log(`verdict: ${s.verdict} (${s.confidence}%)`);
if (s.verdict !== 'INTACT') throw new Error('expected INTACT, got ' + s.verdict);
const waitMs = Number(s.appeal_deadline) * 1000 - Date.now() + 15000;
if (waitMs > 0) { log(`waiting ${(waitMs / 1000).toFixed(0)}s for appeal window…`); await new Promise(r => setTimeout(r, waitMs)); }
h = await shipper.writeContract({ address: ADDR, functionName: 'settle_shipment', args: [ID] });
await waitTx(shipper, h);
log('settle tx:', h);
s = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_shipment', args: [ID] }));
// escrow 0.5 GEN, INTACT -> carrier 0.5, penalty 10% -> carrier 0.45, shipper 0.05
const expC = (GEN / 2n) - (GEN / 20n);
const expS = GEN / 20n;
const okk = s.status === 'RESOLVED' && s.carrier_payout_wei === expC.toString()
  && s.shipper_refund_wei === expS.toString() && s.penalty_wei === expS.toString();
step('penalty_math_exact', okk,
  `carrier=${s.carrier_payout_wei}(exp ${expC}) shipper=${s.shipper_refund_wei}(exp ${expS}) penalty=${s.penalty_wei}`);
out.settle_tx = h;
writeFileSync('./results/step0_penalty_finish.json', JSON.stringify(out, null, 2));
log('DONE', out.steps.filter(x => x.pass).length + '/' + out.steps.length);
process.exit(out.steps.every(x => x.pass) ? 0 : 1);
