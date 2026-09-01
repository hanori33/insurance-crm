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
    return {
      yyyy: digits.slice(0, 4),
      mm: digits.slice(4, 6),
      dd: digits.slice(6, 8),
    };
  }

  return { yyyy: raw, mm: '', dd: '' };
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

function drawCheck(page, box) {
  if (!box) return;
  const size = box.size || 8;
  page.drawLine({
    start: { x: box.x + 1, y: box.y + size * 0.45 },
    end: { x: box.x + size * 0.38, y: box.y + 1 },
    thickness: 1.4,
    color: CHECK_COLOR,
  });
  page.drawLine({
    start: { x: box.x + size * 0.38, y: box.y + 1 },
    end: { x: box.x + size - 1, y: box.y + size - 1 },
    thickness: 1.4,
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

export function getClaimFormTemplate(companyName) {
  return getClaimFormTemplateByCompany(companyName);
}

export async function generateClaimFormPdf({ companyName, values, signatureDataUrl }) {
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

  await drawTextImage(pdfDoc, pages[fields.insuredName.page], values.insuredName, fields.insuredName);
  await drawTextImage(pdfDoc, pages[fields.ssn.page], ssnOrBirth, fields.ssn);
  await drawTextImage(pdfDoc, pages[fields.job.page], values.job, fields.job);
  await drawTextImage(pdfDoc, pages[fields.address.page], values.address, fields.address);
  await drawTextImage(pdfDoc, pages[fields.phone.page], values.phone, fields.phone);
  await drawTextImage(pdfDoc, pages[fields.accidentYear.page], accidentDate.yyyy, fields.accidentYear);
  await drawTextImage(pdfDoc, pages[fields.accidentMonth.page], accidentDate.mm, fields.accidentMonth);
  await drawTextImage(pdfDoc, pages[fields.accidentDay.page], accidentDate.dd, fields.accidentDay);
  await drawTextImage(pdfDoc, pages[fields.diagnosis.page], values.diagnosis, fields.diagnosis);
  await drawTextImage(pdfDoc, pages[fields.claimDescription.page], values.claimDescription, fields.claimDescription);
  await drawTextImage(pdfDoc, pages[fields.accountNumber.page], values.accountNumber, fields.accountNumber);
  await drawTextImage(pdfDoc, pages[fields.bank.page], values.bank, fields.bank);
  await drawTextImage(pdfDoc, pages[fields.accountHolder.page], values.accountHolder, fields.accountHolder);
  await drawTextImage(pdfDoc, pages[fields.writtenYear.page], writtenDate.yyyy, fields.writtenYear);
  await drawTextImage(pdfDoc, pages[fields.writtenMonth.page], writtenDate.mm, fields.writtenMonth);
  await drawTextImage(pdfDoc, pages[fields.writtenDay.page], writtenDate.dd, fields.writtenDay);
  await drawTextImage(pdfDoc, pages[fields.signatureName.page], values.insuredName, fields.signatureName);
  await drawSignature(pdfDoc, firstPage, signatureDataUrl, fields.signature);

  const claimTypeMap = {
    disease: template.checkboxes.claimType.disease,
    injury: template.checkboxes.claimType.injury,
    traffic: template.checkboxes.claimType.traffic,
  };
  drawCheck(firstPage, claimTypeMap[values.claimType]);

  const pdfBytes = await pdfDoc.save();
  const fileName = `${template.outputName}_${safeFilePart(values.insuredName)}_${todayYmd()}.pdf`;
  return new File([pdfBytes], fileName, { type: 'application/pdf' });
}
