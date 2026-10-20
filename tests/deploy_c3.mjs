// Deploy the current Waybill.py (commit-3 candidate: appeals+penalties+reputation).
// Usage: node deploy_c3.mjs   (writes tests/results/deploy_c3.json)
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
const w = JSON.parse(readFileSync('/home/hatch/workspace/waybill-test/test-wallet.json'));
const client = createClient({ chain: studionet, account: privateKeyToAccount(w.privateKey) });
const code = readFileSync('/home/hatch/workspace/waybill-package/Waybill.py', 'utf-8');
console.log('deploying commit-3 candidate...');
const h = await client.deployContract({ code, args: [] });
console.log('tx:', h);
const r = await client.waitForTransactionReceipt({ hash: h, status: 'ACCEPTED', retries: 120, interval: 5000 });
console.log('receipt status:', r.statusName || r.status);
const addr = r.contractAddress || r.contract_address;
console.log('contract:', addr);
writeFileSync('./results/deploy_c3.json', JSON.stringify({ tx: h, address: addr }, null, 2));
