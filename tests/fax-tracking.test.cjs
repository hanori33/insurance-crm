const test = require('node:test');
const assert = require('node:assert/strict');
const { getOrCreatePending, readPending, clearResolvedPending, displayStatus } = require('../src/utils/faxTracking');
const { reconcileFailedRequest } = require('../api/faxReconciliation');

test('refresh restores same request; accounts are isolated', () => {
  const map = new Map();
  const storage = { getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  const request = getOrCreatePending(storage, 'owner', () => '12345678-1234-1234-1234-123456789012');
  assert.equal(getOrCreatePending(storage, 'owner', () => { throw new Error('must not regenerate'); }), request);
  assert.equal(readPending(storage, 'another-owner'), null);
  for (const status of ['processing', 'unknown', 'not_found']) {
    assert.throws(() => clearResolvedPending(storage, 'owner', { status }));
    assert.equal(readPending(storage, 'owner'), request);
  }
  assert.throws(() => clearResolvedPending(storage, 'owner', { status: 'failed', accounting_status: 'reserved' }));
  clearResolvedPending(storage, 'owner', { status: 'failed', accounting_status: 'refunded' });
  assert.equal(readPending(storage, 'owner'), null);
});

test('storage failure stops creation instead of using an ephemeral request', () => {
  assert.throws(() => getOrCreatePending({ getItem: () => null, setItem: () => { throw new Error('blocked'); } }, 'owner', () => '12345678-1234-1234-1234-123456789012'));
});

test('refund label requires actual refunded state and legacy receipt evidence', () => {
  assert.equal(displayStatus({ status: 'failed' }, 'reserved'), '전송실패 · 환불 처리중');
  assert.equal(displayStatus({ status: 'failed' }, null), '전송실패');
  assert.equal(displayStatus({ status: '발송완료' }, null), '상태 확인 불가(기존 이력)');
  assert.equal(displayStatus({ status: '발송완료', provider_receipt_id: 'test' }, null), '전송완료');
});

test('reconciliation retries only proven rejection and does not double refund', async () => {
  const row = { user_id: 'owner', request_id: 'request', status: 'failed', error_message: 'provider_rejected', credit_status: 'reserved' };
  let refunds = 0;
  const adapter = {
    loadOwned: async () => ({ ...row }),
    refund: async () => { if (row.credit_status === 'reserved') refunds++; row.credit_status = 'refunded'; return { data: { status: 'refunded' } }; },
  };
  await Promise.all([reconcileFailedRequest(adapter, 'owner', 'request'), reconcileFailedRequest(adapter, 'owner', 'request')]);
  assert.equal(refunds, 1);
  for (const status of ['unknown', 'processing']) {
    row.status = status; row.credit_status = 'reserved';
    await reconcileFailedRequest(adapter, 'owner', 'request');
    assert.equal(refunds, 1);
  }
  row.status = 'failed'; row.user_id = 'another-owner';
  await reconcileFailedRequest(adapter, 'owner', 'request'); assert.equal(refunds, 1);
});
