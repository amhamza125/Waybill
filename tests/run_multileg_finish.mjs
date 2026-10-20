// Waybill v3 multi-leg finish script: m5 (blame-shift), m6 (abort),
// m7 (leg appeal), m8 (stall negatives), m9 (leg reputation).
// Appends to results/multileg.json. Run from tests/.
// Keys via env only (WB_KEY_A shipper, WB_KEY_B carrier).
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
const shipper = createClient({ chain: studionet, account: shipperAcct });
const ro = createClient({ chain: studionet });
const GEN = 10n ** 18n, BOND = GEN / 20n, WIN = 300;
const log = (...a) => console.log(...a);
const out = JSON.parse(readFileSync('./results/multileg.json'));
const step = (n, p, i) => { out.steps.push({ name: n, pass: p, info: i }); log(`[${p ? 'PASS' : 'FAIL'}] ${n} :: ${i}`); };
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

// Fresh carriers (persist keys)
let wallets;
try { wallets = JSON.parse(readFileSync('./results/ml_wallets.json')); log('loaded ml wallets'); }
catch {
  wallets = [];
  for (let k = 0; k < 3; k++) {
    const pk = generatePrivateKey();
    wallets.push({ pk: '0x' + Buffer.from(pk.slice(2), 'hex').toString('hex'), address: privateKeyToAccount(pk).address });
  }
  writeFileSync('./results/ml_wallets.json', JSON.stringify(wallets, null, 2));
  for (const w of wallets) {
    const fh = await shipper.sendTransaction({ to: w.address, value: GEN / 2n });
    await waitTx(shipper, fh);
  }
  log('ml wallets funded');
}
const LC = wallets.map(w => { const a = privateKeyToAccount(w.pk); return { acct: a, client: createClient({ chain: studionet, account: a }) }; });
const [C1, C2, C3] = wallets.map(w => w.address);
const legsJson = (legs) => JSON.stringify(legs.map(l => ({ carrier: l[0], amount_wei: l[1].toString() })));
const mkMulti = async (tag, legs, escrow) => {
  const ps = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
  const id = Number(ps.shipment_count);
  const h = await shipper.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [legs[0][0], `multi-${tag}`, `Multi-leg test ${tag}`, WIN, 0n, 0n, legsJson(legs)], value: escrow });
  const rp = await waitTx(shipper, h);
  if (execErr(rp)) throw new Error('create failed');
  return id;
};
const doLeg = async (id, i, client, photo) => {
  const ph = photo === 'intact' ? { bytes: intactBytes, hash: intactHash } : { bytes: dmgBytes, hash: dmgHash };
  let h = await client.writeContract({ address: ADDR, functionName: 'submit_leg_evidence',
    args: [id, i, `evidence://multi/${id}/${i}.jpg`, 'leg test', ph.hash] });
  await waitTx(client, h);
  h = await client.writeContract({ address: ADDR, functionName: 'assess_leg', args: [id, i, ph.bytes] });
  log(`assess leg ${i} of ${id} (jury)`, h); await waitTx(client, h);
  return (await readShip(id)).legs[i];
};
const settleLegAfterWindow = async (id, i) => {
  const leg = (await readShip(id)).legs[i];
  const waitMs = Number(leg.appeal_deadline) * 1000 - Date.now() + 12000;
  if (waitMs > 0) { log(`waiting ${(waitMs/1000).toFixed(0)}s…`); await new Promise(r => setTimeout(r, waitMs)); }
  const h = await shipper.writeContract({ address: ADDR, functionName: 'settle_leg', args: [id, i] });
  await waitTx(shipper, h);
  return (await readShip(id)).legs[i];
};

if (!out.steps.some(s => s.name === 'm5_blame_shift' && s.pass)) {
// M5: blame-shift
{
  const id = await mkMulti('blame', [[C1, GEN / 4n], [C2, GEN / 4n]], GEN / 2n);
  await doLeg(id, 0, LC[0].client, 'intact');
  await settleLegAfterWindow(id, 0);
  const leg1 = await doLeg(id, 1, LC[1].client, 'damaged');
  const s = await readShip(id);
  const hist = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_assessment_history', args: [500] }));
  const entry = hist.find(e => e.type === 'LEG_ASSESS' && e.shipment_id === id && e.leg_index === 1);
  const okk = s.legs[1].verdict !== 'INTACT' && entry && entry.baseline_verdict === 'INTACT';
  step('m5_blame_shift', !!okk, `leg1=${s.legs[1].verdict} baseline_recorded=${!!entry}`);
  await settleLegAfterWindow(id, 1);
  save();
}
} // end m5
if (!out.steps.some(s => s.name === 'm6_totalloss_abort' && s.pass)) {
// M6: TOTAL_LOSS abort
{
  const id = await mkMulti('abort', [[C1, GEN / 5n], [C2, GEN / 5n], [C3, GEN / 5n]], GEN * 3n / 5n);
  await doLeg(id, 0, LC[0].client, 'intact');
  await settleLegAfterWindow(id, 0);
  const leg1 = await doLeg(id, 1, LC[1].client, 'damaged');
  if (leg1.verdict !== 'TOTAL_LOSS') throw new Error('need TOTAL_LOSS, got ' + leg1.verdict);
  const settled1 = await settleLegAfterWindow(id, 1);
  const s = await readShip(id);
  const okk = s.legs[1].status === 'SETTLED' && s.legs[2].status === 'ABORTED'
    && settled1.carrier_payout_wei === '0' && settled1.shipper_refund_wei === (GEN / 5n).toString()
    && s.status === 'RESOLVED';
  step('m6_totalloss_abort', okk, `leg1 TOTAL_LOSS settled, leg2 ABORTED+refunded, route RESOLVED`);
  save();
}
} // end m6
if (!out.steps.some(s => s.name === 'm7_leg_appeal' && s.pass)) {
// M7: per-leg appeal
{
  const id = await mkMulti('appeal', [[C1, GEN / 4n], [C2, GEN / 4n]], GEN / 2n);
  await doLeg(id, 0, LC[0].client, 'intact');
  let h = await shipper.writeContract({ address: ADDR, functionName: 'appeal_leg', args: [id, 0, 'Second look.'], value: BOND });
  await waitTx(shipper, h);
  h = await shipper.writeContract({ address: ADDR, functionName: 'resolve_leg_appeal', args: [id, 0, intactBytes] });
  log('resolve leg appeal (jury)', h); await waitTx(shipper, h);
  const s = await readShip(id);
  const ap = JSON.parse(s.legs[0].appeal);
  const newBps = bpsMap[s.legs[0].verdict];
  const expOutcome = (newBps < 10000) ? 'refunded' : 'slashed';
  const okk = s.legs[0].status === 'SETTLED' && ap.bond_outcome === expOutcome;
  step('m7_leg_appeal', okk, `leg0 INTACT->${s.legs[0].verdict} bond_${ap.bond_outcome}`);
  await doLeg(id, 1, LC[1].client, 'intact');
  await settleLegAfterWindow(id, 1);
  save();
}
} // end m7
if (!out.steps.some(s => s.name === 'm8_stall_negatives' && s.pass)) {
// M8: stall negatives + 72h probe
{
  const id = await mkMulti('stall', [[C1, GEN / 4n], [C2, GEN / 4n]], GEN / 2n);
  let h = await shipper.writeContract({ address: ADDR, functionName: 'cancel_leg', args: [id, 0] });
  let rp = await waitTx(shipper, h);
  const premature = execErr(rp) && errText(rp).includes('LEG_NOT_STALLED');
  h = await LC[0].client.writeContract({ address: ADDR, functionName: 'cancel_leg', args: [id, 0] });
  rp = await waitTx(LC[0].client, h);
  const outsider = execErr(rp) && errText(rp).includes('ONLY_SHIPPER');
  step('m8_stall_negatives', premature && outsider, `premature=${premature} outsider=${outsider}`);
  await doLeg(id, 0, LC[0].client, 'intact');
  await settleLegAfterWindow(id, 0);
  const s = await readShip(id);
  const dl = Number(s.legs[0].settle_time) + 259200;
  out.stall_probe = { contract: ADDR, shipment_id: id, leg_index: 1, cancel_after_unix: dl, cancel_after_iso: new Date(dl * 1000).toISOString() };
  save();
}
} // end m8
if (!out.steps.some(s => s.name === 'm9_leg_reputation' && s.pass)) {
// M9: leg reputation
{
  const r1 = await getRep(C1), r2 = await getRep(C2), r3 = await getRep(C3);
  const okk = r1 && r1.as_carrier_completed >= 3 && r2 && r2.as_carrier_completed >= 2;
  step('m9_leg_reputation', !!okk, `C1=${r1?.as_carrier_completed} C2=${r2?.as_carrier_completed} C3=${r3?.as_carrier_completed}`);
  save();
}
} // end m9
save();
const passed = out.steps.filter(s => s.pass).length;
log(`DONE: ${passed}/${out.steps.length}`);
process.exit(out.steps.every(s => s.pass) ? 0 : 1);
