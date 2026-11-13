const API = 'https://api-testnet.nearblocks.io/v3';

export function isKeydropCollection(accountId, factoryId, legacyId) {
  if (legacyId && accountId === legacyId) return true;
  const suffix = `.${factoryId}`;
  return Boolean(
    factoryId && accountId?.endsWith(suffix) && /^c\d+$/.test(accountId.slice(0, -suffix.length)),
  );
}

function nestedReceipts(root) {
  const result = [];
  const visit = (receipt) => {
    result.push(receipt);
    for (const child of receipt?.receipts || []) visit(child);
  };
  for (const receipt of root?.receipts || []) visit(receipt);
  return result;
}

export function confirmedChainClaim(tx, detail, account, factoryId, legacyId) {
  const contract = tx?.receiver_account_id;
  if (
    tx?.signer_account_id !== account ||
    tx?.outcomes?.status !== true ||
    !isKeydropCollection(contract, factoryId, legacyId) ||
    !tx.actions?.some((action) => action.action === 'FUNCTION_CALL' && action.method === 'spend')
  )
    return null;
  const call = detail?.actions?.find(
    (action) => action.action === 'FUNCTION_CALL' && action.method === 'spend',
  );
  const args = call?.args?.args_json;
  if (
    typeof args?.token_id !== 'string' ||
    typeof args?.receiver_id !== 'string' ||
    typeof args?.amount !== 'string' ||
    !/^[1-9]\d*$/.test(args.amount)
  )
    return null;
  const payment = nestedReceipts(detail).find(
    (receipt) =>
      receipt.predecessor_account_id === contract &&
      receipt.receiver_account_id === args.receiver_id &&
      receipt.outcome?.status === true &&
      receipt.actions?.some(
        (action) => action.action === 'TRANSFER' && action.args?.deposit === args.amount,
      ),
  );
  if (!payment) return null;
  let recordedAt = 0;
  try {
    recordedAt = Number(BigInt(tx.block_timestamp) / 1_000_000n);
  } catch {
    /* explorer omitted timestamp */
  }
  return {
    amount: args.amount,
    receiverId: args.receiver_id,
    tokenId: args.token_id,
    txHash: tx.transaction_hash,
    senderId: account,
    rewardContractId: contract,
    recordedAt,
  };
}

async function getJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok)
    throw new Error('Claim history is unavailable from the explorer. Showing saved payments.');
  return response.json();
}

export async function fetchClaimHistoryPage(
  account,
  factoryId,
  legacyId,
  next = '',
  fetchImpl = fetch,
) {
  const url = new URL(`${API}/accounts/${encodeURIComponent(account)}/txns`);
  url.searchParams.set('limit', '25');
  if (next) url.searchParams.set('next', next);
  const page = await getJson(url, fetchImpl);
  const claims = [];
  for (const tx of page.data || []) {
    if (
      tx.signer_account_id !== account ||
      tx.outcomes?.status !== true ||
      !isKeydropCollection(tx.receiver_account_id, factoryId, legacyId) ||
      !tx.actions?.some((action) => action.action === 'FUNCTION_CALL' && action.method === 'spend')
    )
      continue;
    const detail = await getJson(
      `${API}/txns/${encodeURIComponent(tx.transaction_hash)}/receipts`,
      fetchImpl,
    );
    const claim = confirmedChainClaim(tx, detail.data, account, factoryId, legacyId);
    if (claim) claims.push(claim);
  }
  return { claims, next: page.meta?.next_page || '' };
}

export function mergeClaimHistory(chain, saved) {
  const byHash = new Map();
  for (const claim of [...chain, ...saved])
    if (claim?.txHash && !byHash.has(claim.txHash)) byHash.set(claim.txHash, claim);
  return [...byHash.values()].sort((a, b) => b.recordedAt - a.recordedAt);
}
