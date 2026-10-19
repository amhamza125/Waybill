// Waybill v3 finalization + payout verification.
// Run from tests/ AFTER run.mjs and run_appeals.mjs:  node finalize.mjs
// Reads ./results/results.json, waits for the payout txs to FINALIZE,
// then checks every wei moved exactly as the contract recorded.
// v3 accounting: escrow + recorded payouts + appeal bonds (refunded/slashed).
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
const watch = [R.txs.assess0, R.txs.assess1, R.txs.cancel2, R.txs.assess3, R.txs.settle1, R.txs.settle2, R.txs.settle4,
  R.txs.resolve_A, R.txs.resolve_B, R.txs.resolve_C, R.txs.settle_D, R.txs.settle_E, R.txs.settle_F].filter(Boolean);
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

// Expected deltas from on-chain records.
// Shipper paid every escrow + every appeal bond they filed; carrier paid bonds they filed.
// Terminal RESOLVED: recorded payouts + bond routing (refund -> appellant, slash -> counterparty).
// CANCELLED: full escrow back. Non-terminal states: escrow still locked, nothing else moved.
const all = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_all_shipments', args: [] }));
const addrOf = (role) => role === 'shipper' ? R.shipper : role === 'carrier' ? R.carrier : R.outsider;
const delta = { [R.shipper]: 0n, [R.carrier]: 0n, [R.outsider]: 0n };
for (const s of all) {
  const escrow = BigInt(s.escrow_wei);
  delta[s.shipper] -= escrow;
  if (s.status === 'CANCELLED') { delta[s.shipper] += escrow; continue; }
  if (s.appeal) {
    const ap = JSON.parse(s.appeal);
    const bond = BigInt(ap.bond_wei);
    delta[ap.appellant] -= bond;
    if (ap.bond_outcome === 'refunded') delta[ap.appellant] += bond;
    else if (ap.bond_outcome === 'slashed') {
      const cp = ap.appellant === s.carrier ? s.shipper : s.carrier;
      delta[cp] += bond;
    }
  }
  if (s.status === 'RESOLVED') {
    delta[s.carrier] += BigInt(s.carrier_payout_wei);
    delta[s.shipper] += BigInt(s.shipper_refund_wei);
  }
}
// Post-snapshot outsider funding for the appeal suite (fresh ephemeral outsider)
if (R.txs.fundOutsiderAppeals) delta[R.shipper] -= BigInt(R.txs.fundOutsiderAppeals.amount);
// Note: the 0.2 GEN outsider funding happened BEFORE the balance snapshot in
// run.mjs, so it is already reflected in R.balances and needs no adjustment here.
// The outsider only pays gas afterwards; its balance is reported, not asserted.
const shipperAfter = await bal(R.shipper), carrierAfter = await bal(R.carrier), outsiderAfter = await bal(R.outsider);
const expShipper = BigInt(R.balances.shipper_start) + delta[R.shipper];
const expCarrier = BigInt(R.balances.carrier_start) + delta[R.carrier];
const ok = shipperAfter === expShipper && carrierAfter === expCarrier;
const out = {
  payouts_ok: ok,
  shipper_before: gen(R.balances.shipper_start), shipper_after: gen(shipperAfter), shipper_expected: gen(expShipper),
  carrier_before: gen(R.balances.carrier_start), carrier_after: gen(carrierAfter), carrier_expected: gen(expCarrier),
  outsider_after: gen(outsiderAfter),
  tx_statuses: statuses,
};
writeFileSync('./results/finalize.json', JSON.stringify(out, null, 2));
console.log('FINALIZE CHECK:', JSON.stringify(out, null, 2));
process.exit(ok ? 0 : 1);
