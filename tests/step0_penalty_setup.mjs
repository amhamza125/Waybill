// Step-0 gap (c): late-penalty shipment setup on the Day-1 v3 contract.
// Creates a shipment with a 1h+3700s deadline and 10% penalty NOW, so that
// evidence submitted >1h later is deterministically LATE (evidence_time is
// consensus-pinned at submit_evidence; the 1h MIN_LEAD_TIME is on-chain).
// Run: node step0_penalty_setup.mjs   (then step0_penalty_finish.mjs later)
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';

const ADDR = '0x245B2Df870A449B30526e02B129E275d28634DDF'; // Day-1 v3 (appeals+penalties)
const w = JSON.parse(readFileSync('/home/hatch/workspace/waybill-test/test-wallet.json'));
const cw = JSON.parse(readFileSync('/home/hatch/workspace/waybill-test/carrier-wallet.json'));
const shipper = createClient({ chain: studionet, account: privateKeyToAccount(w.privateKey) });
const GEN = 10n ** 18n;
const ro = createClient({ chain: studionet });

const ps = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
console.log('protocol ok, shipment_count =', ps.shipment_count);
const id = Number(ps.shipment_count);
const now = Math.floor(Date.now() / 1000);
const deadline = now + 3700; // 1h + ~100s: satisfies the on-chain 1h MIN_LEAD_TIME
const h = await shipper.writeContract({
  address: ADDR, functionName: 'create_shipment',
  args: [cw.address, 'penalty-late', 'Late-delivery penalty live test', 300, deadline, 1000],
  value: GEN / 2n,
});
console.log('create tx:', h);
const rp = await shipper.waitForTransactionReceipt({ hash: h, status: 'ACCEPTED', retries: 120, interval: 5000 });
console.log('accepted:', rp.statusName || rp.status);
const s = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_shipment', args: [id] }));
console.log('shipment', id, 'deadline_unix =', s.deadline_unix, 'penalty_bps =', s.penalty_bps, 'escrow =', s.escrow_wei);
writeFileSync('./results/step0_penalty.json', JSON.stringify({ id, deadline, create_tx: h }, null, 2));
console.log('saved. Submit evidence AFTER unix', deadline, '(~', new Date(deadline * 1000).toISOString(), ')');
