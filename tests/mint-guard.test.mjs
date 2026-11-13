import test from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignSignature,
  mintRecordKey,
  findMint,
  saveMint,
  clearPendingMint,
} from '../src/mint-guard.mjs';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('recipient order cannot bypass a duplicate airdrop check', () => {
  const campaign = {
    collection_name: ' Reward ',
    metadata: { title: 'Thanks', media: 'https://example.com/art.png' },
    weekly_limit: '1',
    recipients: [
      { account_id: 'bob.testnet', amount: '2' },
      { account_id: 'alice.testnet', amount: '1' },
    ],
  };
  const reordered = {
    ...campaign,
    collection_name: 'Reward',
    recipients: [...campaign.recipients].reverse(),
  };
  assert.equal(campaignSignature(campaign), campaignSignature(reordered));
  assert.notEqual(
    campaignSignature(campaign),
    campaignSignature({
      ...campaign,
      recipients: [{ account_id: 'bob.testnet', amount: '3' }, campaign.recipients[1]],
    }),
  );
});

test('pending attempts expire, while confirmed airdrops stay blocked', () => {
  const store = storage();
  const key = mintRecordKey('keydrop.testnet', 'sender.testnet');
  saveMint(store, key, 'draft', 'pending', '', 1000);
  assert.equal(findMint(store, key, 'draft', 2000)?.status, 'pending');
  assert.equal(findMint(store, key, 'draft', 31 * 60 * 1000), undefined);
  saveMint(store, key, 'draft', 'confirmed', 'hash', 31 * 60 * 1000);
  assert.equal(findMint(store, key, 'draft', 90 * 60 * 1000)?.hash, 'hash');
  clearPendingMint(store, key, 'draft');
  assert.equal(findMint(store, key, 'draft', 90 * 60 * 1000)?.status, 'confirmed');
});
