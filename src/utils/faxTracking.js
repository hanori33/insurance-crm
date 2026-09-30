const keyFor = (userId) => `boplan_fax_pending:${userId}`;

function readPending(storage, userId) {
  const value = storage.getItem(keyFor(userId));
  if (value && !/^[a-f0-9]{32}$/.test(value)) throw new Error('INVALID_PENDING_REQUEST');
  return value;
}

function getOrCreatePending(storage, userId, randomUUID) {
  const existing = readPending(storage, userId);
  if (existing) return existing;
  const value = randomUUID().replace(/-/g, '');
  if (!/^[a-f0-9]{32}$/.test(value)) throw new Error('INVALID_RANDOM_REQUEST');
  storage.setItem(keyFor(userId), value);
  if (storage.getItem(keyFor(userId)) !== value) throw new Error('PENDING_WRITE_FAILED');
  return value;
}

function canStartNew(result) {
  return result.status === 'sent' || (result.status === 'failed' && result.accounting_status !== 'reserved');
}

function clearResolvedPending(storage, userId, result) {
  if (!canStartNew(result)) throw new Error('UNRESOLVED_REQUEST');
  storage.removeItem(keyFor(userId));
}

function displayStatus(history, creditStatus) {
  if (history?.status === 'sent' || (history?.status === '발송완료' && history.provider_receipt_id)) return '전송완료';
  if (history?.status === 'processing') return '처리중';
  if (history?.status === 'failed' && creditStatus === 'refunded') return '전송실패 · 크레딧 환불완료';
  if (history?.status === 'failed' && creditStatus === 'reserved') return '전송실패 · 환불 처리중';
  if (history?.status === 'failed') return '전송실패';
  if (history?.status === 'unknown') return '전송 결과 확인 중 · 다시 발송하지 마세요';
  return '상태 확인 불가(기존 이력)';
}

module.exports = { readPending, getOrCreatePending, canStartNew, clearResolvedPending, displayStatus };
