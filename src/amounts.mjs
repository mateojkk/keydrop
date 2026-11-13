export const YOCTO = 10n ** 24n;
export function toYocto(value) {
  if (!/^(0|[1-9]\d*)(\.\d{1,24})?$/.test(value))
    throw new Error('Enter a positive NEAR amount with at most 24 decimals.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * YOCTO + BigInt(fraction.padEnd(24, '0'));
}
export function fromYocto(value) {
  const n = BigInt(value);
  const fraction = (n % YOCTO).toString().padStart(24, '0').replace(/0+$/, '');
  return `${n / YOCTO}${fraction ? '.' + fraction : ''}`;
}
export function validAccount(value) {
  return (
    value.length >= 2 &&
    value.length <= 64 &&
    /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(value)
  );
}
export function makeRecipients(rows, defaultAmount) {
  const result = rows
    .filter((r) => r.account.trim())
    .map((r) => ({
      account_id: r.account.trim(),
      amount: toYocto(r.amount || defaultAmount).toString(),
    }));
  if (!result.length || result.length > 20) throw new Error('Add between 1 and 20 recipients.');
  if (result.some((r) => !validAccount(r.account_id)))
    throw new Error('Check the recipient account IDs.');
  if (result.some((r) => BigInt(r.amount) <= 0n))
    throw new Error('Every reward must be greater than zero.');
  if (new Set(result.map((r) => r.account_id)).size !== result.length)
    throw new Error('Each recipient must be unique.');
  return result;
}
