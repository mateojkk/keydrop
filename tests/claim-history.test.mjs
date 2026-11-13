import test from 'node:test';
import assert from 'node:assert/strict';
import { claimHistoryKey, readClaimHistory, rememberClaim } from '../src/claim-history.mjs';

test('confirmed claims persist and duplicate transaction hashes collapse', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const key = claimHistoryKey('keydrop.testnet', 'alice.testnet');
  const payout = {
    txHash: 'abc',
    amount: '100000000000000000000000',
    senderId: 'alice.testnet',
    receiverId: 'alice.testnet',
    tokenId: '1',
  };
  rememberClaim(storage, key, payout, 'c1.keydrop.testnet', 1000);
  rememberClaim(storage, key, payout, 'c1.keydrop.testnet', 2000);
  assert.deepEqual(readClaimHistory(storage, key), [
    { ...payout, rewardContractId: 'c1.keydrop.testnet', recordedAt: 2000 },
  ]);
  assert.deepEqual(
    readClaimHistory(storage, claimHistoryKey('keydrop.testnet', 'bob.testnet')),
    [],
  );
});
