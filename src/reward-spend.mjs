export function canSpend(reward) {
  return !reward.pending && BigInt(reward.available) > 0n;
}

export function assertSpendable(reward, amount) {
  if (reward.pending)
    throw new Error('This NFT has a payment or transfer pending. Try again after it settles.');
  if (BigInt(reward.balance) === 0n) throw new Error('This NFT has no remaining balance.');
  if (BigInt(reward.available) === 0n)
    throw new Error(
      `Weekly limit reached. It resets ${new Date(Number(reward.resets_at)).toLocaleString()}.`,
    );
  if (amount > BigInt(reward.available))
    throw new Error('Amount exceeds what is available this week.');
}
