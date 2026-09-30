const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Run the actual handler with every external dependency replaced. No network,
// credentials, temporary files, provider SDK or database is used.
function harness(options = {}) {
  let row = options.row ? { ...options.row } : null;
  let transaction = null;
  let sends = 0;
  let refunds = 0;
  let debits = 0;
  let downloads = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'test-owner' } } }) },
    storage: { from: () => ({
      download: async () => { downloads++; return { data: { arrayBuffer: async () => Buffer.from('%PDF-test') } }; },
      remove: async () => ({ error: null }),
    }) },
    from(table) {
      const filters = {};
      let mode, payload;
      const execute = async () => {
        if (table === 'profiles') return { data: { fax_credit: 10 - debits + refunds } };
        if (table === 'customers') return { data: options.foreignCustomer ? null : { id: 'test-customer', name: 'Synthetic customer' } };
        if (table === 'fax_credit_transactions') return { data: transaction };
        if (mode === 'insert') {
          if (row) return { error: { code: '23505' } };
          row = { ...payload, id: 'test-history' };
          return { data: { id: row.id } };
        }
        if (mode === 'update') {
          if (options.historyError) return { error: { code: 'mock' } };
          Object.assign(row, payload);
          return { error: null };
        }
        return { data: row && row.user_id === filters.user_id && row.request_id === filters.request_id ? { ...row } : null };
      };
      const q = {
        select() { return q; },
        eq(key, value) { filters[key] = value; return q; },
        insert(value) { mode = 'insert'; payload = value; return q; },
        update(value) { mode = 'update'; payload = value; return q; },
        single: execute, maybeSingle: execute,
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      return q;
    },
    async rpc(name) {
      if (name === 'reserve_fax_credit') {
        if (options.reserveError) return { error: { code: 'mock' } };
        if (transaction) return { data: { ...transaction, is_new: false } };
        debits++;
        transaction = { success: true, status: 'reserved', remaining_credit: 9, total_pages: 1 };
        return { data: { ...transaction, is_new: true } };
      }
      if (name === 'refund_fax_credit') {
        if (options.refundError) return { error: { code: 'mock' } };
        if (transaction.status === 'reserved') refunds++;
        transaction.status = 'refunded';
        return { data: { ...transaction, remaining_credit: 10 } };
      }
      if (options.completeError) return { error: { code: 'mock' } };
      transaction.status = 'sent';
      transaction.provider_receipt_id = 'synthetic-receipt';
      return { data: transaction };
    },
  };
  const mocks = {
    './faxState': require('../api/faxState'),
    formidable: { IncomingForm: class {} },
    'fs/promises': { readFile: async () => Buffer.from('%PDF-test'), unlink: async () => {}, writeFile: async () => {} },
    crypto: { randomUUID: () => 'synthetic-random-id' },
    '@supabase/supabase-js': { createClient: () => client },
    'pdf-lib': { PDFDocument: { load: async () => ({ getPageCount: () => 1 }) } },
    popbill: { config() {}, FaxService: () => ({ sendFax(...args) {
      sends++;
      if (options.providerError) args.at(-1)(options.providerError);
      else args.at(-2)('synthetic-receipt');
    } }) },
  };
  const sandbox = {
    module: { exports: {} }, Buffer, setTimeout, clearTimeout,
    process: { env: new Proxy({}, { get: () => 'mock-config' }) },
    console: { log() {}, error() {} },
    require(name) { if (!(name in mocks)) throw new Error('Unexpected dependency'); return mocks[name]; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../api/send-fax.js'), 'utf8'), sandbox);
  async function invoke(overrides = {}) {
    const res = { setHeader() {}, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
    await sandbox.module.exports({ method: 'POST', headers: { authorization: 'Bearer mock', 'content-type': 'application/json' }, body: {
      requestId: 'SyntheticRequest01', receiverNum: '0000000000', customerId: 'test-customer', insuranceCompany: 'Synthetic insurer',
      files: [{ path: 'test-owner/test.pdf', name: 'test.pdf' }], ...overrides,
    } }, res);
    return res;
  }
  return { invoke, snapshot: () => ({ row, transaction, sends, refunds, debits, downloads }) };
}

test('success sends and debits once', async () => {
  const h = harness(); await h.invoke();
  assert.equal(h.snapshot().row.status, 'sent'); assert.equal(h.snapshot().sends, 1); assert.equal(h.snapshot().debits, 1);
});
test('reserve error does not call provider', async () => {
  const h = harness({ reserveError: true }); await h.invoke(); assert.equal(h.snapshot().sends, 0);
});
for (const refundError of [false, true]) test(`explicit rejection, refund error=${refundError}`, async () => {
  const h = harness({ providerError: { code: -1 }, refundError }); await h.invoke();
  assert.equal(h.snapshot().row.status, 'failed'); assert.equal(h.snapshot().refunds, refundError ? 0 : 1);
});
test('timeout and same-request retry do not refund or resend', async () => {
  const h = harness({ providerError: { code: 'ETIMEDOUT' } }); await h.invoke(); await h.invoke();
  assert.equal(h.snapshot().row.status, 'unknown'); assert.equal(h.snapshot().refunds, 0); assert.equal(h.snapshot().sends, 1);
});
for (const failure of ['completeError', 'historyError']) test(`${failure} never resends same request`, async () => {
  const h = harness({ [failure]: true }); await h.invoke(); await h.invoke(); assert.equal(h.snapshot().sends, 1);
});
test('concurrent requests send and debit once with atomic UNIQUE insertion', async () => {
  const h = harness(); await Promise.all([h.invoke(), h.invoke()]);
  assert.equal(h.snapshot().sends, 1); assert.equal(h.snapshot().debits, 1);
});
for (const status of ['processing', 'failed', 'unknown']) test(`${status} blocks resend`, async () => {
  const h = harness({ row: { status, user_id: 'test-owner', request_id: 'SyntheticRequest01' } });
  assert.equal((await h.invoke()).body.status, status); assert.equal(h.snapshot().sends, 0); assert.equal(h.snapshot().downloads, 0);
});
test('another owner request is not returned or sent', async () => {
  const h = harness({ row: { status: 'sent', user_id: 'another-owner', request_id: 'SyntheticRequest01', provider_receipt_id: 'private' } });
  const r = await h.invoke(); assert.equal(h.snapshot().sends, 0); assert.equal(r.body.receiptNum, undefined);
});

// Required safety properties: failures here are release blockers, not expected passes.
test('network reset must remain unknown without refund', async () => {
  const h = harness({ providerError: { code: 'ECONNRESET' } }); await h.invoke();
  assert.equal(h.snapshot().refunds, 0); assert.equal(h.snapshot().row.status, 'unknown');
});
test('accepted receipt survives credit completion failure', async () => {
  const h = harness({ completeError: true }); await h.invoke();
  assert.equal(h.snapshot().row.provider_receipt_id, 'synthetic-receipt');
  assert.ok(h.snapshot().row.sent_at);
  assert.equal(h.snapshot().row.status, 'sent');
  assert.equal(h.snapshot().transaction.status, 'reserved');
  await h.invoke(); assert.equal(h.snapshot().sends, 1); assert.equal(h.snapshot().refunds, 0);
});
test('sent replay meets existing client response contract', async () => {
  const h = harness(); await h.invoke(); const r = await h.invoke();
  assert.equal(r.body.total_pages, 1); assert.ok(Array.isArray(r.body.page_counts));
  assert.ok(Number.isInteger(r.body.remaining_credit)); assert.equal(h.snapshot().sends, 1);
});
for (const providerError of [{ message: 'socket hang up' }, { message: 'connection reset' }, { code: -99999999 }, {}, { code: 'EPIPE' }]) {
  test(`ambiguous failure never refunds: ${JSON.stringify(providerError)}`, async () => {
    const h = harness({ providerError }); await h.invoke(); await h.invoke();
    assert.equal(h.snapshot().row.status, 'unknown'); assert.equal(h.snapshot().refunds, 0); assert.equal(h.snapshot().sends, 1);
  });
}
test('foreign customer is rejected before download or debit', async () => {
  const h = harness({ foreignCustomer: true }); assert.equal((await h.invoke()).code, 403);
  assert.equal(h.snapshot().downloads, 0); assert.equal(h.snapshot().debits, 0);
});
test('history contains trusted customer and safe file metadata', async () => {
  const h = harness(); await h.invoke({ customerName: 'untrusted' });
  assert.equal(h.snapshot().row.customer_name, 'Synthetic customer');
  assert.equal(h.snapshot().row.insurance_company, 'Synthetic insurer');
  assert.equal(h.snapshot().row.files[0].page_count, 1);
  assert.equal(h.snapshot().row.files[0].path, undefined);
});
test('sent status-only replay works without files', async () => {
  const h = harness(); await h.invoke(); const r = await h.invoke({ files: [], statusOnly: true });
  assert.equal(r.body.status, 'sent'); assert.equal(h.snapshot().downloads, 1); assert.equal(h.snapshot().sends, 1);
});
test('failed retry cannot refund or debit a second time', async () => {
  const h = harness({ providerError: { code: -1 } }); await h.invoke(); await h.invoke();
  assert.equal(h.snapshot().debits, 1); assert.equal(h.snapshot().refunds, 1); assert.equal(h.snapshot().sends, 1);
});
test('failure response omits raw errors and identifiers', async () => {
  const h = harness({ providerError: { code: 'ECONNRESET', message: 'private-marker' } }); const r = await h.invoke();
  assert.equal(JSON.stringify(r.body).includes('private-marker'), false);
  assert.equal(JSON.stringify(r.body).includes('SyntheticRequest01'), false);
});
