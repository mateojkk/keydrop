/** @typedef {{amount:string, receiverId:string, tokenId:string, txHash:string, senderId:string}} ConfirmedPayout */

/** Read an actual successful transfer receipt from a finalized spend transaction.
 * @param {any} outcome
 * @param {string} contractId
 * @returns {ConfirmedPayout | null}
 */
export function confirmedPayout(outcome, contractId) {
  const tx = outcome?.transaction;
  if (tx?.receiver_id !== contractId || !tx.hash || !tx.signer_id) return null;
  const spend = tx.actions?.find((action) => action.FunctionCall?.method_name === 'spend')?.FunctionCall;
  if (!spend?.args) return null;
  let args;
  try { args = JSON.parse(atob(spend.args)); } catch { return null; }
  if (typeof args.token_id !== 'string' || typeof args.receiver_id !== 'string' ||
      typeof args.amount !== 'string' || !/^[1-9]\d*$/.test(args.amount)) return null;
  const transfer = outcome.receipts?.find((receipt) =>
    receipt.predecessor_id === contractId && receipt.receiver_id === args.receiver_id &&
    receipt.receipt?.Action?.actions?.some((action) => action.Transfer?.deposit === args.amount));
  if (!transfer) return null;
  const transferOutcome = outcome.receipts_outcome?.find((item) => item.id === transfer.receipt_id);
  if (!transferOutcome?.outcome?.status || 'Failure' in transferOutcome.outcome.status) return null;
  return { amount: args.amount, receiverId: args.receiver_id, tokenId: args.token_id,
    txHash: tx.hash, senderId: tx.signer_id };
}
