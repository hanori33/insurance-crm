const test = require('node:test');
const assert = require('node:assert/strict');
const { getOrCreatePending, readPending, clearResolvedPending, displayStatus } = require('../src/utils/faxTracking');
const { reconcileFailedRequest } = require('../api/faxReconciliation');
const { prepareRequest, statusPresentation, historyDetails } = require('../src/utils/faxTracking');

function draftFixture(result) {
  const values = new Map();
  const storage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const previous = getOrCreatePending(storage, 'owner', () => '11111111-1111-1111-1111-111111111111');
  let lookups = 0;
  const args = { storage, userId: 'owner', expectedRequest: previous, lookup: async () => { lookups++; return result; }, randomUUID: () => '22222222-2222-2222-2222-222222222222' };
  return { args, previous, lookups: () => lookups };
}

test('sent remains durable until explicit new submission rechecks server', async () => {
  const f = draftFixture({ status: 'sent' });
  assert.equal(readPending(f.args.storage, 'owner'), f.previous);
  assert.equal(statusPresentation({ status: 'sent' }).refresh, undefined);
  const next = await prepareRequest(f.args);
  assert.notEqual(next, f.previous);
  assert.equal(f.lookups(), 1);
  assert.equal(readPending(f.args.storage, 'owner'), next);
  // A queued click or stale second tab cannot rotate the newly created request.
  await assert.rejects(prepareRequest(f.args), /STALE_DRAFT/);
});

test('refresh adopts durable sent request and supports a newly composed claim', async () => {
  const f = draftFixture({ status: 'sent' });
  const restored = readPending(f.args.storage, 'owner');
  const next = await prepareRequest({ ...f.args, expectedRequest: restored });
  assert.notEqual(next, restored);
});

for (const result of [
  { status: 'processing' }, { status: 'unknown' },
  { status: 'failed', accounting_status: 'reserved' },
  { status: 'failed', accounting_status: null },
  { status: 'failed', accounting_status: 'sent' }, { status: 'legacy' },
]) test(`new attempt blocked for ${result.status}/${result.accounting_status || 'none'}`, async () => {
  const f = draftFixture(result);
  await assert.rejects(prepareRequest(f.args), /UNRESOLVED_REQUEST/);
  assert.equal(readPending(f.args.storage, 'owner'), f.previous);
  assert.equal(statusPresentation(result).blocked, true);
});

test('refunded requires explicit rewrite and creates a different request', async () => {
  const f = draftFixture({ status: 'failed', accounting_status: 'refunded' });
  await assert.rejects(prepareRequest(f.args), /UNRESOLVED_REQUEST/);
  assert.equal(statusPresentation({ status: 'failed', accounting_status: 'refunded' }).retry, true);
  const next = await prepareRequest({ ...f.args, retryRequest: f.previous });
  assert.notEqual(next, f.previous);
});

test('status query failure blocks sending and preserves request', async () => {
  const f = draftFixture({ status: 'sent' });
  await assert.rejects(prepareRequest({ ...f.args, lookup: async () => { throw new Error('offline'); } }));
  assert.equal(readPending(f.args.storage, 'owner'), f.previous);
  assert.equal(statusPresentation({ status: 'lookup_failed' }).blocked, true);
});

test('two concurrent stale drafts cannot both start a new attempt', async () => {
  const f = draftFixture({ status: 'sent' });
  // Web Locks serializes this in the browser; helper also rechecks after lookup.
  const results = await Promise.allSettled([prepareRequest(f.args), prepareRequest(f.args)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
});

test('not_found preserves original request rather than rotating it', async () => {
  const f = draftFixture({ status: 'not_found' });
  assert.equal(await prepareRequest(f.args), f.previous);
});

test('history uses KST acceptance time and validated total page count', () => {
  const result = historyDetails({ sent_at: '2026-09-30T23:05:06Z', files: [{ page_count: 2 }, { page_count: 4 }] });
  assert.equal(result.pages, '6장');
  assert.match(result.sentAt, /2026.*10.*01.*08:05:06.*KST/);
  assert.deepEqual(historyDetails({}), { pages: '확인 불가', sentAt: '확인 불가' });
  assert.equal(historyDetails({ files: [{ page_count: 2 }, {}] }).pages, '확인 불가');
});

test('UI retains lock, guards consumed draft, and shows receipt without resend controls', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/pages/FaxClaimPage.jsx'), 'utf8');
  assert.match(source, /navigator\.locks\.request\('boplan-fax-send', \{ ifAvailable: true \}/);
  assert.match(source, /if \(submittedDraftRef\.current\) return/);
  assert.match(source, /submittedDraftRef\.current = true/);
  assert.match(source, /label="접수번호" value=\{claim\.provider_receipt_id\}/);
  assert.match(source, /label="발송일시"/);
  assert.match(source, /label="총 장수"/);
  assert.doesNotMatch(source, /기존 전송 상태 확인|새 발송 준비/);
});

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
