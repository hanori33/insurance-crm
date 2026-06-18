const { IncomingForm } = require('formidable');
const { readFile, unlink, writeFile } = require('fs/promises');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { PDFDocument } = require('pdf-lib');
const popbill = require('popbill');

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
    faxService.sendFax(
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
      resolve,
      reject
    );
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
      const references = Array.isArray(fields.files) ? fields.files : [];
      storagePaths = references.map((reference) => String(reference.path || '')).filter(Boolean);
      fileArray = await downloadStoredFiles(adminClient, authData.user.id, references);
    } else {
      const parsed = await parseForm(req);
      fields = parsed.fields;
      const uploaded = parsed.files.files;
      fileArray = Array.isArray(uploaded) ? uploaded : [uploaded].filter(Boolean);
    }

    if (fileArray.length === 0) {
      return res.status(400).json({ success: false, error: '첨부파일이 없습니다.' });
    }

    const corpNum = cleanEnv(process.env.POPBILL_CORP_NUM);
    const senderNum = cleanEnv(process.env.POPBILL_SENDER_NUM);
    const senderName = cleanEnv(process.env.POPBILL_SENDER_NAME) || 'BOPLAN';

    if (!POPBILL_LINK_ID || !POPBILL_SECRET_KEY || !corpNum || !senderNum) {
      return res.status(500).json({ success: false, error: '팝빌 서버 환경변수가 설정되지 않았습니다.' });
    }

    const receiverNum = String(valueOf(fields.receiverNum) || '').replace(/[^0-9]/g, '');
    const receiverName = String(valueOf(fields.receiverName) || '보험사').slice(0, 50);
    const title = String(valueOf(fields.title) || '보험금 청구서류').slice(0, 200);
    const requestNum = String(valueOf(fields.requestId) || '');

    if (!/^\d{8,12}$/.test(receiverNum)) {
      return res.status(400).json({ success: false, error: '수신 팩스번호가 올바르지 않습니다.' });
    }

    if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestNum)) {
      return res.status(400).json({ success: false, error: '팩스 요청 식별자가 올바르지 않습니다.' });
    }

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

    const { data: reservation, error: reservationError } = await adminClient.rpc('reserve_fax_credit', {
      p_user_id: authData.user.id,
      p_request_id: requestNum,
      p_total_pages: totalPages,
    });

    if (reservationError) {
      console.error('FAX CREDIT RESERVATION ERROR', reservationError);
      return res.status(500).json({ success: false, error: '팩스 크레딧 예약에 실패했습니다.' });
    }

    if (!reservation?.success) {
      return res.status(402).json({
        success: false,
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
          receiptNum: reservation.provider_receipt_id,
          requestNum,
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
      const { data: refund, error: refundError } = await adminClient.rpc('refund_fax_credit', {
        p_user_id: authData.user.id,
        p_request_id: requestNum,
      });

      if (refundError) console.error('FAX CREDIT REFUND ERROR', refundError);
      console.error('POPBILL FAX ERROR', providerError);

      return res.status(502).json({
        success: false,
        error: providerError.message || '팝빌 팩스 발송에 실패했습니다.',
        code: providerError.code,
        remaining_credit: Number(refund?.remaining_credit ?? reservation.remaining_credit) || 0,
      });
    }

    const { data: completion, error: completionError } = await adminClient.rpc('complete_fax_credit', {
      p_user_id: authData.user.id,
      p_request_id: requestNum,
      p_provider_receipt_id: String(receiptNum),
    });

    if (completionError) console.error('FAX CREDIT COMPLETION ERROR', completionError);

    return res.status(200).json({
      success: true,
      receiptNum,
      requestNum,
      total_pages: totalPages,
      page_counts: pageCounts,
      remaining_credit: Number(completion?.remaining_credit ?? reservation.remaining_credit) || 0,
      accounting_status: completionError ? 'reserved' : 'sent',
    });
  } catch (error) {
    console.error('SEND-FAX ERROR', error);
    const status = error?.code === 1009 || error?.httpCode === 413 ? 413 : 400;
    return res.status(status).json({
      success: false,
      error: error.message || '팩스 요청을 처리하지 못했습니다.',
    });
  } finally {
    await cleanupFiles(fileArray);
    if (storagePaths.length > 0) {
      const ownedPaths = storagePaths.filter((path) => path.startsWith(`${authData.user.id}/`));
      if (ownedPaths.length > 0) {
        const { error } = await adminClient.storage.from(FAX_STORAGE_BUCKET).remove(ownedPaths);
        if (error) console.error('FAX STORAGE CLEANUP ERROR', error);
      }
    }
  }
};
