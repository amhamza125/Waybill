// Waybill finalization + payout verification.
// Run from tests/ AFTER run.mjs:  node finalize.mjs
// Reads ./results/results.json, waits for the payout txs to FINALIZE,
// then checks every wei moved exactly as the contract recorded.
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { readFileSync, writeFileSync } from 'fs';

const R = JSON.parse(readFileSync('./results/results.json'));
const ADDR = R.contract;
const ro = createClient({ chain: studionet });
const bal = async (a) => { const r = await fetch('https://studio.genlayer.com/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [a, 'latest'] }) }); return BigInt((await r.json()).result); };
const gen = (wei) => (Number(wei) / 1e18).toFixed(4);
const stName = (t) => (t && (t.statusName || String(t.status))) || 'NONE';

// Wait for the key payout txs to finalize
const watch = [R.txs.assess0, R.txs.assess1, R.txs.cancel2, R.txs.assess3].filter(Boolean);
const deadline = Date.now() + 25 * 60 * 1000;
let statuses = {};
while (Date.now() < deadline) {
  let allFin = true;
  for (const h of watch) {
    if (statuses[h] === 'FINALIZED' || statuses[h] === '7') continue;
    try { const t = await ro.getTransaction({ hash: h }); statuses[h] = stName(t); } catch { statuses[h] = 'ERR'; }
    if (statuses[h] !== 'FINALIZED' && statuses[h] !== '7') allFin = false;
  }
  console.log('statuses:', JSON.stringify(statuses));
  if (allFin) break;
  await new Promise(r => setTimeout(r, 20000));
}

// Expected deltas from on-chain records
const all = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_all_shipments', args: [] }));
let carrierGain = 0n, shipperRefund = 0n, escrowTotal = 0n;
for (const s of all) {
  escrowTotal += BigInt(s.escrow_wei);
  if (s.status === 'RESOLVED') { carrierGain += BigInt(s.carrier_payout_wei); shipperRefund += BigInt(s.shipper_refund_wei); }
  if (s.status === 'CANCELLED') shipperRefund += BigInt(s.escrow_wei);
}
const shipperAfter = await bal(R.shipper); const carrierAfter = await bal(R.carrier);
const shipperBefore = BigInt(R.balances.shipper_start); const carrierBefore = BigInt(R.balances.carrier_start);
const expShipper = shipperBefore - escrowTotal + shipperRefund;
const expCarrier = carrierBefore + carrierGain;
const ok = shipperAfter === expShipper && carrierAfter === expCarrier;
const out = {
  payouts_ok: ok,
  shipper_before: gen(shipperBefore), shipper_after: gen(shipperAfter), shipper_expected: gen(expShipper),
  carrier_before: gen(carrierBefore), carrier_after: gen(carrierAfter), carrier_expected: gen(expCarrier),
  tx_statuses: statuses,
};
writeFileSync('./results/finalize.json', JSON.stringify(out, null, 2));
console.log('FINALIZE CHECK:', JSON.stringify(out, null, 2));
process.exit(ok ? 0 : 1);
