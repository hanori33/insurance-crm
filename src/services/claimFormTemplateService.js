import { PDFDocument, rgb } from 'pdf-lib';
import { getClaimFormTemplateByCompany } from '../data/claimFormTemplates';

const CHECK_COLOR = rgb(0.08, 0.42, 0.22);
const TEXT_COLOR = '#111827';

function cleanText(value) {
  return String(value || '').trim();
}

function todayYmd(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function todayParts(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return { yyyy: String(yyyy), mm, dd };
}

function safeFilePart(value) {
  return cleanText(value)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 24) || '고객';
}

function datePartsFromValue(value) {
  const raw = cleanText(value);
  const digits = raw.replace(/\D/g, '');

  if (digits.length >= 8) {
    const hh = digits.length >= 10 ? digits.slice(8, 10) : '';
    const min = digits.length >= 12 ? digits.slice(10, 12) : '';
    return {
      yyyy: digits.slice(0, 4),
      mm: digits.slice(4, 6),
      dd: digits.slice(6, 8),
      hh,
      min,
    };
  }

  return { yyyy: raw, mm: '', dd: '', hh: '', min: '' };
}

function wrapCanvasText(ctx, text, maxWidth) {
  const source = cleanText(text);
  if (!source) return [];

  const paragraphs = source.split(/\r?\n/);
  const lines = [];

  paragraphs.forEach((paragraph) => {
    let line = '';
    Array.from(paragraph).forEach((char) => {
      const next = line + char;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
  });

  return lines.length > 0 ? lines : [source];
}

function textToPngDataUrl(text, field) {
  const fontSize = field.fontSize || 10;
  const scale = 3;
  const width = Math.max(20, field.width || 120);
  const lineHeight = Math.ceil(fontSize * 1.45);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  ctx.font = `${fontSize * scale}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  const lines = wrapCanvasText(ctx, text, width * scale - 4 * scale);
  const height = Math.max(field.height || lineHeight, Math.min(field.maxHeight || field.height || 44, lines.length * lineHeight));

  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `${fontSize * scale}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  ctx.textBaseline = 'top';

  const maxLines = Math.max(1, Math.floor(height / lineHeight));
  lines.slice(0, maxLines).forEach((line, index) => {
    ctx.fillText(line, 2 * scale, index * lineHeight * scale);
  });

  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

async function drawTextImage(pdfDoc, page, text, field) {
  if (!cleanText(text) || !field) return;
  const imageData = textToPngDataUrl(text, field);
  const image = await pdfDoc.embedPng(imageData.dataUrl);
  page.drawImage(image, {
    x: field.x,
    y: field.y,
    width: imageData.width,
    height: imageData.height,
  });
}

async function drawField(pdfDoc, pages, fields, key, text) {
  const field = fields?.[key];
  if (!field || !pages[field.page]) return;
  await drawTextImage(pdfDoc, pages[field.page], text, field);
}

function drawCheck(page, box) {
  if (!box) return;
  const size = box.size || 8;
  const thickness = box.lineWidth || Math.max(1.8, size * 0.22);
  page.drawLine({
    start: { x: box.x + size * 0.16, y: box.y + size * 0.5 },
    end: { x: box.x + size * 0.39, y: box.y + size * 0.19 },
    thickness,
    color: CHECK_COLOR,
  });
  page.drawLine({
    start: { x: box.x + size * 0.39, y: box.y + size * 0.19 },
    end: { x: box.x + size * 0.86, y: box.y + size * 0.84 },
    thickness,
    color: CHECK_COLOR,
  });
}

async function drawSignature(pdfDoc, page, signatureDataUrl, field) {
  if (!signatureDataUrl || !field) return;
  const signature = await pdfDoc.embedPng(signatureDataUrl);
  page.drawImage(signature, {
    x: field.x,
    y: field.y,
    width: field.width,
    height: field.height,
  });
}

async function drawSignatureField(pdfDoc, pages, fields, key, signatureDataUrl) {
  const field = fields?.[key];
  if (!field || !pages[field.page]) return;
  await drawSignature(pdfDoc, pages[field.page], signatureDataUrl, field);
}

export function getClaimFormTemplate(companyName) {
  return getClaimFormTemplateByCompany(companyName);
}

export async function generateClaimFormPdf({ companyName, values, signatureDataUrl, beneficiarySignatureDataUrl }) {
  const template = getClaimFormTemplate(companyName);
  if (!template) throw new Error('작성 가능한 청구서 양식이 없습니다.');

  const response = await fetch(template.formUrl);
  if (!response.ok) throw new Error('청구서 원본 PDF를 불러오지 못했습니다.');

  const sourceBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const pages = pdfDoc.getPages();
  const fields = template.fields;
  const firstPage = pages[0];
  const writtenDate = todayParts();
  const accidentDate = datePartsFromValue(values.accidentDate);
  const ssnOrBirth = cleanText(values.ssn) || cleanText(values.birth);

  await drawField(pdfDoc, pages, fields, 'insuredName', values.insuredName);
  await drawField(pdfDoc, pages, fields, 'ssn', ssnOrBirth);
  await drawField(pdfDoc, pages, fields, 'job', values.job);
  await drawField(pdfDoc, pages, fields, 'address', values.address);
  await drawField(pdfDoc, pages, fields, 'phone', values.phone);
  await drawField(pdfDoc, pages, fields, 'accidentYear', accidentDate.yyyy);
  await drawField(pdfDoc, pages, fields, 'accidentMonth', accidentDate.mm);
  await drawField(pdfDoc, pages, fields, 'accidentDay', accidentDate.dd);
  await drawField(pdfDoc, pages, fields, 'accidentHour', cleanText(values.accidentHour) || accidentDate.hh);
  await drawField(pdfDoc, pages, fields, 'accidentMinute', cleanText(values.accidentMinute) || accidentDate.min);
  await drawField(pdfDoc, pages, fields, 'diagnosis', values.diagnosis);
  await drawField(pdfDoc, pages, fields, 'treatmentHospital', values.treatmentHospital);
  await drawField(pdfDoc, pages, fields, 'claimDescription', values.claimDescription);
  await drawField(pdfDoc, pages, fields, 'accountNumber', values.accountNumber);
  await drawField(pdfDoc, pages, fields, 'bank', values.bank);
  await drawField(pdfDoc, pages, fields, 'accountHolder', values.accountHolder);
  await drawField(pdfDoc, pages, fields, 'writtenYear', writtenDate.yyyy);
  await drawField(pdfDoc, pages, fields, 'writtenMonth', writtenDate.mm);
  await drawField(pdfDoc, pages, fields, 'writtenDay', writtenDate.dd);
  await drawField(pdfDoc, pages, fields, 'signatureName', values.insuredName);
  await drawSignatureField(pdfDoc, pages, fields, 'signature', signatureDataUrl);

  const beneficiaryName = cleanText(values.beneficiaryName) || (values.beneficiarySameAsInsured ? values.insuredName : '');
  const beneficiarySignatureData =
    beneficiarySignatureDataUrl || (values.beneficiarySameAsInsured ? signatureDataUrl : '');

  await drawField(pdfDoc, pages, fields, 'beneficiaryNamePage1', beneficiaryName);
  await drawSignatureField(pdfDoc, pages, fields, 'beneficiarySignaturePage1', beneficiarySignatureData);

  await drawField(pdfDoc, pages, fields, 'consentWrittenYear', writtenDate.yyyy);
  await drawField(pdfDoc, pages, fields, 'consentWrittenMonth', writtenDate.mm);
  await drawField(pdfDoc, pages, fields, 'consentWrittenDay', writtenDate.dd);
  await drawField(pdfDoc, pages, fields, 'consentSignatureName', values.insuredName);
  await drawSignatureField(pdfDoc, pages, fields, 'consentSignature', signatureDataUrl);

  await drawField(pdfDoc, pages, fields, 'beneficiaryName', beneficiaryName);
  await drawSignatureField(pdfDoc, pages, fields, 'beneficiarySignature', beneficiarySignatureData);

  const claimTypeMap = {
    disease: template.checkboxes?.claimType?.disease,
    injury: template.checkboxes?.claimType?.injury,
    traffic: template.checkboxes?.claimType?.traffic,
    other: template.checkboxes?.claimType?.other,
  };
  drawCheck(firstPage, claimTypeMap[values.claimType]);

  const receiptTypeMap = template.checkboxes?.receiptType || {};
  drawCheck(firstPage, receiptTypeMap[values.receiptType]);

  const noticeRecipientMap = template.checkboxes?.noticeRecipient || {};
  if (values.noticePolicyholder) drawCheck(firstPage, noticeRecipientMap.policyholder);
  if (values.noticeInsured) drawCheck(firstPage, noticeRecipientMap.insured);
  if (values.noticeOther) {
    drawCheck(firstPage, noticeRecipientMap.other);
    await drawField(pdfDoc, pages, fields, 'noticeOtherName', values.noticeOtherName);
    await drawField(pdfDoc, pages, fields, 'noticeOtherRelation', values.noticeOtherRelation);
  }

  const autoTransferBox = template.checkboxes?.autoTransfer?.receiveSamePerson;
  if (values.receiveSamePerson && autoTransferBox) drawCheck(pages[autoTransferBox.page], autoTransferBox);

  Object.entries(values.consents || {}).forEach(([key, checked]) => {
    if (!checked) return;
    const consentBox = template.consents?.[key]?.agree;
    if (consentBox) drawCheck(pages[template.consents[key].page], consentBox);
  });

  if (values.consents?.providePersonalCredit && template.consents?.providePersonalCreditContinued?.agree) {
    drawCheck(
      pages[template.consents.providePersonalCreditContinued.page],
      template.consents.providePersonalCreditContinued.agree
    );
  }

  const pdfBytes = await pdfDoc.save();
  const fileName = `${template.outputName}_${safeFilePart(values.insuredName)}_${todayYmd()}.pdf`;
  return new File([pdfBytes], fileName, { type: 'application/pdf' });
}
