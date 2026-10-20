// Waybill v3 multi-leg test suite (commit 4) on the commit-4 test contract.
// Scenarios: escrow-sum mismatch, 3-leg happy path to the wei, cross-leg
// permission rejection, sequential gating, blame-shift liability,
// TOTAL_LOSS route abort, per-leg appeal, stall-cancel negatives,
// per-leg reputation.
// Run from tests/:  node run_multileg.mjs   (after deploy_c4.mjs)
// Keys via env only (WB_KEY_A shipper, WB_KEY_B carrier); never committed.
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

const DEPLOY = JSON.parse(readFileSync('./results/deploy_c4.json'));
const ADDR = DEPLOY.address;
const KEY_A = process.env.WB_KEY_A, KEY_B = process.env.WB_KEY_B;
if (!KEY_A || !KEY_B) { console.error('Set WB_KEY_A, WB_KEY_B.'); process.exit(1); }
const shipperAcct = privateKeyToAccount(KEY_A);
const carrierAcct = privateKeyToAccount(KEY_B);
const shipper = createClient({ chain: studionet, account: shipperAcct });
const carrier = createClient({ chain: studionet, account: carrierAcct });
const ro = createClient({ chain: studionet });
const GEN = 10n ** 18n, BOND = GEN / 20n, WIN = 300;
const log = (...a) => console.log(...a);
const out = { contract: ADDR, steps: [], txs: {} };
const step = (n, p, i) => { out.steps.push({ name: n, pass: p, info: i }); log(`[${p ? 'PASS' : 'FAIL'}] ${n} :: ${i}`); };
const stepDone = (n) => out.steps.some(s => s.name === n && s.pass);
const save = () => writeFileSync('./results/multileg.json', JSON.stringify(out, null, 2));
const waitTx = (c, h) => c.waitForTransactionReceipt({ hash: h, status: 'ACCEPTED', retries: 240, interval: 5000 });
const readShip = async (id) => JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_shipment', args: [id] }));
const getRep = async (a) => {
  const r = await ro.readContract({ address: ADDR, functionName: 'get_reputation', args: [a] });
  return r === 'UNPROVEN' ? null : JSON.parse(r);
};
const sha256hex = (b) => createHash('sha256').update(Buffer.from(b)).digest('hex');
const errText = (rp) => { try { return JSON.stringify(rp.consensus_data?.leader_receipt?.[0] ?? rp); } catch { return ''; } };
const execErr = (rp) => rp.consensus_data?.leader_receipt?.[0]?.execution_result === 'ERROR';
const intactBytes = new Uint8Array(readFileSync('./intact-800.jpg'));
const dmgBytes = new Uint8Array(readFileSync('./damaged-800.jpg'));
const intactHash = sha256hex(intactBytes), dmgHash = sha256hex(dmgBytes);
const bpsMap = { INTACT: 10000, MINOR_DAMAGE: 8500, MAJOR_DAMAGE: 4000, TOTAL_LOSS: 0 };

// Fresh carrier wallets C1..C3 for distinct leg carriers (funded pre-run).
const legAccts = [];
if (!out.txs.funded) {
  for (let k = 0; k < 3; k++) {
    const a = privateKeyToAccount(generatePrivateKey());
    legAccts.push(a);
    const fh = await shipper.sendTransaction({ to: a.address, value: GEN / 2n });
    await waitTx(shipper, fh);
  }
  out.txs.funded = true; out.legCarriers = legAccts.map(a => a.address); save();
}
const legClients = legAccts.map(a => createClient({ chain: studionet, account: a }));
const [C1, C2, C3] = legAccts.map(a => a.address);
const legsJson = (legs) => JSON.stringify(legs.map(l => ({ carrier: l[0], amount_wei: l[1].toString() })));

const mkMulti = async (tag, legs, escrow) => {
  const ps = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
  const id = Number(ps.shipment_count);
  const h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [legs[0][0], `multi-${tag}`, `Multi-leg test ${tag}`, WIN, 0n, 0n, legsJson(legs)], value: escrow });
  const rp = await waitTx(shipper, h);
  if (execErr(rp)) throw new Error('create failed: ' + errText(rp).slice(0, 200));
  out.txs[`create_${tag}`] = h; save();
  return id;
};
const doLeg = async (id, i, client, photo) => {
  const ph = photo === 'intact' ? { bytes: intactBytes, hash: intactHash } : { bytes: dmgBytes, hash: dmgHash };
  let h = await client.writeContract({ address: ADDR, functionName: 'submit_leg_evidence',
    args: [id, i, `evidence://multi/${id}/${i}.jpg`, 'leg test', ph.hash] });
  await waitTx(client, h);
  h = await client.writeContract({ address: ADDR, functionName: 'assess_leg', args: [id, i, ph.bytes] });
  log(`assess leg ${i} of ${id} (jury)`, h);
  await waitTx(client, h);
  out.txs[`assess_${id}_${i}`] = h; save();
  return (await readShip(id)).legs[i];
};
const settleLegAfterWindow = async (id, i) => {
  const leg = (await readShip(id)).legs[i];
  const waitMs = Number(leg.appeal_deadline) * 1000 - Date.now() + 12000;
  if (waitMs > 0) { log(`waiting ${(waitMs / 1000).toFixed(0)}s for leg ${i} window…`); await new Promise(r => setTimeout(r, waitMs)); }
  const h = await shipper.writeContract({ address: ADDR, functionName: 'settle_leg', args: [id, i] });
  await waitTx(shipper, h);
  out.txs[`settle_${id}_${i}`] = h; save();
  return (await readShip(id)).legs[i];
};

// M1: escrow-sum mismatch rejected
if (!stepDone('m1_escrow_mismatch')) {
  const ps = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
  const h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [C1, 'multi-bad', 'mismatch', WIN, 0n, 0n,
      legsJson([[C1, GEN / 4n], [C2, GEN / 4n]])], value: GEN / 3n });
  const rp = await waitTx(shipper, h);
  step('m1_escrow_mismatch', execErr(rp) && errText(rp).includes('ESCROW_MISMATCH'), `reverted=${execErr(rp)}`);
  save();
}
// M1b: 9 legs rejected; dust leg rejected
if (!stepDone('m1b_leg_limits')) {
  const many = []; for (let k = 0; k < 9; k++) many.push(['0x' + '1'.repeat(40), (GEN / 10n).toString()]);
  let h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [C1, 'multi-many', 'too many', WIN, 0n, 0n, JSON.stringify(many.map(m => ({ carrier: m[0], amount_wei: m[1] })))], value: GEN });
  let rp = await waitTx(shipper, h);
  const tooMany = execErr(rp) && errText(rp).includes('INVALID_LEGS');
  h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [C1, 'multi-dust', 'dust leg', WIN, 0n, 0n,
      legsJson([[C1, GEN / 20n], [C2, GEN / 4n]])], value: GEN / 20n + GEN / 4n });
  rp = await waitTx(shipper, h);
  const dust = execErr(rp) && errText(rp).includes('LEG_DUST');
  step('m1b_leg_limits', tooMany && dust, `9legs_rejected=${tooMany} dustleg_rejected=${dust}`);
  save();
}

if (!stepDone('m2_3leg_happy')) {
// M2: 3-leg happy path, per-leg payouts exact to the wei
const idM2 = await mkMulti('happy', [[C1, GEN / 5n], [C2, GEN * 3n / 10n], [C3, GEN / 2n]], GEN);
{
  const clients = [legClients[0], legClients[1], legClients[2]];
  for (let i = 0; i < 3; i++) {
    const leg = await doLeg(idM2, i, clients[i], 'intact');
    if (leg.verdict !== 'INTACT') throw new Error(`leg ${i} verdict ${leg.verdict}, expected INTACT`);
    const settled = await settleLegAfterWindow(idM2, i);
    const expC = [GEN / 5n, GEN * 3n / 10n, GEN / 2n][i];
    if (settled.carrier_payout_wei !== expC.toString() || settled.shipper_refund_wei !== '0')
      throw new Error(`leg ${i} payout mismatch`);
  }
  const s = await readShip(idM2);
  step('m2_3leg_happy', s.status === 'RESOLVED' && s.legs.every(l => l.status === 'SETTLED'),
    `3 legs INTACT->carriers 0.2/0.3/0.5 GEN exact; route RESOLVED`);
  save();
}
} // end m2
// M3: cross-leg permission rejection (C2 submits leg 0 evidence)
if (!stepDone('m3_cross_leg_blocked')) {
  const id = await mkMulti('xperm', [[C1, GEN / 4n], [C2, GEN / 4n]], GEN / 2n);
  const h = await legClients[1].writeContract({ address: ADDR, functionName: 'submit_leg_evidence',
    args: [id, 0, 'evidence://x.jpg', 'meddle', intactHash] });
  const rp = await waitTx(legClients[1], h);
  const okk = execErr(rp) && errText(rp).includes('ONLY_PARTY_LEG');
  step('m3_cross_leg_blocked', okk, `reverted=${execErr(rp)}`);
  // cleanup: run leg 0 properly so the route can finish later if needed
  await doLeg(id, 0, legClients[0], 'intact');
  await settleLegAfterWindow(id, 0);
  save();
}
// M4: sequential gating — leg 1 evidence before leg 0 settled
if (!stepDone('m4_sequential_gating')) {
  const id = await mkMulti('seq', [[C1, GEN / 4n], [C2, GEN / 4n]], GEN / 2n);
  await doLeg(id, 0, legClients[0], 'intact'); // assessed, NOT settled
  const h = await legClients[1].writeContract({ address: ADDR, functionName: 'submit_leg_evidence',
    args: [id, 1, 'evidence://s.jpg', 'early', intactHash] });
  const rp = await waitTx(legClients[1], h);
  const okk = execErr(rp) && errText(rp).includes('LEG_NOT_ACTIVE');
  step('m4_sequential_gating', okk, `reverted=${execErr(rp)}`);
  await settleLegAfterWindow(id, 0);
  await doLeg(id, 1, legClients[1], 'intact');
  await settleLegAfterWindow(id, 1);
  save();
}
if (!stepDone('m5_blame_shift')) {
// M5: blame-shift — leg 0 INTACT settled, leg 1 damaged; leg 1 liable via baseline
{
  const id = await mkMulti('blame', [[C1, GEN / 4n], [C2, GEN / 4n]], GEN / 2n);
  await doLeg(id, 0, legClients[0], 'intact');
  await settleLegAfterWindow(id, 0);
  const leg1 = await doLeg(id, 1, legClients[1], 'damaged');
  const s = await readShip(id);
  const baselineOk = s.legs[1].verdict !== 'INTACT';
  // find the LEG_ASSESS log entry to confirm the baseline was recorded
  const hist = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_assessment_history', args: [500] }));
  const entry = hist.find(e => e.type === 'LEG_ASSESS' && e.shipment_id === id && e.leg_index === 1);
  const okk = baselineOk && entry && entry.baseline_verdict === 'INTACT';
  step('m5_blame_shift', !!okk, `leg1 verdict=${s.legs[1].verdict} (baseline INTACT recorded=${!!entry})`);
  await settleLegAfterWindow(id, 1);
  save();
}
} // end m5
if (!stepDone('m6_totalloss_abort')) {
// M6: TOTAL_LOSS on leg 1 aborts route; leg 2 refunded; leg 0 keeps payout
{
  const id = await mkMulti('abort', [[C1, GEN / 5n], [C2, GEN / 5n], [C3, GEN / 5n]], GEN * 3n / 5n);
  await doLeg(id, 0, legClients[0], 'intact');
  await settleLegAfterWindow(id, 0);
  const leg1 = await doLeg(id, 1, legClients[1], 'damaged');
  if (leg1.verdict !== 'TOTAL_LOSS') throw new Error(`leg1 verdict ${leg1.verdict}, need TOTAL_LOSS for abort test`);
  const settled1 = await settleLegAfterWindow(id, 1);
  const s = await readShip(id);
  const okk = s.legs[1].status === 'SETTLED' && s.legs[2].status === 'ABORTED'
    && settled1.carrier_payout_wei === '0' && settled1.shipper_refund_wei === (GEN / 5n).toString()
    && s.status === 'RESOLVED';
  step('m6_totalloss_abort', okk, `leg1 TOTAL_LOSS settled(0/0.2) leg2 ABORTED+refunded route RESOLVED`);
  save();
}
} // end m6
if (!stepDone('m7_leg_appeal')) {
// M7: per-leg appeal with directional bond
{
  const id = await mkMulti('appeal', [[C1, GEN / 4n], [C2, GEN / 4n]], GEN / 2n);
  await doLeg(id, 0, legClients[0], 'intact'); // INTACT
  let h = await shipper.writeContract({ address: ADDR, functionName: 'appeal_leg',
    args: [id, 0, 'Second look at leg 0.'], value: BOND });
  await waitTx(shipper, h);
  h = await shipper.writeContract({ address: ADDR, functionName: 'resolve_leg_appeal', args: [id, 0, intactBytes] });
  log('resolve leg appeal (jury)', h);
  await waitTx(shipper, h);
  const s = await readShip(id);
  const ap = JSON.parse(s.legs[0].appeal);
  const newBps = bpsMap[s.legs[0].verdict];
  const improved = newBps < 10000; // shipper appellant
  const expOutcome = improved ? 'refunded' : 'slashed';
  const okk = s.legs[0].status === 'SETTLED' && ap.bond_outcome === expOutcome;
  step('m7_leg_appeal', okk, `leg0 INTACT->${s.legs[0].verdict} bond_${ap.bond_outcome}(exp_${expOutcome})`);
  await doLeg(id, 1, legClients[1], 'intact');
  await settleLegAfterWindow(id, 1);
  save();
}
} // end m7
// M8: stall-cancel negatives (success path needs 72h; tested: premature + outsider revert)
if (!stepDone('m8_stall_negatives')) {
  const id = await mkMulti('stall', [[C1, GEN / 4n], [C2, GEN / 4n]], GEN / 2n);
  let h = await shipper.writeContract({ address: ADDR, functionName: 'cancel_leg', args: [id, 0] });
  let rp = await waitTx(shipper, h);
  const premature = execErr(rp) && errText(rp).includes('LEG_NOT_STALLED');
  h = await legClients[0].writeContract({ address: ADDR, functionName: 'cancel_leg', args: [id, 0] });
  rp = await waitTx(legClients[0], h);
  const outsider = execErr(rp) && errText(rp).includes('ONLY_SHIPPER');
  step('m8_stall_negatives', premature && outsider, `premature_rejected=${premature} outsider_rejected=${outsider}`);
  // leave this shipment stalled: settle leg 0, leave leg 1 PENDING as a 72h probe
  await doLeg(id, 0, legClients[0], 'intact');
  await settleLegAfterWindow(id, 0);
  const s = await readShip(id);
  const stallDeadline = Number(s.legs[0].settle_time) + 259200;
  out.stall_probe = { contract: ADDR, shipment_id: id, leg_index: 1, cancel_after_unix: stallDeadline,
    cancel_after_iso: new Date(stallDeadline * 1000).toISOString() };
  save();
}
// M9: per-leg reputation accrued
if (!stepDone('m9_leg_reputation')) {
  const r1 = await getRep(C1), r2 = await getRep(C2), r3 = await getRep(C3);
  const okk = r1 && r1.as_carrier_completed >= 3 && r2 && r2.as_carrier_completed >= 3 && r3 && r3.as_carrier_completed >= 1;
  step('m9_leg_reputation', !!okk, `C1=${r1?.as_carrier_completed} C2=${r2?.as_carrier_completed} C3=${r3?.as_carrier_completed}`);
  save();
}
save();
const passed = out.steps.filter(s => s.pass).length;
log(`DONE: ${passed}/${out.steps.length} multi-leg scenarios passed`);
process.exit(out.steps.every(s => s.pass) ? 0 : 1);
