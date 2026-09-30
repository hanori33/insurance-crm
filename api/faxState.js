
function classifyRequest(existing) {
  if (!existing) return { action: 'start' };
  if (existing.status === 'sent' && existing.provider_receipt_id) {
    return { action: 'return-existing', receiptNum: existing.provider_receipt_id };
  }
  if (existing.status === 'processing' || existing.status === 'failed' || existing.status === 'unknown') {
    return { action: 'reject-duplicate' };
  }
  return { action: 'reject-duplicate' };
}

function classifyProviderFailure(error = {}) {
  // SDK's generic transport/parse error is -99999999. Never refund it.
  const code = error.errorCode ?? error.code;
  const ambiguous = /timeout|timed.?out|socket|connection|ECONN|network|reset/i.test(String(error.message || '') + String(code || ''));
  if (error.timedOut || ambiguous || error.name === 'AbortError') return 'unknown';
  return typeof code === 'number' && Number.isInteger(code) && code < 0 && code !== -99999999 ? 'failed' : 'unknown';
}

const { displayStatus } = require('../src/utils/faxTracking');

module.exports = { classifyRequest, classifyProviderFailure, displayStatus };
