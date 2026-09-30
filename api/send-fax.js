const { IncomingForm } = require('formidable');
const { readFile, unlink, writeFile } = require('fs/promises');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { PDFDocument } = require('pdf-lib');
const popbill = require('popbill');
const { classifyProviderFailure } = require('./faxState');

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_PAGES = 100;
const FAX_STORAGE_BUCKET = 'fax-files';

function cleanEnv(value) {
  return String(value || '').replace(/[\r\n\t]/g, '').trim();
}

const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL);
const SUPABASE_ANON_KEY = cleanEnv(process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY);
const SUPABASE_SERVICE_ROLE_KEY = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
const POPBILL_LINK_ID = cleanEnv(process.env.POPBILL_LINK_ID);
const POPBILL_SECRET_KEY = cleanEnv(process.env.POPBILL_SECRET_KEY);
const POPBILL_IS_TEST = cleanEnv(process.env.POPBILL_IS_TEST) === 'true';

popbill.config({
  LinkID: POPBILL_LINK_ID,
  SecretKey: POPBILL_SECRET_KEY,
  IsTest: POPBILL_IS_TEST,
  IPRestrictOnOff: true,
  UseStaticIP: false,
  UseLocalTimeYN: true,
});

const faxService = popbill.FaxService();

function parseForm(req) {
  const form = new IncomingForm({
    multiples: true,
    keepExtensions: true,
    uploadDir: '/tmp',
    maxFiles: MAX_FILES,
    maxFileSize: MAX_FILE_SIZE,
    maxTotalFileSize: MAX_TOTAL_FILE_SIZE,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error);
      else resolve({ fields, files });
    });
  });
}

function valueOf(value) {
  return Array.isArray(value) ? value[0] : value;
}

function bearerToken(req) {
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function isPdf(buffer) {
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function isPng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

function isJpeg(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

async function inspectFile(file) {
  const buffer = await readFile(file.filepath);
  const name = String(file.originalFilename || 'attachment');

  if (isPdf(buffer)) {
    try {
      const pdf = await PDFDocument.load(buffer, { updateMetadata: false });
      return { name, pageCount: pdf.getPageCount() };
    } catch {
      throw new Error(`${name}: 암호화되었거나 손상된 PDF입니다.`);
    }
  }

  if (isPng(buffer) || isJpeg(buffer)) return { name, pageCount: 1 };

  throw new Error(`${name}: PDF, JPG, PNG 파일만 발송할 수 있습니다.`);
}


function sendPopbillFax({ corpNum, senderNum, receiverNum, receiverName, filePaths, senderName, title, requestNum }) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject({ timedOut: true }), 20000);
    const accepted = (receipt) => { clearTimeout(timer); resolve(receipt); };
    const rejected = (error) => { clearTimeout(timer); reject(error); };
    try { faxService.sendFax(
      corpNum,
      senderNum,
      receiverNum,
      receiverName,
      filePaths,
      '',
      senderName,
      false,
      title,
requestNum,
'',
accepted,
rejected
    ); } catch (error) { rejected(error); }
  });
}

async function createFaxHistory(adminClient, userId, fields, requestId, fileReferences, customer) {
  const payload = {
    user_id: userId,
    request_id: requestId,
    customer_id: customer.id,
    customer_name: customer.name || '',
    insurance_company: String(valueOf(fields.insuranceCompany || fields.insurance_company) || ''),
    fax_number: String(valueOf(fields.receiverNum) || '').replace(/[^0-9]/g, ''),
    files: Array.isArray(fileReferences) ? fileReferences : [],
    status: 'processing',
    provider: 'popbill',
    provider_receipt_id: null,
    error_message: null,
    sent_at: null,
  };
  const { data, error } = await adminClient.from('fax_history').insert(payload).select('id').single();
  if (error) throw error;
  return data.id;
}

async function updateFaxHistory(adminClient, id, patch) {
  if (!id) return;
  try {
    const { error } = await adminClient.from('fax_history').update(patch).eq('id', id);
    return !error;
  } catch { return false; }
}

async function safeRpc(client, name, args) {
  try { return await client.rpc(name, args); }
  catch { return { error: true }; }
}

async function replay(client, userId, row, res) {
  const { data: credit, error } = await client.from('fax_credit_transactions')
    .select('status,total_pages,provider_receipt_id').eq('user_id', userId).eq('request_id', row.request_id).maybeSingle();
  if (error) throw new Error('LOOKUP_FAILED');
  const { data: profile, error: profileError } = await client.from('profiles')
    .select('fax_credit').eq('user_id', userId).maybeSingle();
  if (profileError) throw new Error('LOOKUP_FAILED');
  const receipt = row.provider_receipt_id || (credit?.status === 'sent' ? credit.provider_receipt_id : null);
  const status = receipt ? 'sent' : row.status;
  return res.status(200).json({
    success: status === 'sent', status, duplicate: true,
    receiptNum: receipt || null,
    total_pages: credit?.total_pages ?? (row.files || []).reduce((n, file) => n + (file.page_count || 0), 0),
    page_counts: (row.files || []).map(file => file.page_count || 0),
    remaining_credit: profile?.fax_credit ?? null,
    accounting_status: credit?.status || null,
    error: status === 'sent' ? undefined : '전송 결과를 확인 중이거나 이미 처리된 요청입니다. 다시 발송하지 마세요.',
  });
}

async function cleanupFiles(files) {
  await Promise.allSettled(files.map((file) => unlink(file.filepath)));
}

async function downloadStoredFiles(adminClient, userId, references) {
  if (!Array.isArray(references) || references.length === 0 || references.length > MAX_FILES) {
    throw new Error(`첨부파일은 1개 이상 ${MAX_FILES}개 이하여야 합니다.`);
  }

  return Promise.all(references.map(async (reference) => {
    const storagePath = String(reference.path || '');
    const originalFilename = String(reference.name || 'attachment');
    if (!storagePath.startsWith(`${userId}/`)) throw new Error('접근할 수 없는 팩스 파일입니다.');

    const { data, error } = await adminClient.storage.from(FAX_STORAGE_BUCKET).download(storagePath);
    if (error || !data) throw new Error(`${originalFilename}: 업로드 파일을 불러오지 못했습니다.`);

    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_FILE_SIZE) {
      throw new Error(`${originalFilename}: 파일은 20MB 이하여야 합니다.`);
    }

    const extension = originalFilename.split('.').pop()?.toLowerCase() || 'bin';
    const filepath = `/tmp/${randomUUID()}.${extension}`;
    await writeFile(filepath, buffer);

    return {
      filepath,
      originalFilename,
      mimetype: String(reference.type || ''),
    };
  }));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'POST 요청만 허용됩니다.' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ success: false, error: '서버의 Supabase 환경변수가 설정되지 않았습니다.' });
  }

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return res.status(401).json({ success: false, error: '로그인이 만료되었습니다. 다시 로그인해주세요.' });
  }

  let fileArray = [];
  let storagePaths = [];

  try {
    let fields;
    const contentType = String(req.headers['content-type'] || '');

    if (contentType.includes('application/json')) {
      fields = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } else {
      const parsed = await parseForm(req);
      fields = parsed.fields;
      const uploaded = parsed.files.files;
      fileArray = Array.isArray(uploaded) ? uploaded : [uploaded].filter(Boolean);
    }

    const requestNum = String(valueOf(fields.requestId) || '');
    if (!/^[A-Za-z0-9]{8,36}$/.test(requestNum)) {
      return res.status(400).json({ success: false, error: '발송 요청을 확인할 수 없습니다.' });
    }
    const { data: existing, error: lookupError } = await adminClient.from('fax_history')
      .select('id,user_id,request_id,status,provider_receipt_id,files,sent_at')
      .eq('user_id', authData.user.id).eq('request_id', requestNum).maybeSingle();
    if (lookupError) throw new Error('LOOKUP_FAILED');
    if (existing) return await replay(adminClient, authData.user.id, existing, res);
    if (fields.statusOnly) return res.status(200).json({ success: false, status: 'not_found' });

    const customerId = String(valueOf(fields.customerId) || '');
    const { data: customer, error: customerError } = await adminClient.from('customers')
      .select('id,name').eq('id', customerId).eq('user_id', authData.user.id).maybeSingle();
    if (customerError || !customer) return res.status(403).json({ success: false, error: '고객 정보를 확인할 수 없습니다.' });
    if (!String(fields.insuranceCompany || '').trim()) return res.status(400).json({ success: false, error: '보험사를 선택해주세요.' });
    if (contentType.includes('application/json')) {
      const references = Array.isArray(fields.files) ? fields.files : [];
      fileArray = await downloadStoredFiles(adminClient, authData.user.id, references);
      storagePaths = references.map(reference => String(reference.path || '')).filter(Boolean);
    }
    if (!fileArray.length) return res.status(400).json({ success: false, error: '첨부파일이 없습니다.' });

    const corpNum = cleanEnv(process.env.POPBILL_CORP_NUM);
    const senderNum = cleanEnv(process.env.POPBILL_SENDER_NUM);
    const senderName = cleanEnv(process.env.POPBILL_SENDER_NAME) || 'BOPLAN';

    if (!POPBILL_LINK_ID || !POPBILL_SECRET_KEY || !corpNum || !senderNum) {
      return res.status(500).json({ success: false, error: '팝빌 서버 환경변수가 설정되지 않았습니다.' });
    }

    const receiverNum = String(valueOf(fields.receiverNum) || '').replace(/[^0-9]/g, '');
    if (!/^[0-9]{8,15}$/.test(receiverNum)) return res.status(400).json({ success: false, error: '팩스번호를 확인해주세요.' });
    const receiverName = String(valueOf(fields.receiverName) || '보험사').slice(0, 50);
    const title = String(valueOf(fields.title) || '보험금 청구서류').slice(0, 200);
    
    const inspections = await Promise.all(fileArray.map(inspectFile));
    const pageCounts = inspections.map((item) => item.pageCount);
    const totalPages = pageCounts.reduce((sum, count) => sum + count, 0);

    if (totalPages <= 0 || totalPages > MAX_TOTAL_PAGES) {
      return res.status(400).json({
        success: false,
        error: `한 번에 최대 ${MAX_TOTAL_PAGES}장까지 발송할 수 있습니다.`,
        total_pages: totalPages,
        page_counts: pageCounts,
      });
    }

    let historyId = null;
    const metadata = fileArray.map((file, index) => ({ name: file.originalFilename, type: file.mimetype || '', page_count: pageCounts[index] }));
    try {
      historyId = await createFaxHistory(adminClient, authData.user.id, fields, requestNum, metadata, customer);
    } catch {
      // UNIQUE is the atomic send gate; a losing request never calls Popbill.
      const { data: raced, error } = await adminClient.from('fax_history').select('*')
        .eq('user_id', authData.user.id).eq('request_id', requestNum).maybeSingle();
      if (!error && raced) return await replay(adminClient, authData.user.id, raced, res);
      throw new Error('REQUEST_CONFLICT');
    }

    const { data: reservation, error: reservationError } = await safeRpc(adminClient, 'reserve_fax_credit', {
      p_user_id: authData.user.id,
      p_request_id: requestNum,
      p_total_pages: totalPages,
    });

    if (reservationError) {
      await updateFaxHistory(adminClient, historyId, { status: 'unknown', error_message: 'credit_reservation_unknown' });
      return res.status(500).json({ success: false, status: 'unknown', error: '예약 결과 확인 중입니다. 다시 발송하지 마세요.' });
    }

    if (!reservation?.success) {
      await updateFaxHistory(adminClient, historyId, { status: 'failed', error_message: 'insufficient_credit' });
      return res.status(402).json({
        success: false,
        status: 'failed',
        error: '팩스 크레딧이 부족합니다.',
        total_pages: totalPages,
        page_counts: pageCounts,
        remaining_credit: Number(reservation?.remaining_credit) || 0,
      });
    }

    if (!reservation.is_new) {
      if (reservation.status === 'sent' && reservation.provider_receipt_id) {
        return res.status(200).json({
          success: true,
          status: 'sent',
          accounting_status: 'sent',
          receiptNum: reservation.provider_receipt_id,
          total_pages: totalPages,
          page_counts: pageCounts,
          remaining_credit: Number(reservation.remaining_credit) || 0,
          duplicate: true,
        });
      }

      return res.status(409).json({
        success: false,
        error: '동일한 팩스 요청이 이미 처리 중입니다.',
        total_pages: totalPages,
        page_counts: pageCounts,
        remaining_credit: Number(reservation.remaining_credit) || 0,
      });
    }

    let receiptNum;
    try {
      receiptNum = await sendPopbillFax({
        corpNum,
        senderNum,
        receiverNum,
        receiverName,
        filePaths: fileArray.map((file) => file.filepath),
        senderName,
        title,
        requestNum,
      });
    } catch (providerError) {
      const uncertain = classifyProviderFailure(providerError) !== 'failed';
      const saved = await updateFaxHistory(adminClient, historyId, {
        status: uncertain ? 'unknown' : 'failed',
        error_message: uncertain ? 'provider_result_unknown' : 'provider_rejected',
      });
      let refund = null;
      if (!uncertain && saved) {
        const { data: refundData } = await safeRpc(adminClient, 'refund_fax_credit', {
          p_user_id: authData.user.id,
          p_request_id: requestNum,
        });
        refund = refundData;
      }
      return res.status(uncertain ? 504 : 502).json({
        success: false,
        status: uncertain ? 'unknown' : 'failed',
        accounting_status: refund?.status || 'reserved',
        error: uncertain ? '팩스 접수 결과를 확인하지 못했습니다. 재발송하지 말고 상태를 확인해주세요.' : '팝빌 팩스 발송에 실패했습니다.',
        remaining_credit: Number(refund?.remaining_credit ?? reservation.remaining_credit) || 0,
      });
    }

    if (!receiptNum || typeof receiptNum !== 'string') {
      await updateFaxHistory(adminClient, historyId, { status: 'unknown', error_message: 'provider_result_unknown' });
      return res.status(504).json({ success: false, status: 'unknown', error: '전송 결과 확인 중입니다. 다시 발송하지 마세요.' });
    }
    // Persist acceptance before accounting. Neither failure path resends/refunds.
    const acceptedAt = new Date().toISOString();
    const accepted = { status: 'sent', provider_receipt_id: receiptNum, sent_at: acceptedAt, error_message: null };
    let historySaved = await updateFaxHistory(adminClient, historyId, accepted);
    const { data: completion, error: completionError } = await safeRpc(adminClient, 'complete_fax_credit', {
      p_user_id: authData.user.id,
      p_request_id: requestNum,
      p_provider_receipt_id: String(receiptNum),
    });

    if (!historySaved) historySaved = await updateFaxHistory(adminClient, historyId, accepted);

    return res.status(200).json({
      success: true,
      status: 'sent',
      history_saved: historySaved,
      receiptNum,
      total_pages: totalPages,
      page_counts: pageCounts,
      remaining_credit: Number(completion?.remaining_credit ?? reservation.remaining_credit) || 0,
      accounting_status: completionError ? 'reserved' : 'sent',
    });
  } catch (error) {
    const status = error?.code === 1009 || error?.httpCode === 413 ? 413 : 400;
    return res.status(status).json({
      success: false,
      error: '팩스 요청을 처리하지 못했습니다. 기존 전송 상태를 확인한 후 진행해주세요.',
    });
  } finally {
    await cleanupFiles(fileArray);
    if (storagePaths.length > 0) {
      const ownedPaths = storagePaths.filter((path) => path.startsWith(`${authData.user.id}/`));
      if (ownedPaths.length > 0) {
        const { error } = await adminClient.storage.from(FAX_STORAGE_BUCKET).remove(ownedPaths);
        if (error) console.error('FAX_STORAGE_CLEANUP_FAILED');
      }
    }
  }
};
