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
  return result.status === 'sent' || (result.status === 'failed' && result.accounting_status === 'refunded');
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

function statusPresentation(result) {
  const status = result?.status;
  const credit = result?.accounting_status;
  if (status === 'idle' || status === 'not_found') return { message: '', blocked: false };
  if (status === 'sent') return { message: '전송완료 · Popbill 접수 성공입니다. 최종 수신 완료를 의미하지 않습니다.', blocked: false };
  if (status === 'failed' && credit === 'refunded') return { message: '전송실패 · 크레딧 환불완료', blocked: true, retry: true };
  if (status === 'failed' && credit === 'reserved') return { message: '전송실패 · 크레딧 환불 처리중', blocked: true, refresh: true };
  if (status === 'failed') return { message: '전송실패 · 크레딧 상태 확인 필요', blocked: true, refresh: true };
  if (status === 'processing') return { message: '전송 처리 중입니다. 중복 발송 방지를 위해 잠시 기다려주세요.', blocked: true, refresh: true };
  if (status === 'unknown') return { message: '전송 결과를 확인 중입니다. 이미 접수됐을 수 있으니 다시 발송하지 마세요.', blocked: true, refresh: true };
  if (status === 'loading') return { message: '전송 상태를 확인하고 있습니다.', blocked: true };
  if (status === 'lookup_failed') return { message: '전송 상태를 확인하지 못했습니다. 확인될 때까지 새 발송을 할 수 없습니다.', blocked: true, refresh: true };
  return { message: '상태 확인 불가(기존 이력)', blocked: true, refresh: true };
}

// Must run inside the existing Web Lock. A stale tab must never rotate another
// tab's request, even if that request has already completed.
async function prepareRequest({ storage, userId, expectedRequest, lookup, randomUUID, retryRequest }) {
  const current = readPending(storage, userId);
  if (current !== expectedRequest) throw new Error('STALE_DRAFT');
  if (current) {
    const result = await lookup(current);
    if (readPending(storage, userId) !== current) throw new Error('STALE_DRAFT');
    if (result.status === 'not_found') return current;
    if (result.status !== 'sent' && !(result.status === 'failed' && result.accounting_status === 'refunded' && retryRequest === current)) {
      throw new Error('UNRESOLVED_REQUEST');
    }
    // Replace atomically without first removing the durable previous request.
    const next = randomUUID().replace(/-/g, '');
    if (!/^[a-f0-9]{32}$/.test(next) || next === current) throw new Error('INVALID_RANDOM_REQUEST');
    storage.setItem(keyFor(userId), next);
    if (readPending(storage, userId) !== next) throw new Error('PENDING_WRITE_FAILED');
    return next;
  }
  return getOrCreatePending(storage, userId, randomUUID);
}

function historyDetails(row) {
  const files = row.files || [];
  const pages = files.length && files.every(file => Number.isInteger(file.page_count) && file.page_count > 0)
    ? files.reduce((sum, file) => sum + file.page_count, 0) : null;
  const date = row.sent_at ? new Date(row.sent_at) : null;
  return {
    pages: pages === null ? '확인 불가' : `${pages}장`,
    sentAt: date && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date) + ' KST'
      : '확인 불가',
  };
}

module.exports = { readPending, getOrCreatePending, canStartNew, clearResolvedPending, displayStatus, statusPresentation, prepareRequest, historyDetails };
