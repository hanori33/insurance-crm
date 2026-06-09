const { IncomingForm } = require('formidable');
const popbill = require('popbill');

popbill.config({
  LinkID: process.env.POPBILL_LINK_ID,
  SecretKey: process.env.POPBILL_SECRET_KEY,
  IsTest: process.env.POPBILL_IS_TEST === 'true',
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { fields, files } = await parseForm(req);

    const corpNum = process.env.POPBILL_CORP_NUM;
    const senderNum = process.env.POPBILL_SENDER_NUM;
    const senderName = process.env.POPBILL_SENDER_NAME || '보플랜';

    const receiverNum = String(valueOf(fields.receiverNum) || '').replace(/[^0-9]/g, '');
    const receiverName = valueOf(fields.receiverName) || '보험사';
    const title = valueOf(fields.title) || '보험금 청구서류';
    const requestNum = `boplan-${Date.now()}`;

    const uploaded = files.files;
    const fileArray = Array.isArray(uploaded) ? uploaded : [uploaded].filter(Boolean);
    const filePaths = fileArray.map((file) => file.filepath);

    if (!corpNum || !senderNum) {
      return res.status(500).json({ error: '팝빌 환경변수가 설정되지 않았습니다.' });
    }

    if (!receiverNum) {
      return res.status(400).json({ error: '수신 팩스번호가 없습니다.' });
    }

    if (filePaths.length === 0) {
      return res.status(400).json({ error: '첨부파일이 없습니다.' });
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
        return res.status(500).json({
          error: error.message,
          code: error.code,
        });
      }
    );
  } catch (e) {
    return res.status(500).json({ error: e.message || '팩스 발송 실패' });
  }
};