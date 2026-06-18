const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'fax-files';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);

function cleanEnv(value) {
  return String(value || '').replace(/[\r\n\t]/g, '').trim();
}

function bearerToken(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function clients() {
  const url = cleanEnv(process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL);
  const anonKey = cleanEnv(process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY);
  const serviceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !anonKey || !serviceKey) return null;

  return {
    auth: createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

async function ensureBucket(admin) {
  const { data } = await admin.storage.getBucket(BUCKET);
  if (data) return;

  const { error } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  });

  if (error && !String(error.message).toLowerCase().includes('already exists')) throw error;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!['POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ success: false, error: '허용되지 않은 요청입니다.' });
  }

  const supabase = clients();
  if (!supabase) return res.status(500).json({ success: false, error: '서버 환경변수가 설정되지 않았습니다.' });

  const token = bearerToken(req);
  const { data, error: authError } = await supabase.auth.auth.getUser(token);
  if (!token || authError || !data.user) {
    return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
  }

  try {
    await ensureBucket(supabase.admin);

    if (req.method === 'DELETE') {
      const paths = Array.isArray(req.body?.paths) ? req.body.paths : [];
      const ownedPaths = paths.filter((path) => String(path).startsWith(`${data.user.id}/`));
      if (ownedPaths.length > 0) await supabase.admin.storage.from(BUCKET).remove(ownedPaths);
      return res.status(200).json({ success: true });
    }

    const name = String(req.body?.name || '');
    const size = Number(req.body?.size);
    const extension = name.split('.').pop()?.toLowerCase() || '';

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return res.status(400).json({ success: false, error: 'PDF, JPG, PNG 파일만 업로드할 수 있습니다.' });
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
      return res.status(400).json({ success: false, error: '파일은 20MB 이하여야 합니다.' });
    }

    const path = `${data.user.id}/${randomUUID()}.${extension}`;
    const { data: signed, error: signedError } = await supabase.admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (signedError) throw signedError;

    return res.status(200).json({
      success: true,
      bucket: BUCKET,
      path,
      token: signed.token,
    });
  } catch (error) {
    console.error('FAX UPLOAD URL ERROR', error);
    return res.status(500).json({ success: false, error: '팩스 파일 업로드 준비에 실패했습니다.' });
  }
};
