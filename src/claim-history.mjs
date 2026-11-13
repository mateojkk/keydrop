export const claimHistoryKey = (factoryId, account) => `keydrop:claims:${factoryId}:${account}`;

export function readClaimHistory(storage, key) {
  try {
    const entries = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(entries)
      ? entries.filter(
          (entry) => entry && typeof entry.txHash === 'string' && typeof entry.amount === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

export function rememberClaim(storage, key, payout, rewardContractId, recordedAt = Date.now()) {
  const previous = readClaimHistory(storage, key);
  const entry = { ...payout, rewardContractId, recordedAt };
  const next = [entry, ...previous.filter((item) => item.txHash !== payout.txHash)].slice(0, 100);
  storage.setItem(key, JSON.stringify(next));
  return next;
}
