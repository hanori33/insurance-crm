console.log('SEND-FAX VERSION 4');

const { IncomingForm } = require('formidable');
const popbill = require('popbill');

function cleanEnv(value) {
  return String(value || '')
    .replace(/[\r\n\t]/g, '')
    .trim();
}

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
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function valueOf(v) {
  return Array.isArray(v) ? v[0] : v;
}

module.exports = async function handler(req, res) {
  console.log('=== POPBILL ENV CHECK ===');
  console.log('POPBILL_LINK_ID =', POPBILL_LINK_ID ? 'EXISTS' : 'MISSING');
  console.log('POPBILL_SECRET_KEY =', POPBILL_SECRET_KEY ? 'EXISTS' : 'MISSING');
  console.log('POPBILL_CORP_NUM =', cleanEnv(process.env.POPBILL_CORP_NUM) ? 'EXISTS' : 'MISSING');
  console.log('POPBILL_SENDER_NUM =', cleanEnv(process.env.POPBILL_SENDER_NUM) ? 'EXISTS' : 'MISSING');
  console.log('POPBILL_SENDER_NAME =', cleanEnv(process.env.POPBILL_SENDER_NAME) || 'MISSING');
  console.log('POPBILL_IS_TEST =', cleanEnv(process.env.POPBILL_IS_TEST) || 'MISSING');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { fields, files } = await parseForm(req);

    const corpNum = cleanEnv(process.env.POPBILL_CORP_NUM);
    const senderNum = cleanEnv(process.env.POPBILL_SENDER_NUM);
    const senderName = cleanEnv(process.env.POPBILL_SENDER_NAME) || 'BOPLAN';

    const receiverNum = String(valueOf(fields.receiverNum) || '').replace(/[^0-9]/g, '');
    const receiverName = valueOf(fields.receiverName) || '보험사';
    const title = valueOf(fields.title) || '보험금 청구서류';
    const requestNum = `boplan-${Date.now()}`;

    const uploaded = files.files;
    const fileArray = Array.isArray(uploaded) ? uploaded : [uploaded].filter(Boolean);
    const filePaths = fileArray.map((file) => file.filepath);

    if (!POPBILL_LINK_ID || !POPBILL_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: '팝빌 LinkID 또는 SecretKey 환경변수가 없습니다.',
        linkIdExists: !!POPBILL_LINK_ID,
        secretKeyExists: !!POPBILL_SECRET_KEY,
      });
    }

    if (!corpNum || !senderNum) {
      return res.status(500).json({
        success: false,
        error: '팝빌 사업자번호 또는 발신번호 환경변수가 없습니다.',
        corpNumExists: !!corpNum,
        senderNumExists: !!senderNum,
      });
    }

    if (!receiverNum) {
      return res.status(400).json({
        success: false,
        error: '수신 팩스번호가 없습니다.',
      });
    }

    if (filePaths.length === 0) {
      return res.status(400).json({
        success: false,
        error: '첨부파일이 없습니다.',
      });
    }

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
      (receiptNum) => {
        return res.status(200).json({
          success: true,
          receiptNum,
          requestNum,
        });
      },
      (error) => {
        console.log('POPBILL ERROR');
        console.log(error);

        return res.status(500).json({
          success: false,
          error: error.message || '팝빌 팩스 발송 실패',
          code: error.code,
          detail: JSON.stringify(error),
        });
      }
    );
  } catch (e) {
    console.log('SEND-FAX CATCH ERROR');
    console.log(e);

    return res.status(500).json({
      success: false,
      error: e.message || '팩스 발송 실패',
    });
  }
};