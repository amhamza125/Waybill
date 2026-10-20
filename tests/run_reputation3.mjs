// Waybill v3 reputation test suite v3 (commit 3) — with persisted wallets.
// Saves generated keys to results/rep3_wallets.json immediately, so a dead
// process never loses them. Fully self-contained.
// Run from tests/:  node run_reputation3.mjs
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const ADDR = '0x3611CEcC495E7DB6fa5b03BB55abbdA816A597b7';
const KEY_A = process.env.WB_KEY_A;
if (!KEY_A) { console.error('Set WB_KEY_A.'); process.exit(1); }
const shipperAcct = privateKeyToAccount(KEY_A);
const shipper = createClient({ chain: studionet, account: shipperAcct });
const ro = createClient({ chain: studionet });
const GEN = 10n ** 18n, BOND = GEN / 20n, WIN = 300;
const log = (...a) => console.log(...a);
const out = { contract: ADDR, steps: [], txs: {} };
const step = (n, p, i) => { out.steps.push({ name: n, pass: p, info: i }); log(`[${p ? 'PASS' : 'FAIL'}] ${n} :: ${i}`); };
const save = () => writeFileSync('./results/reputation3.json', JSON.stringify(out, null, 2));
const waitTx = (c, h) => c.waitForTransactionReceipt({ hash: h, status: 'ACCEPTED', retries: 240, interval: 5000 });
const readShip = async (id) => JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_shipment', args: [id] }));
const getRep = async (a) => {
  const r = await ro.readContract({ address: ADDR, functionName: 'get_reputation', args: [a] });
  return r === 'UNPROVEN' ? null : JSON.parse(r);
};
const sha256hex = (b) => createHash('sha256').update(Buffer.from(b)).digest('hex');
const intactBytes = new Uint8Array(readFileSync('./intact-800.jpg'));
const dmgBytes = new Uint8Array(readFileSync('./damaged-800.jpg'));
const intactHash = sha256hex(intactBytes), dmgHash = sha256hex(dmgBytes);

// Wallets: load or generate + persist IMMEDIATELY.
let wallets;
if (existsSync('./results/rep3_wallets.json')) {
  wallets = JSON.parse(readFileSync('./results/rep3_wallets.json'));
  log('loaded persisted wallets');
} else {
  wallets = {};
  for (const k of ['shipper2', 'carrier2', 'selfdeal', 'dustc']) {
    const pk = generatePrivateKey();
    wallets[k] = { pk: '0x' + Buffer.from(pk.slice(2), 'hex').toString('hex'), address: privateKeyToAccount(pk).address };
  }
  writeFileSync('./results/rep3_wallets.json', JSON.stringify(wallets, null, 2));
  log('generated + persisted wallets');
  for (const k of Object.keys(wallets)) {
    const fh = await shipper.sendTransaction({ to: wallets[k].address, value: GEN });
    await waitTx(shipper, fh);
  }
  log('funded');
}
const C = {};
for (const k of Object.keys(wallets)) {
  const acct = privateKeyToAccount(wallets[k].pk);
  C[k] = { acct, client: createClient({ chain: studionet, account: acct }) };
}
const newId = async () => Number(JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] })).shipment_count);

// R-self
const idSelf = await newId();
{
  let h = await C.selfdeal.client.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [C.selfdeal.acct.address, 'r3-self', 'self deal', WIN], value: GEN / 5n });
  await waitTx(C.selfdeal.client, h);
  h = await C.selfdeal.client.writeContract({ address: ADDR, functionName: 'submit_evidence',
    args: [idSelf, 'evidence://r3/self.jpg', 'self', intactHash] });
  await waitTx(C.selfdeal.client, h);
  h = await C.selfdeal.client.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [idSelf, intactBytes] });
  log('assess self (jury)', h); await waitTx(C.selfdeal.client, h);
}
// R-dust
const idDust = await newId();
{
  let h = await C.shipper2.client.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [C.dustc.acct.address, 'r3-dust', 'dust', WIN], value: GEN / 20n });
  await waitTx(C.shipper2.client, h);
  h = await C.dustc.client.writeContract({ address: ADDR, functionName: 'submit_evidence',
    args: [idDust, 'evidence://r3/dust.jpg', 'dust', intactHash] });
  await waitTx(C.dustc.client, h);
  h = await C.dustc.client.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [idDust, intactBytes] });
  log('assess dust (jury)', h); await waitTx(C.dustc.client, h);
}
// R-cancel
const idCancel = await newId();
{
  const h = await C.shipper2.client.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [C.carrier2.acct.address, 'r3-cancel', 'cancel me', WIN], value: GEN / 4n });
  await waitTx(C.shipper2.client, h);
  const h2 = await C.shipper2.client.writeContract({ address: ADDR, functionName: 'cancel_shipment', args: [idCancel] });
  await waitTx(C.shipper2.client, h2);
}
// R-ok1 (INTACT), R-ok2 (TOTAL_LOSS)
const idOk1 = await newId();
{
  let h = await C.shipper2.client.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [C.carrier2.acct.address, 'r3-ok1', 'ok intact', WIN], value: GEN / 4n });
  await waitTx(C.shipper2.client, h);
  h = await C.carrier2.client.writeContract({ address: ADDR, functionName: 'submit_evidence',
    args: [idOk1, 'evidence://r3/ok1.jpg', 'ok', intactHash] });
  await waitTx(C.carrier2.client, h);
  h = await C.carrier2.client.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [idOk1, intactBytes] });
  log('assess ok1 (jury)', h); await waitTx(C.carrier2.client, h);
}
const idOk2 = await newId();
{
  let h = await C.shipper2.client.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [C.carrier2.acct.address, 'r3-ok2', 'ok damaged', WIN], value: GEN / 4n });
  await waitTx(C.shipper2.client, h);
  h = await C.carrier2.client.writeContract({ address: ADDR, functionName: 'submit_evidence',
    args: [idOk2, 'evidence://r3/ok2.jpg', 'ok', dmgHash] });
  await waitTx(C.carrier2.client, h);
  h = await C.carrier2.client.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [idOk2, dmgBytes] });
  log('assess ok2 (jury)', h); await waitTx(C.carrier2.client, h);
  const s = await readShip(idOk2);
  if (s.verdict !== 'TOTAL_LOSS') throw new Error('ok2 verdict ' + s.verdict + ', need TOTAL_LOSS');
}
// R-appeal
const idAp = await newId();
{
  let h = await C.shipper2.client.writeContract({ address: ADDR, functionName: 'create_shipment',
    args: [C.carrier2.acct.address, 'r3-appeal', 'appeal test', WIN], value: GEN / 4n });
  await waitTx(C.shipper2.client, h);
  h = await C.carrier2.client.writeContract({ address: ADDR, functionName: 'submit_evidence',
    args: [idAp, 'evidence://r3/ap.jpg', 'ap', intactHash] });
  await waitTx(C.carrier2.client, h);
  h = await C.carrier2.client.writeContract({ address: ADDR, functionName: 'assess_delivery', args: [idAp, intactBytes] });
  log('assess appeal (jury)', h); await waitTx(C.carrier2.client, h);
  h = await C.shipper2.client.writeContract({ address: ADDR, functionName: 'appeal_assessment',
    args: [idAp, 'Second look please.'], value: BOND });
  await waitTx(C.shipper2.client, h);
  h = await C.shipper2.client.writeContract({ address: ADDR, functionName: 'resolve_appeal', args: [idAp, intactBytes] });
  log('resolve appeal (jury)', h); await waitTx(C.shipper2.client, h);
  const s = await readShip(idAp);
  const ap = JSON.parse(s.appeal);
  log(`appeal: ${ap.first_verdict}->${s.verdict} bond_${ap.bond_outcome}`);
  out.txs.appeal = { id: idAp, first: ap.first_verdict, second: s.verdict, bond: ap.bond_outcome };
  save();
}
// wait + settle
{
  const s = await readShip(idOk2);
  const waitMs = Number(s.appeal_deadline) * 1000 - Date.now() + 15000;
  if (waitMs > 0) { log(`waiting ${(waitMs / 1000).toFixed(0)}s…`); await new Promise(r => setTimeout(r, waitMs)); }
  for (const [tag, id, cl] of [['self', idSelf, C.selfdeal.client], ['dust', idDust, C.shipper2.client], ['ok1', idOk1, C.shipper2.client], ['ok2', idOk2, C.shipper2.client]]) {
    const h = await cl.writeContract({ address: ADDR, functionName: 'settle_shipment', args: [id] });
    await waitTx(cl, h);
  }
}
// assertions
{
  const r = await getRep(C.selfdeal.acct.address);
  step('r3_self_excluded', r === null, `selfdeal rep=${r ? 'RECORDED' : 'UNPROVEN'}`);
}
{
  const r = await getRep(C.dustc.acct.address);
  step('r3_dust_excluded', r === null, `dust rep=${r ? 'RECORDED' : 'UNPROVEN'}`);
}
{
  const r = await getRep(C.carrier2.acct.address);
  const okk = r && r.as_carrier_completed === 3 && r.intact === 2 && r.total_loss === 1
    && r.score_bps === Math.floor(20000 / 3);
  step('r3_carrier_math', !!okk, `completed=${r?.as_carrier_completed} intact=${r?.intact} loss=${r?.total_loss} score=${r?.score_bps}`);
}
{
  const r = await getRep(C.shipper2.acct.address);
  step('r3_shipper_activity', !!r && r.as_shipper_completed === 3, `as_shipper_completed=${r?.as_shipper_completed}`);
}
{
  const r = await getRep(C.shipper2.acct.address);
  const t = out.txs.appeal;
  const okk = !!r && r.appeals_filed === 1 && r.appeals_lost === (t.bond === 'slashed' ? 1 : 0) && r.appeals_won === (t.bond === 'refunded' ? 1 : 0);
  step('r3_appeal_record', okk, `filed=${r?.appeals_filed} won=${r?.appeals_won} lost=${r?.appeals_lost} bond_${t.bond}`);
}
{
  const lb = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_reputation_leaderboard', args: [10] }));
  const sorted = lb.every((x, i) => i === 0 || lb[i - 1].score_bps >= x.score_bps);
  const hasC2 = lb.some(x => x.address === C.carrier2.acct.address.toLowerCase());
  step('r3_leaderboard', sorted && hasC2, `entries=${lb.length} sorted=${sorted} carrier2=${hasC2}`);
}
{
  const r = await ro.readContract({ address: ADDR, functionName: 'get_reputation', args: [privateKeyToAccount(generatePrivateKey()).address] });
  step('r3_fresh_unproven', r === 'UNPROVEN', `fresh -> ${r}`);
}
save();
const passed = out.steps.filter(s => s.pass).length;
log(`DONE: ${passed}/${out.steps.length}`);
process.exit(out.steps.every(s => s.pass) ? 0 : 1);
