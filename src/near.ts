import type { WalletSelector } from '@near-wallet-selector/core';

export const contractId: string = import.meta.env.VITE_CONTRACT_ID || '';
const rpc = import.meta.env.VITE_RPC_URL || 'https://test.rpc.fastnear.com';
export async function checkAccounts(accountIds: string[]) {
  await Promise.all(accountIds.map(async account_id => {
    const response = await fetch(rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'account',method:'query',params:{request_type:'view_account',finality:'final',account_id}})});
    const data = await response.json();
    if(data.error) throw new Error(`Could not find ${account_id} on testnet. Check the account ID.`);
    if(!response.ok || !data.result) throw new Error('Testnet account lookup is unavailable. Try again.');
  }));
}
let selectorPromise: Promise<WalletSelector> | undefined;
export function selector() {
  return selectorPromise ??= Promise.all([
    import('@near-wallet-selector/core'),
    import('@near-wallet-selector/meteor-wallet'),
    import('@near-wallet-selector/my-near-wallet'),
  ]).then(([{setupWalletSelector},{setupMeteorWallet},{setupMyNearWallet}])=>
    setupWalletSelector({network: 'testnet', modules: [setupMeteorWallet(), setupMyNearWallet()]})).catch(error=>{selectorPromise=undefined;throw error;});
}
export async function view<T>(method: string, args: object): Promise<T> {
  if (!contractId) throw new Error('No testnet contract configured yet. Follow the deployment steps in README.');
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  const response = await fetch(rpc, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0',id:'keydrop',method:'query',params:{request_type:'call_function',finality:'final',account_id:contractId,method_name:method,args_base64:btoa(String.fromCharCode(...bytes))}})});
  if (!response.ok) throw new Error('The testnet RPC is unavailable. Try again.');
  const data = await response.json();
  if (data.error || data.result?.error) throw new Error(data.error?.message || data.result.error);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(data.result.result)));
}
export async function call(methodName: string, args: object, deposit = '1') {
  const s = await selector();
  const wallet = await s.wallet();
  const { actionCreators } = await import('@near-js/transactions');
  return wallet.signAndSendTransaction({receiverId:contractId, actions:[actionCreators.functionCall(methodName,args,250000000000000n,BigInt(deposit))]});
}
export async function verifyTransactions(hashes: string[], account: string) {
  for (const hash of hashes) {
    const response = await fetch(rpc, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({jsonrpc:'2.0',id:'receipt',method:'tx',params:{tx_hash:hash,sender_account_id:account,wait_until:'FINAL'}})});
    const data = await response.json();
    if (data.error) throw new Error('Transaction status is unavailable. Check the transaction in NearBlocks before retrying.');
    assertSuccess(data.result);
  }
}
export function assertSuccess(outcome: any) {
  if (!outcome) throw new Error('No transaction result. Check your wallet before retrying.');
  const statuses = [outcome.status, ...(outcome.receipts_outcome || []).map((o: any) => o.outcome.status)];
  const failed = statuses.find(s => s && typeof s === 'object' && 'Failure' in s);
  if (failed) throw new Error(JSON.stringify(failed.Failure));
  // spend returns the resolver's boolean, not just the receipt execution status.
  if (outcome.status?.SuccessValue && atob(outcome.status.SuccessValue) === 'false') throw new Error('Payment failed. The contract restored your balance and weekly allowance.');
}
