// Deploy the FULL v3 contract (commit-4 candidate) from /tmp/Waybill.c4.py
// without disturbing the commit-3 working tree.
// Usage: node deploy_c4.mjs   (writes tests/results/deploy_c4.json)
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
const w = JSON.parse(readFileSync('/home/hatch/workspace/waybill-test/test-wallet.json'));
const client = createClient({ chain: studionet, account: privateKeyToAccount(w.privateKey) });
const code = readFileSync('/home/hatch/workspace/waybill-package/Waybill.c4.py', 'utf-8');
console.log('deploying commit-4 candidate...');
const h = await client.deployContract({ code, args: [] });
console.log('tx:', h);
const r = await client.waitForTransactionReceipt({ hash: h, status: 'ACCEPTED', retries: 120, interval: 5000 });
const addr = r.data?.contract_address;
console.log('contract:', addr);
const ro = createClient({ chain: studionet });
const ps = await ro.readContract({ address: addr, functionName: 'get_protocol_state', args: [] });
console.log('protocol_state:', ps);
writeFileSync('./results/deploy_c4.json', JSON.stringify({ tx: h, address: addr }, null, 2));
