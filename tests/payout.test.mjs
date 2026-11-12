import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedPayout } from '../src/payout.mjs';

const contract = 'keydrop-mateo.testnet';
const amount = '100000000000000000000000';
const outcome = () => ({
  transaction: { hash:'test-hash', signer_id:'twe.testnet', receiver_id:contract,
    actions:[{FunctionCall:{method_name:'spend',args:btoa(JSON.stringify({token_id:'2',receiver_id:'twe.testnet',amount}))}}] },
  receipts:[{receipt_id:'transfer-receipt',predecessor_id:contract,receiver_id:'twe.testnet',
    receipt:{Action:{actions:[{Transfer:{deposit:amount}}]}}}],
  receipts_outcome:[{id:'transfer-receipt',outcome:{status:{SuccessValue:''}}}],
});

test('only a successful matching transfer receipt becomes a visible payout', () => {
  assert.deepEqual(confirmedPayout(outcome(),contract),{
    amount,receiverId:'twe.testnet',tokenId:'2',txHash:'test-hash',senderId:'twe.testnet',
  });
  const failed=outcome(); failed.receipts_outcome[0].outcome.status={Failure:{error:'payment failed'}};
  assert.equal(confirmedPayout(failed,contract),null);
  const wrongRecipient=outcome(); wrongRecipient.receipts[0].receiver_id='other.testnet';
  assert.equal(confirmedPayout(wrongRecipient,contract),null);
  const wrongAmount=outcome(); wrongAmount.receipts[0].receipt.Action.actions[0].Transfer.deposit='1';
  assert.equal(confirmedPayout(wrongAmount,contract),null);
  const unrelated=outcome(); unrelated.transaction.actions[0].FunctionCall.method_name='nft_transfer';
  assert.equal(confirmedPayout(unrelated,contract),null);
});
