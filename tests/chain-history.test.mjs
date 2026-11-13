import test from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmedChainClaim,
  fetchClaimHistoryPage,
  mergeClaimHistory,
} from '../src/chain-history.mjs';

const account = 'bob.testnet';
const contract = 'c2.keydrop.testnet';
const amount = '20000000000000000000000';
const transaction = {
  transaction_hash: 'confirmed-hash',
  signer_account_id: account,
  receiver_account_id: contract,
  block_timestamp: '1794517217022109722',
  outcomes: { status: true },
  actions: [{ action: 'FUNCTION_CALL', method: 'spend' }],
};
const detail = {
  actions: [
    {
      action: 'FUNCTION_CALL',
      method: 'spend',
      args: { args_json: { token_id: '0', receiver_id: account, amount } },
    },
  ],
  receipts: [
    {
      predecessor_account_id: contract,
      receiver_account_id: account,
      outcome: { status: true },
      actions: [{ action: 'TRANSFER', args: { deposit: amount } }],
      receipts: [],
    },
  ],
};

test('only an actual matching transfer becomes an indexed claim', () => {
  const claim = confirmedChainClaim(
    transaction,
    detail,
    account,
    'keydrop.testnet',
    'keydrop-mateo.testnet',
  );
  assert.equal(claim?.amount, amount);
  assert.equal(claim?.recordedAt, 1794517217022);
  assert.equal(
    confirmedChainClaim(
      { ...transaction, outcomes: { status: false } },
      detail,
      account,
      'keydrop.testnet',
      '',
    ),
    null,
  );
  assert.equal(
    confirmedChainClaim(transaction, { ...detail, receipts: [] }, account, 'keydrop.testnet', ''),
    null,
  );
  assert.equal(
    confirmedChainClaim(
      { ...transaction, receiver_account_id: 'other.testnet' },
      detail,
      account,
      'keydrop.testnet',
      '',
    ),
    null,
  );
});

test('history pages use the explorer cursor and merge with saved confirmations', async () => {
  const requested = [];
  const fakeFetch = async (url) => {
    requested.push(String(url));
    return {
      ok: true,
      json: async () =>
        String(url).includes('/receipts')
          ? { data: detail }
          : { data: [transaction], meta: { next_page: 'opaque-cursor' } },
    };
  };
  const page = await fetchClaimHistoryPage(
    account,
    'keydrop.testnet',
    '',
    'prior-cursor',
    fakeFetch,
  );
  assert.equal(page.next, 'opaque-cursor');
  assert.equal(page.claims.length, 1);
  assert.match(requested[0], /next=prior-cursor/);
  const saved = { ...page.claims[0], recordedAt: 0 };
  assert.deepEqual(mergeClaimHistory(page.claims, [saved]), page.claims);
});
