const PENDING_MS = 30 * 60 * 1000;

export function campaignSignature({ collection_name, metadata, weekly_limit, recipients }) {
  return JSON.stringify({
    collection_name: collection_name.trim(),
    metadata,
    weekly_limit,
    recipients: [...recipients].sort((a, b) => a.account_id.localeCompare(b.account_id)),
  });
}

export function mintRecordKey(contractId, account) {
  return `keydrop:airdrops:${contractId}:${account}`;
}

function records(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function findMint(storage, key, signature, now = Date.now()) {
  return records(storage, key).find(
    (record) =>
      record.signature === signature &&
      (record.status === 'confirmed' ||
        (record.status === 'pending' && now - record.at < PENDING_MS)),
  );
}

export function saveMint(storage, key, signature, status, hash = '', now = Date.now()) {
  const next = records(storage, key).filter(
    (record) =>
      record.signature !== signature &&
      (record.status === 'confirmed' || now - record.at < PENDING_MS),
  );
  next.unshift({ signature, status, hash, at: now });
  storage.setItem(key, JSON.stringify(next.slice(0, 50)));
}

export function clearPendingMint(storage, key, signature) {
  storage.setItem(
    key,
    JSON.stringify(
      records(storage, key).filter(
        (record) => !(record.signature === signature && record.status === 'pending'),
      ),
    ),
  );
}
