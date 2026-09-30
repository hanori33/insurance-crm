function classifyForReconciliation(row) {
  if (row.status === 'processing' && row.credit_status === 'reserved') return 'needs_review';
  if (row.status === 'failed' && row.credit_status === 'reserved' && row.error_message === 'provider_rejected' && !row.provider_receipt_id) return 'refund_required';
  if (row.status === 'unknown') return 'provider_check_required';
  if (row.status === 'sent' && !row.provider_receipt_id) return 'incomplete_success';
  return 'none';
}

// No send operation exists here. The supplied server adapter must load the
// current row and transaction, never trust a browser-provided status.
async function reconcileFailedRequest(adapter, userId, requestId) {
  const row = await adapter.loadOwned(userId, requestId);
  if (!row || row.user_id !== userId || row.request_id !== requestId) return { action: 'none' };
  const action = classifyForReconciliation(row);
  if (action !== 'refund_required') return { action };
  const result = await adapter.refund(userId, requestId);
  return { action, refunded: !result.error && result.data?.status === 'refunded' };
}

module.exports = { classifyForReconciliation, reconcileFailedRequest };
