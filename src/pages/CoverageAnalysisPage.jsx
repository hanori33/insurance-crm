import React, { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import CurrentInsuranceManager from '../components/CurrentInsuranceManager';
import customerService from '../services/customerService';
import customerInsuranceService from '../services/customerInsuranceService';
import coverageCriteriaService from '../services/coverageCriteriaService';
import consultationService from '../services/consultationService';
import designRequestService from '../services/designRequestService';
import { copyTextOrPrompt, isMobileShareEnvironment, shareKakaoTextOrCopy } from '../services/shareService';
import { formatDate } from '../utils';

function getCustomerId(customer) {
  return customer?.db_id || customer?.id || customer?.app_customer_id;
}

function getCustomerIdCandidates(customer) {
  return [customer?.db_id, customer?.id, customer?.app_customer_id]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => String(value));
}

function isSameCustomerId(customer, customerId) {
  if (!customerId) return false;
  return getCustomerIdCandidates(customer).includes(String(customerId));
}

function maskCustomerName(name) {
  const clean = String(name || '').trim();
  if (!clean) return '고객';
  if (clean.length <= 1) return `${clean}○`;
  return `${clean[0]}${'○'.repeat(Math.max(1, clean.length - 1))}`;
}

function parseBirthDateForAge(birth) {
  const raw = String(birth || '').trim();
  const clean = raw.replace(/[^0-9]/g, '');
  let year = null;
  let month = null;
  let day = null;

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const parts = raw.split('-').map(Number);
    [year, month, day] = parts;
  } else if (clean.length === 8) {
    year = Number(clean.slice(0, 4));
    month = Number(clean.slice(4, 6));
    day = Number(clean.slice(6, 8));
  } else {
    return null;
  }

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function calculateAgeFromBirth(birth) {
  const birthDate = parseBirthDateForAge(birth);
  if (!birthDate) return '';

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!birthdayPassed) age -= 1;
  if (!Number.isFinite(age) || age < 0 || age > 120) return '';
  return String(age);
}

function getCustomerGender(customer) {
  const value = customer?.gender || customer?.sex || customer?.gender_label || customer?.genderLabel;
  return String(value || '').trim();
}

function getCustomerJobDetail(customer) {
  const value =
    customer?.job_detail ||
    customer?.jobDetail ||
    customer?.job_description ||
    customer?.occupation_detail ||
    customer?.occupationDetail;
  return String(value || '').trim();
}

function getStatus(overview) {
  if (!overview?.contractCount) return '보험 미등록';
  if (!overview?.coverageCount) return '보험 등록됨';
  return '보장 데이터 있음';
}

const PASTEL = {
  purple: '#F3EEFF',
  pink: '#FFF1F5',
  sky: '#EEF7FF',
  mint: '#EFFAF5',
  apricot: '#FFF6EA',
  grayPurple: '#F7F5FB',
  gray: '#F6F7FB',
  purpleBorder: '#CDBDFF',
  pinkBorder: '#FFD2DF',
  skyBorder: '#CFE8FF',
  mintBorder: '#CBEFDA',
  apricotBorder: '#FFE2BA',
  grayPurpleBorder: '#E5E0EE',
};

const INSURANCE_TYPE_OPTIONS = [
  { value: 'casualty', label: '손해보험' },
  { value: 'life', label: '생명보험' },
];

const MANAGER_TYPE_FILTERS = [
  { value: 'all', label: '전체' },
  ...INSURANCE_TYPE_OPTIONS,
];

const INSURANCE_TYPE_LABELS = {
  casualty: '손해보험',
  life: '생명보험',
  unknown: '미분류',
};

const casualtyCompanyKeywords = [
  '손해보험',
  '손보',
  '화재',
  '해상',
  '메리츠',
  '캐롯',
  '하나손',
  'MG손',
];

const lifeCompanyKeywords = [
  '생명',
  '라이프',
  '연금보험',
];

function inferInsuranceType(insuranceCompany) {
  const name = String(insuranceCompany || '').replace(/\s/g, '');
  if (!name) return 'unknown';
  if (casualtyCompanyKeywords.some((keyword) => name.includes(keyword))) return 'casualty';
  if (lifeCompanyKeywords.some((keyword) => name.includes(keyword))) return 'life';
  return 'unknown';
}

function getManagerInsuranceType(manager) {
  return inferInsuranceType(manager?.insurance_company);
}

function getManagerInsuranceTypeLabel(manager) {
  return INSURANCE_TYPE_LABELS[getManagerInsuranceType(manager)] || INSURANCE_TYPE_LABELS.unknown;
}

function startsWithEnglish(value) {
  return /^[A-Za-z]/.test(String(value || '').trim());
}

function compareKoreanFirst(a = '', b = '') {
  const aEnglish = startsWithEnglish(a);
  const bEnglish = startsWithEnglish(b);
  if (aEnglish !== bEnglish) return aEnglish ? 1 : -1;
  return String(a || '').localeCompare(String(b || ''), 'ko-KR', {
    numeric: true,
    sensitivity: 'base',
  });
}

function compareManagers(a, b) {
  const companyCompare = compareKoreanFirst(a?.insurance_company, b?.insurance_company);
  if (companyCompare !== 0) return companyCompare;
  return compareKoreanFirst(a?.name, b?.name);
}

function groupManagersByInsuranceType(managers, filter = 'all') {
  const groups = [
    { type: 'casualty', label: INSURANCE_TYPE_LABELS.casualty, managers: [] },
    { type: 'life', label: INSURANCE_TYPE_LABELS.life, managers: [] },
    { type: 'unknown', label: INSURANCE_TYPE_LABELS.unknown, managers: [] },
  ];

  (managers || []).forEach((manager) => {
    const type = getManagerInsuranceType(manager);
    if (filter !== 'all' && type !== filter) return;
    const group = groups.find((item) => item.type === type) || groups[2];
    group.managers.push(manager);
  });

  return groups
    .map((group) => ({ ...group, managers: [...group.managers].sort(compareManagers) }))
    .filter((group) => group.managers.length > 0 || (filter !== 'all' && group.type === filter));
}

function getCustomerStatusStyle(status) {
  if (status === '보장 데이터 있음') return { bg: PASTEL.mint, color: '#15803D', border: PASTEL.mintBorder };
  if (status === '보험 등록됨') return { bg: PASTEL.apricot, color: '#B45309', border: PASTEL.apricotBorder };
  return { bg: PASTEL.gray, color: COLORS.textGray, border: '#E5E7EB' };
}

function getManagerGroupStyle(type) {
  if (type === 'casualty') return { bg: PASTEL.sky, border: PASTEL.skyBorder, chipBg: '#E0F2FE', chipColor: '#0369A1' };
  if (type === 'life') return { bg: PASTEL.pink, border: PASTEL.pinkBorder, chipBg: '#FFE4EC', chipColor: '#BE185D' };
  return { bg: PASTEL.gray, border: '#E5E7EB', chipBg: PASTEL.grayPurple, chipColor: COLORS.textGray };
}

function getShareStatusStyle(status) {
  if (status === '미가입') return { bg: PASTEL.pink, color: '#BE123C' };
  if (status === '부족') return { bg: PASTEL.apricot, color: '#B45309' };
  if (status === '충족') return { bg: PASTEL.mint, color: '#15803D' };
  if (status === '기준 초과') return { bg: PASTEL.sky, color: '#1D4ED8' };
  if (status === '별도') return { bg: PASTEL.purple, color: COLORS.primary };
  return { bg: PASTEL.grayPurple, color: COLORS.textGray };
}

function getCoverageShareRows(rows, scope) {
  const source = Array.isArray(rows) ? rows : [];
  if (scope === 'shortage') {
    return source.filter((row) => row.status === '부족' || row.status === '미가입');
  }
  return source;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawText(ctx, text, x, y, maxWidth, options = {}) {
  const {
    font = '28px Arial',
    color = '#111827',
    align = 'left',
    baseline = 'top',
  } = options;

  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(String(text || ''), x, y, maxWidth);
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('이미지 생성에 실패했습니다.'));
    }, 'image/png', 0.95);
  });
}

async function createCoverageShareImageFile({ customer, rows, scope, maskName, pageIndex, pageCount, analysisDate }) {
  const rowHeight = 74;
  const width = 1200;
  const height = 330 + Math.max(rows.length, 1) * rowHeight + 150;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const logo = await loadImage('/boplan512.png');
  const customerName = maskName ? maskCustomerName(customer?.name) : String(customer?.name || '고객').trim();
  const scopeLabel = scope === 'shortage' ? '부족/미가입 보장' : '전체 보장';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#F8F5FF';
  ctx.fillRect(0, 0, width, 170);

  if (logo) {
    ctx.save();
    drawRoundedRect(ctx, 64, 42, 74, 74, 18);
    ctx.clip();
    ctx.drawImage(logo, 64, 42, 74, 74);
    ctx.restore();
  } else {
    ctx.fillStyle = '#7C3AED';
    drawRoundedRect(ctx, 64, 42, 74, 74, 18);
    ctx.fill();
    drawText(ctx, 'B', 101, 79, 60, { font: 'bold 34px Arial', color: '#FFFFFF', align: 'center', baseline: 'middle' });
  }

  drawText(ctx, '보플랜 보장분석', 158, 48, 600, { font: 'bold 40px Arial', color: '#111827' });
  drawText(ctx, '담당 설계사 기준과 현재 등록 보험정보 비교', 160, 98, 620, { font: '24px Arial', color: '#6B7280' });
  drawText(ctx, `분석 기준일 ${analysisDate}`, width - 64, 58, 360, { font: '24px Arial', color: '#4B5563', align: 'right' });
  drawText(ctx, `${scopeLabel}${pageCount > 1 ? ` · ${pageIndex + 1}/${pageCount}` : ''}`, width - 64, 98, 360, { font: 'bold 24px Arial', color: '#7C3AED', align: 'right' });

  drawText(ctx, `고객명: ${customerName}`, 64, 202, 740, { font: 'bold 32px Arial', color: '#111827' });

  const tableX = 64;
  const tableY = 260;
  const tableWidth = width - 128;
  const columns = [
    { label: '담보명', x: tableX + 24, width: 300 },
    { label: '현재 보장금액', x: tableX + 380, width: 170 },
    { label: '내 분석기준', x: tableX + 590, width: 170 },
    { label: '차이', x: tableX + 790, width: 150 },
    { label: '상태', x: tableX + 960, width: 90 },
  ];

  ctx.fillStyle = '#F3F4F6';
  drawRoundedRect(ctx, tableX, tableY, tableWidth, 52, 18);
  ctx.fill();
  columns.forEach((column) => {
    drawText(ctx, column.label, column.x, tableY + 15, column.width, { font: 'bold 21px Arial', color: '#374151' });
  });

  const displayRows = rows.length ? rows : [{ name: '표시할 분석 항목이 없습니다.', currentAmount: null, targetAmount: null, difference: null, status: '-' }];

  displayRows.forEach((row, index) => {
    const y = tableY + 62 + index * rowHeight;
    const statusStyle = getShareStatusStyle(row.status);
    ctx.fillStyle = row.status && row.status !== '-' ? statusStyle.bg : (index % 2 === 0 ? '#FFFFFF' : '#FAFAFA');
    drawRoundedRect(ctx, tableX, y, tableWidth, rowHeight - 8, 14);
    ctx.fill();

    ctx.font = 'bold 23px Arial';
    const nameLines = wrapText(ctx, row.name || '-', columns[0].width).slice(0, 2);
    nameLines.forEach((line, lineIndex) => {
      drawText(ctx, line, columns[0].x, y + 14 + lineIndex * 25, columns[0].width, { font: 'bold 23px Arial', color: '#111827' });
    });

    drawText(ctx, formatCoverageAmount(row.currentAmount), columns[1].x, y + 23, columns[1].width, { font: '22px Arial', color: '#111827' });
    drawText(ctx, formatCoverageAmount(row.targetAmount), columns[2].x, y + 23, columns[2].width, { font: '22px Arial', color: '#111827' });
    drawText(ctx, formatDifference(row.difference), columns[3].x, y + 23, columns[3].width, { font: '22px Arial', color: '#111827' });

    ctx.fillStyle = statusStyle.bg;
    drawRoundedRect(ctx, columns[4].x - 8, y + 17, 116, 34, 17);
    ctx.fill();
    drawText(ctx, row.status || '-', columns[4].x + 50, y + 35, 100, { font: 'bold 18px Arial', color: statusStyle.color, align: 'center', baseline: 'middle' });
  });

  const footerY = height - 112;
  ctx.fillStyle = '#F9FAFB';
  drawRoundedRect(ctx, 64, footerY, width - 128, 68, 18);
  ctx.fill();
  const notice = '본 자료는 담당 설계사가 설정한 분석기준과 등록된 보험정보를 비교한 참고자료입니다. 실제 보장 여부 및 지급조건은 해당 보험계약 및 약관을 확인해주세요.';
  const noticeLines = wrapText(ctx, notice, width - 180).slice(0, 2);
  noticeLines.forEach((line, index) => {
    drawText(ctx, line, 90, footerY + 14 + index * 24, width - 180, { font: '19px Arial', color: '#6B7280' });
  });

  const blob = await canvasToBlob(canvas);
  return new File([blob], `boplan-coverage-analysis-${pageIndex + 1}.png`, { type: 'image/png' });
}

async function createCoverageShareImageFiles({ customer, rows, scope, maskName }) {
  const analysisDate = formatAnalysisDate();
  const chunks = chunkArray(rows, 12);
  const files = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const file = await createCoverageShareImageFile({
      customer,
      rows: chunks[index],
      scope,
      maskName,
      pageIndex: index,
      pageCount: chunks.length,
      analysisDate,
    });
    files.push(file);
  }

  return files;
}

function downloadFiles(files) {
  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

async function shareCoverageImageFiles(files) {
  if (navigator.share && navigator.canShare?.({ files })) {
    await navigator.share({
      title: '보플랜 보장분석',
      text: '보플랜 보장분석 결과 이미지입니다.',
      files,
    });
    return 'shared';
  }

  downloadFiles(files);
  alert('공유 이미지 PNG를 저장했습니다. 카카오톡이나 메신저에서 파일로 첨부해 보내주세요.');
  return 'downloaded';
}

function toManwon(value) {
  if (value === null || value === undefined || value === '') return '';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '';
  if (numberValue % 10000 === 0) return String(numberValue / 10000);
  return String(numberValue);
}

function fromManwon(value) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(numberValue)) return null;
  return numberValue * 10000;
}

function formatCoverageAmount(value) {
  if (value === null || value === undefined || value === '') return '-';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '-';
  if (numberValue >= 10000 && numberValue % 10000 === 0) {
    return `${(numberValue / 10000).toLocaleString('ko-KR')}만원`;
  }
  return `${numberValue.toLocaleString('ko-KR')}원`;
}

function formatDifference(value) {
  if (value === null || value === undefined) return '-';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '-';
  if (numberValue > 0) return `+${formatCoverageAmount(numberValue)}`;
  if (numberValue < 0) return `-${formatCoverageAmount(Math.abs(numberValue))}`;
  return '0';
}

function formatAnalysisDate(date = new Date()) {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getRenewableLabel(value) {
  if (value === true) return '갱신';
  if (value === false) return '비갱신';
  return '확인필요';
}

function getAnalysisStatusStyle(status) {
  if (status === '미가입') return { bg: PASTEL.pink, rowBg: '#FFFAFC', border: PASTEL.pinkBorder, color: '#BE123C' };
  if (status === '부족') return { bg: PASTEL.apricot, rowBg: '#FFFCF6', border: PASTEL.apricotBorder, color: '#B45309' };
  if (status === '충족') return { bg: PASTEL.mint, rowBg: '#FAFFFC', border: PASTEL.mintBorder, color: '#15803D' };
  if (status === '기준 초과') return { bg: PASTEL.sky, rowBg: '#F8FCFF', border: PASTEL.skyBorder, color: '#1D4ED8' };
  if (status === '별도') return { bg: PASTEL.purple, rowBg: '#FCFAFF', border: PASTEL.purpleBorder, color: COLORS.primary };
  return { bg: PASTEL.grayPurple, rowBg: '#FCFBFE', border: PASTEL.grayPurpleBorder, color: COLORS.textGray };
}

function getAnalysisStatusIcon(status) {
  if (status === '미가입') return '♥';
  if (status === '부족') return '!';
  if (status === '충족') return '✓';
  if (status === '기준 초과') return '↗';
  if (status === '별도') return '◆';
  return '?';
}

function makeCriteriaDraft(categories, criteriaSet) {
  const existingByCategory = new Map(
    (criteriaSet?.items || []).map((item) => [item.standard_coverage_id, item]),
  );

  return (categories || []).map((category) => {
    const existing = existingByCategory.get(category.id);
    const isComparable = category.aggregation_mode === 'sum';

    return {
      standard_coverage_id: category.id,
      category,
      is_enabled: existing ? Boolean(existing.is_enabled) : isComparable,
      target_amount_manwon: isComparable ? toManwon(existing?.target_amount) : '',
      display_order: existing?.display_order ?? category.sort_order ?? 1000,
      memo: existing?.memo || '',
    };
  });
}

function StatusPill({ status }) {
  const style = getCustomerStatusStyle(status);

  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        borderRadius: 999,
        padding: '4px 9px',
        fontSize: 11,
        fontWeight: 900,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

function AnalysisStatusPill({ status }) {
  const style = getAnalysisStatusStyle(status);
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        borderRadius: 999,
        padding: '4px 9px',
        fontSize: 11,
        fontWeight: 900,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

export default function CoverageAnalysisPage({ onBack, onNavigate }) {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth <= 900);
  const [customers, setCustomers] = useState([]);
  const [overviewMap, setOverviewMap] = useState({});
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem('boplan_coverage_selected_customer_id') || '';
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [criteriaSet, setCriteriaSet] = useState(null);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [criteriaSaving, setCriteriaSaving] = useState(false);
  const [criteriaModalOpen, setCriteriaModalOpen] = useState(false);
  const [criteriaName, setCriteriaName] = useState('내 분석기준');
  const [criteriaDraft, setCriteriaDraft] = useState([]);
  const [analysisFilter, setAnalysisFilter] = useState('all');
  const [insuranceRefreshKey, setInsuranceRefreshKey] = useState(0);

  useEffect(() => {
    load();
    loadCriteria();
  }, []);

  useEffect(() => {
    const handler = () => setIsNarrow(window.innerWidth <= 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  async function load() {
    setLoading(true);

    try {
      const customerData = await customerService.list({ status: '전체', search: '' });
      const nextOverviewMap = await customerInsuranceService.listCustomerInsuranceOverview(
        (customerData || []).map(getCustomerId),
      );

      setCustomers(customerData || []);
      setOverviewMap(nextOverviewMap || {});
    } catch (error) {
      alert(error.message || '보장분석 정보를 불러오지 못했습니다.');
      setCustomers([]);
      setOverviewMap({});
    } finally {
      setLoading(false);
    }
  }

  async function loadCriteria() {
    setCriteriaLoading(true);

    try {
      const [masterData, defaultSet] = await Promise.all([
        customerInsuranceService.listMasterData(),
        coverageCriteriaService.getDefaultCriteriaSet(),
      ]);

      setCategories(masterData.categories || []);
      setCriteriaSet(defaultSet);
    } catch (error) {
      alert(error.message || '분석기준을 불러오지 못했습니다.');
    } finally {
      setCriteriaLoading(false);
    }
  }

  function openCriteriaModal() {
    setCriteriaName(criteriaSet?.name || '내 분석기준');
    setCriteriaDraft(makeCriteriaDraft(categories, criteriaSet));
    setCriteriaModalOpen(true);
  }

  function setCriteriaDraftValue(index, key, value) {
    setCriteriaDraft((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  }

  async function saveCriteria() {
    setCriteriaSaving(true);

    try {
      const saved = await coverageCriteriaService.saveDefaultCriteriaSet({
        id: criteriaSet?.id,
        name: criteriaName,
        items: criteriaDraft.map((item) => ({
          standard_coverage_id: item.standard_coverage_id,
          target_amount: item.category?.aggregation_mode === 'sum' ? fromManwon(item.target_amount_manwon) : null,
          is_enabled: item.is_enabled,
          display_order: item.display_order,
          memo: item.memo,
        })),
      });

      setCriteriaSet(saved);
      setCriteriaModalOpen(false);
    } catch (error) {
      alert(error.message || '분석기준 저장에 실패했습니다.');
    } finally {
      setCriteriaSaving(false);
    }
  }

  function handleInsuranceChanged() {
    setInsuranceRefreshKey((prev) => prev + 1);
    load();
  }

  function selectCustomer(customer) {
    const customerId = getCustomerId(customer);
    setSelectedCustomerId(customerId || '');
    if (typeof window !== 'undefined' && customerId) {
      window.sessionStorage.setItem('boplan_coverage_selected_customer_id', String(customerId));
    }
  }

  function clearSelectedCustomer() {
    setSelectedCustomerId('');
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('boplan_coverage_selected_customer_id');
    }
  }

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return customers;

    return customers.filter((customer) => {
      return (
        String(customer.name || '').toLowerCase().includes(keyword) ||
        String(customer.phone || '').toLowerCase().includes(keyword)
      );
    });
  }, [customers, search]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => isSameCustomerId(customer, selectedCustomerId)) || null,
    [customers, selectedCustomerId],
  );
  const selectedCustomerDbId = selectedCustomer ? getCustomerId(selectedCustomer) : selectedCustomerId;
  const hasSelectedCustomer = Boolean(selectedCustomerId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          background: 'linear-gradient(90deg, #FFFFFF 0%, #FCFAFF 100%)',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${PASTEL.purpleBorder}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={hasSelectedCustomer ? clearSelectedCustomer : onBack}
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}
        >
          ←
        </button>
        <span style={{ fontWeight: 800, fontSize: 17, color: COLORS.text }}>보장분석</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={openCriteriaModal}
            disabled={criteriaLoading}
            style={{
              border: 'none',
              background: PASTEL.purple,
              color: COLORS.primary,
              borderRadius: 999,
              padding: '8px 11px',
              fontSize: 12,
              fontWeight: 900,
              cursor: criteriaLoading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            내 분석기준 설정
          </button>
          <button
            onClick={load}
            style={{ background: 'none', border: 'none', color: COLORS.primary, fontWeight: 800, cursor: 'pointer', fontSize: 13 }}
          >
            새로고침
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px 26px',
          display: 'grid',
          gridTemplateColumns: hasSelectedCustomer && !isNarrow ? 'minmax(320px, 0.62fr) minmax(560px, 1.38fr)' : '1fr',
          gap: 16,
          alignItems: 'start',
          background: 'linear-gradient(135deg, #F5F1FF 0%, #FCFAFF 46%, #F4FAFF 100%)',
        }}
      >
        {!(hasSelectedCustomer && isNarrow) && (
        <Card style={{ border: `1px solid ${PASTEL.grayPurpleBorder}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: COLORS.text }}>고객별 현재보장</div>
              <div style={{ marginTop: 3, color: COLORS.textGray, fontSize: 12 }}>
                고객상세의 현재보험 / 보장 데이터와 같은 자료를 사용합니다.
              </div>
            </div>
            <div style={{ color: COLORS.textGray, fontSize: 12, fontWeight: 800 }}>{filteredCustomers.length}명</div>
          </div>

          {!criteriaSet && !criteriaLoading && (
            <div style={{ background: PASTEL.purple, color: COLORS.primary, border: `1px solid ${PASTEL.purpleBorder}`, borderRadius: 14, padding: 12, fontSize: 12, fontWeight: 800, marginBottom: 12, lineHeight: 1.5 }}>
              내 분석기준을 설정해주세요. 보플랜은 기본 적정보장금액을 자동 추천하지 않습니다.
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: `1.5px solid ${PASTEL.grayPurpleBorder}`,
              borderRadius: 12,
              padding: '10px 12px',
              background: '#FFFFFF',
              marginBottom: 12,
            }}
          >
            <span>🔍</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="고객명, 연락처 검색"
              style={{
                border: 'none',
                background: 'none',
                outline: 'none',
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                color: COLORS.text,
                fontFamily: 'inherit',
              }}
            />
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : filteredCustomers.length === 0 ? (
            <EmptyState icon="🛡️" message="조회할 고객이 없습니다" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredCustomers.map((customer) => {
                const customerId = getCustomerId(customer);
                const overview = overviewMap[customerId] || {};
                const status = getStatus(overview);
                const active = selectedCustomerId && isSameCustomerId(customer, selectedCustomerId);
                const statusStyle = getCustomerStatusStyle(status);

                return (
                  <button
                    key={customerId}
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    style={{
                      width: '100%',
                      border: `1.5px solid ${active ? COLORS.primary : statusStyle.border}`,
                      background: active ? `linear-gradient(135deg, ${PASTEL.purple} 0%, #FFFFFF 100%)` : '#fff',
                      borderRadius: 14,
                      padding: 14,
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: active ? '0 8px 20px rgba(124,92,252,0.12)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 14 }}>{customer.name || '이름 없음'}</div>
                        <div style={{ color: COLORS.textGray, fontSize: 12, marginTop: 3 }}>{customer.phone || '-'}</div>
                      </div>
                      <StatusPill status={status} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
                      <SmallMetric label="현재보험" value={`${overview.contractCount || 0}건`} />
                      <SmallMetric label="담보" value={`${overview.coverageCount || 0}건`} />
                      <SmallMetric label="최근 수정" value={overview.latestUpdatedAt ? formatDate(overview.latestUpdatedAt) : '-'} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
        )}

        {hasSelectedCustomer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {!selectedCustomer ? (
              <Card>
                {loading ? (
                  <LoadingSpinner />
                ) : (
                  <EmptyState icon="🛡️" message="선택한 고객을 찾을 수 없습니다" sub="목록으로 돌아가 다시 선택해주세요." />
                )}
              </Card>
            ) : (
              <>
                <Card style={{ border: `1px solid ${PASTEL.purpleBorder}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', background: PASTEL.purple, border: `1px solid ${PASTEL.purpleBorder}`, borderRadius: 16, padding: 14 }}>
                    <div>
                      <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 16 }}>{selectedCustomer.name}</div>
                      <div style={{ marginTop: 3, color: COLORS.textGray, fontSize: 12 }}>
                        {selectedCustomer.phone || '-'} · 고객상세와 동일한 현재보험 데이터를 표시합니다.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate?.('customerDetail', { id: selectedCustomerDbId })}
                      style={{
                        border: 'none',
                        background: COLORS.primary,
                        color: '#fff',
                        borderRadius: 999,
                        padding: '9px 12px',
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      고객 상세 보기
                    </button>
                  </div>
                </Card>

                <CoverageAnalysisResult
                  customer={selectedCustomer}
                  customerId={selectedCustomerDbId}
                  criteriaSet={criteriaSet}
                  filter={analysisFilter}
                  onFilterChange={setAnalysisFilter}
                  onOpenCriteria={openCriteriaModal}
                  refreshKey={insuranceRefreshKey}
                  isNarrow={isNarrow}
                />

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isNarrow ? '1fr' : 'minmax(300px, 1.08fr) minmax(300px, 0.92fr)',
                    gap: 14,
                    alignItems: 'start',
                  }}
                >
                  <DesignRequestPanel
                    customer={selectedCustomer}
                    customerId={selectedCustomerDbId}
                    criteriaSet={criteriaSet}
                    refreshKey={insuranceRefreshKey}
                    isNarrow={isNarrow}
                  />

                  <CurrentInsuranceManager customerId={selectedCustomerDbId} onChanged={handleInsuranceChanged} />
                </div>
              </>
            )}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon="🛡️"
              message="고객을 선택해주세요"
              sub="현재보험 목록과 현재보장 합산을 여기서 확인할 수 있습니다."
            />
          </Card>
        )}
      </div>

      <CriteriaModal
        visible={criteriaModalOpen}
        name={criteriaName}
        items={criteriaDraft}
        saving={criteriaSaving}
        onNameChange={setCriteriaName}
        onChangeItem={setCriteriaDraftValue}
        onSave={saveCriteria}
        onClose={() => setCriteriaModalOpen(false)}
      />
    </div>
  );
}

function CoverageAnalysisResult({ customer, customerId, criteriaSet, filter, onFilterChange, onOpenCriteria, refreshKey, isNarrow }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState('');
  const [shareScope, setShareScope] = useState('all');
  const [shareMaskName, setShareMaskName] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);

  useEffect(() => {
    load();
  }, [customerId, refreshKey]);

  async function load() {
    if (!customerId) return;
    setLoading(true);

    try {
      const contractData = await customerInsuranceService.listContracts(customerId);
      setContracts(contractData);
    } catch (error) {
      alert(error.message || '고객 보장분석 정보를 불러오지 못했습니다.');
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(
    () => customerInsuranceService.calculateCoverageSummary(contracts),
    [contracts],
  );

  const analysisRows = useMemo(
    () => customerInsuranceService.calculateCoverageAnalysis(summary, criteriaSet?.items || []),
    [summary, criteriaSet],
  );

  const filteredRows = useMemo(() => {
    if (filter === 'shortage') {
      return analysisRows.filter((row) => row.status === '부족' || row.status === '미가입');
    }
    if (filter === 'review') {
      return analysisRows.filter((row) => row.status === '확인 필요' || row.status === '별도');
    }
    return analysisRows;
  }, [analysisRows, filter]);

  async function handleShareImage() {
    const shareRows = getCoverageShareRows(analysisRows, shareScope);
    setSharingImage(true);

    try {
      const files = await createCoverageShareImageFiles({
        customer,
        rows: shareRows,
        scope: shareScope,
        maskName: shareMaskName,
      });
      await shareCoverageImageFiles(files);
    } catch (error) {
      alert(error.message || '보장분석 공유 이미지를 만들지 못했습니다.');
    } finally {
      setSharingImage(false);
    }
  }

  if (!criteriaSet) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 16 }}>내 분석기준을 설정해주세요</div>
            <div style={{ color: COLORS.textGray, fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
              기준금액은 설계사가 직접 입력합니다. 보플랜은 적정 가입금액을 자동으로 정하지 않습니다.
            </div>
          </div>
          <button type="button" onClick={onOpenCriteria} style={primarySmallButtonStyle}>
            기준 설정
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ border: `1px solid ${PASTEL.grayPurpleBorder}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12, background: PASTEL.grayPurple, border: `1px solid ${PASTEL.grayPurpleBorder}`, borderRadius: 16, padding: 14 }}>
        <div>
          <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 16 }}>현재 / 기준 비교</div>
          <div style={{ color: COLORS.textGray, fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
            이 분석은 내가 설정한 보장기준과 현재 등록된 보험정보를 비교한 결과입니다.
            보험 가입 필요성, 적정 가입금액 또는 가입 가능 여부를 의미하지 않습니다.
          </div>
        </div>
        <button type="button" onClick={onOpenCriteria} style={ghostSmallButtonStyle}>
          기준 수정
        </button>
      </div>

      <div style={{ background: PASTEL.purple, border: `1px solid ${PASTEL.purpleBorder}`, borderRadius: 14, padding: 12, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ ...labelStyle, minWidth: 160 }}>
            공유 범위
            <select
              value={shareScope}
              onChange={(event) => setShareScope(event.target.value)}
              style={{ ...inputStyle, padding: '8px 10px', fontSize: 12, background: '#fff' }}
            >
              <option value="all">전체 보장</option>
              <option value="shortage">부족/미가입 보장만</option>
            </select>
          </label>

          <label style={{ color: COLORS.textGray, fontSize: 12, fontWeight: 800, display: 'flex', gap: 7, alignItems: 'center', marginTop: 20 }}>
            <input
              type="checkbox"
              checked={shareMaskName}
              onChange={(event) => setShareMaskName(event.target.checked)}
            />
            고객명 마스킹
          </label>
        </div>

        <button
          type="button"
          onClick={handleShareImage}
          disabled={sharingImage || loading}
          style={{
            ...primarySmallButtonStyle,
            opacity: sharingImage || loading ? 0.65 : 1,
            cursor: sharingImage || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {sharingImage ? '이미지 생성 중...' : '이미지로 공유'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <FilterButton label="전체 보기" active={filter === 'all'} onClick={() => onFilterChange('all')} />
        <FilterButton label="부족한 보장만 보기" active={filter === 'shortage'} onClick={() => onFilterChange('shortage')} />
        <FilterButton label="확인 필요 보기" active={filter === 'review'} onClick={() => onFilterChange('review')} />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filteredRows.length === 0 ? (
        <div style={{ color: COLORS.textGray, fontSize: 13, padding: '12px 0' }}>
          표시할 분석 항목이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredRows.map((row) => {
            const statusStyle = getAnalysisStatusStyle(row.status);
            return (
            <div key={row.key} style={{ border: `1px solid ${statusStyle.border}`, borderRadius: 14, overflow: 'hidden', background: statusStyle.rowBg }}>
              <button
                type="button"
                onClick={() => setExpandedKey((prev) => (prev === row.key ? '' : row.key))}
                style={{
                  width: '100%',
                  border: 'none',
                  background: statusStyle.rowBg,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'grid',
                  gridTemplateColumns: isNarrow ? '1fr 1fr' : 'minmax(210px, 1.15fr) repeat(3, minmax(82px, 0.72fr)) 104px',
                  gap: 10,
                  alignItems: 'center',
                  color: COLORS.text,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      border: `1px solid ${statusStyle.border}`,
                      fontSize: 15,
                      fontWeight: 900,
                    }}
                  >
                    {getAnalysisStatusIcon(row.status)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                </span>
                <MetricText label="현재" value={formatCoverageAmount(row.currentAmount)} />
                <MetricText label="내 기준" value={formatCoverageAmount(row.targetAmount)} />
                <MetricText label="차이" value={formatDifference(row.difference)} />
                <AnalysisStatusPill status={row.status} />
              </button>

              {expandedKey === row.key && (
                <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {row.memo && <div style={{ color: COLORS.textGray, fontSize: 12 }}>메모: {row.memo}</div>}
                  {row.status === '기준 초과' && (
                    <div style={{ color: COLORS.textGray, fontSize: 12 }}>
                      기준 초과는 내가 설정한 기준보다 현재 등록금액이 많다는 뜻이며, 중복 또는 불필요한 보험이라는 판단이 아닙니다.
                    </div>
                  )}
                  {row.details.length === 0 ? (
                    <div style={{ color: COLORS.textGray, fontSize: 12 }}>등록된 현재보험 담보가 없습니다.</div>
                  ) : (
                    row.details.map((detail) => (
                      <div key={detail.id} style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.55 }}>
                        <b>{detail.insuranceCompany}</b> · {detail.productName} · {formatCoverageAmount(detail.amount)}
                        <br />
                        <span style={{ color: COLORS.textGray }}>
                          원문: {detail.originalName || '-'} / 보험기간: {detail.coveragePeriod || '-'} / 납입기간: {detail.paymentPeriod || '-'} / {getRenewableLabel(detail.isRenewable)}
                        </span>
                        {detail.memo && <div style={{ color: COLORS.textGray }}>담보 메모: {detail.memo}</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

const defaultIncludeSections = {
  customerName: true,
  maskedName: false,
  phone: true,
  birth: true,
  age: true,
  gender: true,
  address: true,
  job: true,
  medical: false,
  disclosure: false,
  exclusions: false,
  currentCoverage: true,
  shortageCoverage: true,
  memo: true,
};

const managerEmptyForm = {
  insurance_company: '',
  name: '',
  phone: '',
  specialty: '',
  memo: '',
  is_active: true,
};

const requestEmptyForm = {
  manager_id: '',
  manual_company: '',
  manual_manager_name: '',
  manual_manager_phone: '',
  request_note: '',
  consent_checked: false,
};

function DesignRequestPanel({ customer, customerId, criteriaSet, refreshKey, isNarrow }) {
  const [managers, setManagers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [includeInactiveManagers, setIncludeInactiveManagers] = useState(false);
  const [managerTypeFilter, setManagerTypeFilter] = useState('all');
  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [managerForm, setManagerForm] = useState(managerEmptyForm);
  const [editingManager, setEditingManager] = useState(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState(requestEmptyForm);
  const [includeSections, setIncludeSections] = useState(defaultIncludeSections);
  const [messagePreview, setMessagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState([]);
  const [consultations, setConsultations] = useState([]);

  useEffect(() => {
    loadPanelData();
  }, [customerId, includeInactiveManagers, refreshKey]);

  async function loadPanelData() {
    if (!customerId) return;
    setLoading(true);

    try {
      const [managerData, requestData, contractData, consultationData] = await Promise.all([
        designRequestService.listManagers({ includeInactive: includeInactiveManagers }),
        designRequestService.listRequestsByCustomer(customerId),
        customerInsuranceService.listContracts(customerId),
        consultationService.listByCustomer(customerId),
      ]);

      setManagers(managerData);
      setRequests(requestData);
      setContracts(contractData);
      setConsultations(consultationData);
    } catch (error) {
      alert(error.message || '설계의뢰 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(
    () => customerInsuranceService.calculateCoverageSummary(contracts),
    [contracts],
  );

  const analysisRows = useMemo(
    () => customerInsuranceService.calculateCoverageAnalysis(summary, criteriaSet?.items || []),
    [summary, criteriaSet],
  );

  const activeManagers = useMemo(
    () => managers.filter((manager) => manager.is_active),
    [managers],
  );

  const groupedManagers = useMemo(
    () => groupManagersByInsuranceType(managers, managerTypeFilter),
    [managers, managerTypeFilter],
  );

  const selectedManager = useMemo(
    () => managers.find((manager) => String(manager.id) === String(requestForm.manager_id)) || null,
    [managers, requestForm.manager_id],
  );

  const includesPersonalInfo =
    includeSections.customerName ||
    includeSections.phone ||
    includeSections.birth ||
    includeSections.gender ||
    includeSections.address ||
    includeSections.job;
  const includesSensitiveInfo = includeSections.medical || includeSections.disclosure || includeSections.exclusions;
  const needsInfoConfirm = includesPersonalInfo || includesSensitiveInfo;

  function openManagerModal(manager = null) {
    setEditingManager(manager);
    setManagerForm(manager ? {
      insurance_company: manager.insurance_company || '',
      name: manager.name || '',
      phone: manager.phone || '',
      specialty: manager.specialty || '',
      memo: manager.memo || '',
      is_active: manager.is_active !== false,
    } : managerEmptyForm);
    setManagerModalOpen(true);
  }

  async function saveManager() {
    setSaving(true);

    try {
      if (editingManager?.id) {
        await designRequestService.updateManager(editingManager.id, managerForm);
      } else {
        await designRequestService.createManager(managerForm);
      }
      setManagerModalOpen(false);
      await loadPanelData();
    } catch (error) {
      alert(error.message || '설계매니저 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleManagerActive(manager) {
    const nextActive = !manager.is_active;
    if (!nextActive && !window.confirm('이 매니저를 비활성화할까요? 과거 설계의뢰 이력은 유지됩니다.')) {
      return;
    }

    setSaving(true);
    try {
      await designRequestService.setManagerActive(manager.id, nextActive);
      await loadPanelData();
    } catch (error) {
      alert(error.message || '매니저 상태 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function openRequestModal() {
    const firstManager = activeManagers[0] || null;
    const nextForm = {
      ...requestEmptyForm,
      manager_id: firstManager?.id || '',
      manual_company: firstManager ? '' : '',
      manual_manager_name: '',
      manual_manager_phone: '',
    };
    setRequestForm(nextForm);
    setIncludeSections(defaultIncludeSections);
    setMessagePreview(buildDesignRequestMessage({
      customer,
      consultations,
      summary,
      analysisRows,
      includeSections: defaultIncludeSections,
      requestNote: '',
    }));
    setRequestModalOpen(true);
  }

  function updateIncludeSection(key, value) {
    const nextSections = { ...includeSections, [key]: value };
    setIncludeSections(nextSections);
    setMessagePreview(buildDesignRequestMessage({
      customer,
      consultations,
      summary,
      analysisRows,
      includeSections: nextSections,
      requestNote: requestForm.request_note,
    }));
  }

  function updateRequestForm(key, value) {
    const nextForm = { ...requestForm, [key]: value };
    setRequestForm(nextForm);

    if (key === 'request_note') {
      setMessagePreview(buildDesignRequestMessage({
        customer,
        consultations,
        summary,
        analysisRows,
        includeSections,
        requestNote: value,
      }));
    }
  }

  async function shareRequestMessage() {
    if (needsInfoConfirm && !requestForm.consent_checked) {
      alert('개인정보 또는 민감정보 포함 확인을 체크해주세요.');
      return false;
    }

    const isMobile = isMobileShareEnvironment(isNarrow);
    if (isMobile) {
      await shareKakaoTextOrCopy({
        text: messagePreview,
        linkUrl: window.location.origin,
        buttonTitle: '보플랜 열기',
        preferKakao: true,
        preferNativeShare: true,
        copiedMessage: '설계의뢰 내용을 복사했습니다.',
        canceledMessage: '공유가 취소되었습니다. 필요하면 다시 시도해주세요.',
      });
      return true;
    }

    await copyTextOrPrompt(messagePreview, '설계의뢰 내용을 복사했습니다.');
    return true;
  }

  async function saveSentRequest() {
    if (needsInfoConfirm && !requestForm.consent_checked) {
      alert('개인정보 또는 민감정보 포함 확인을 체크해주세요.');
      return;
    }

    setSaving(true);

    try {
      await designRequestService.createRequest({
        customerId,
        manager: selectedManager,
        managerFallback: {
          insurance_company: requestForm.manual_company,
          manager_name: requestForm.manual_manager_name,
          manager_phone: requestForm.manual_manager_phone,
          manager_specialty: null,
        },
        requestMessage: messagePreview,
        includedSections: {
          ...includeSections,
          info_confirmed: needsInfoConfirm ? Boolean(requestForm.consent_checked) : false,
          sensitive_confirmed: includesSensitiveInfo ? Boolean(requestForm.consent_checked) : false,
        },
        status: 'sent',
      });

      setRequestModalOpen(false);
      await loadPanelData();
      alert('설계의뢰 이력을 저장했습니다.');
    } catch (error) {
      alert(error.message || '설계의뢰 이력 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ border: `1px solid ${PASTEL.purpleBorder}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12, background: PASTEL.purple, border: `1px solid ${PASTEL.purpleBorder}`, borderRadius: 16, padding: 14 }}>
        <div>
          <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 16 }}>설계의뢰</div>
          <div style={{ color: COLORS.textGray, fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
            보장분석 결과와 선택한 고객 정보를 조합해 설계매니저에게 보낼 요청문을 만듭니다.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button type="button" onClick={() => openManagerModal()} style={ghostSmallButtonStyle}>설계매니저 관리</button>
          <button type="button" onClick={openRequestModal} style={primarySmallButtonStyle}>설계 의뢰하기</button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: COLORS.text }}>설계매니저 {activeManagers.length}명</div>
            <label style={{ color: COLORS.textGray, fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={includeInactiveManagers}
                onChange={(event) => setIncludeInactiveManagers(event.target.checked)}
              />
              비활성 포함
            </label>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MANAGER_TYPE_FILTERS.map((option) => {
              const active = managerTypeFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setManagerTypeFilter(option.value)}
                  style={{
                    ...tinyButtonStyle,
                    borderColor: active ? COLORS.primary : COLORS.border,
                    background: active ? '#EEF2FF' : '#fff',
                    color: active ? COLORS.primary : COLORS.text,
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {managers.length === 0 ? (
            <div style={{ color: COLORS.textGray, fontSize: 13 }}>등록된 설계매니저가 없습니다.</div>
          ) : groupedManagers.length === 0 ? (
            <div style={{ color: COLORS.textGray, fontSize: 13 }}>선택한 보험사 유형의 설계매니저가 없습니다.</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isNarrow ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10,
              }}
            >
              {groupedManagers.map((group) => (
                <div
                  key={group.type}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: getManagerGroupStyle(group.type).bg,
                    border: `1px solid ${getManagerGroupStyle(group.type).border}`,
                    borderRadius: 14,
                    padding: 10,
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 13 }}>{group.label}</div>
                  {group.managers.map((manager) => (
                    <div key={manager.id} style={{ border: `1px solid ${getManagerGroupStyle(group.type).border}`, borderRadius: 12, padding: 10, background: manager.is_active ? 'rgba(255,255,255,0.78)' : PASTEL.gray }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontWeight: 900, color: COLORS.text, fontSize: 13 }}>
                              {manager.insurance_company} · {manager.name}
                            </span>
                            <span style={{ border: `1px solid ${getManagerGroupStyle(group.type).border}`, borderRadius: 999, padding: '2px 7px', background: getManagerGroupStyle(group.type).chipBg, color: getManagerGroupStyle(group.type).chipColor, fontSize: 10, fontWeight: 800 }}>
                              {getManagerInsuranceTypeLabel(manager)}
                            </span>
                          </div>
                          <div style={{ marginTop: 4, color: COLORS.textGray, fontSize: 11, lineHeight: 1.45 }}>
                            {manager.phone || '전화번호 없음'} · {manager.specialty || '담당영역 미입력'} · {manager.is_active ? '활성' : '비활성'}
                          </div>
                          {manager.memo && <div style={{ marginTop: 4, color: COLORS.textGray, fontSize: 11 }}>메모: {manager.memo}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => openManagerModal(manager)} style={tinyButtonStyle}>수정</button>
                          <button type="button" onClick={() => toggleManagerActive(manager)} style={tinyButtonStyle}>
                            {manager.is_active ? '비활성화' : '재활성화'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: COLORS.text, marginBottom: 8 }}>고객별 설계의뢰 이력</div>
            {requests.length === 0 ? (
              <div style={{ color: COLORS.textGray, fontSize: 13 }}>저장된 설계의뢰 이력이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {requests.map((request) => (
                  <div key={request.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 13 }}>
                          {request.manager_company_snapshot || '보험회사 미입력'} / {request.manager_name_snapshot || '매니저 미입력'}
                        </div>
                        <div style={{ marginTop: 4, color: COLORS.textGray, fontSize: 12 }}>
                          {formatDate(request.created_at)} · {getDesignRequestStatusLabel(request.status)}
                          {request.manager_phone_snapshot ? ` · ${request.manager_phone_snapshot}` : ''}
                          {request.manager_specialty_snapshot ? ` · ${request.manager_specialty_snapshot}` : ''}
                        </div>
                      </div>
                      <AnalysisStatusPill status={getDesignRequestStatusLabel(request.status)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ManagerModal
        visible={managerModalOpen}
        form={managerForm}
        editing={Boolean(editingManager)}
        saving={saving}
        onChange={(key, value) => setManagerForm((prev) => ({ ...prev, [key]: value }))}
        onSave={saveManager}
        onClose={() => setManagerModalOpen(false)}
      />

      <DesignRequestModal
        visible={requestModalOpen}
        managers={activeManagers}
        selectedManager={selectedManager}
        form={requestForm}
        includeSections={includeSections}
        needsInfoConfirm={needsInfoConfirm}
        includesSensitiveInfo={includesSensitiveInfo}
        messagePreview={messagePreview}
        saving={saving}
        onChangeForm={updateRequestForm}
        onChangeInclude={updateIncludeSection}
        onChangeMessage={setMessagePreview}
        onShare={shareRequestMessage}
        onSave={saveSentRequest}
        onClose={() => setRequestModalOpen(false)}
      />
    </Card>
  );
}

function ManagerModal({ visible, form, editing, saving, onChange, onSave, onClose }) {
  return (
    <Modal visible={visible} onClose={onClose} title={editing ? '설계매니저 수정' : '설계매니저 등록'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 12, color: COLORS.textGray, fontSize: 12, lineHeight: 1.55 }}>
          실제 담당자가 바뀐 경우에는 기존 매니저를 비활성화하고 새 매니저로 등록하는 흐름을 권장합니다.
          과거 설계의뢰 이력에는 당시 매니저 정보가 보존됩니다.
        </div>

        <label style={labelStyle}>
          보험회사
          <input
            value={form.insurance_company}
            onChange={(event) => onChange('insurance_company', event.target.value)}
            placeholder="예: DB손해보험"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          이름
          <input
            value={form.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder="매니저 이름"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          전화번호
          <input
            value={form.phone}
            onChange={(event) => onChange('phone', event.target.value)}
            placeholder="선택 입력"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          담당영역
          <input
            value={form.specialty}
            onChange={(event) => onChange('specialty', event.target.value)}
            placeholder="예: 어린이보험, 유병자, 운전자"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          메모
          <textarea
            value={form.memo}
            onChange={(event) => onChange('memo', event.target.value)}
            placeholder="업무 메모"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: COLORS.text, fontSize: 13, fontWeight: 800 }}>
          <input
            type="checkbox"
            checked={form.is_active !== false}
            onChange={(event) => onChange('is_active', event.target.checked)}
          />
          활성 매니저로 사용
        </label>

        <button type="button" onClick={onSave} disabled={saving} style={{ ...primarySmallButtonStyle, width: '100%', justifyContent: 'center', padding: '12px 14px' }}>
          {saving ? '저장 중...' : editing ? '수정 저장' : '매니저 등록'}
        </button>
      </div>
    </Modal>
  );
}

function DesignRequestModal({
  visible,
  managers,
  selectedManager,
  form,
  includeSections,
  needsInfoConfirm,
  includesSensitiveInfo,
  messagePreview,
  saving,
  onChangeForm,
  onChangeInclude,
  onChangeMessage,
  onShare,
  onSave,
  onClose,
}) {
  const useManualManager = !form.manager_id;

  return (
    <Modal visible={visible} onClose={onClose} title="설계 의뢰하기">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 12, color: COLORS.textGray, fontSize: 12, lineHeight: 1.55 }}>
          전송 전 메시지를 직접 확인하고 수정할 수 있습니다. 주민등록번호 전체, 계좌번호, 은행정보, 증권번호는 자동 포함하지 않습니다.
        </div>

        <label style={labelStyle}>
          설계매니저
          <select
            value={form.manager_id}
            onChange={(event) => onChangeForm('manager_id', event.target.value)}
            style={inputStyle}
          >
            <option value="">직접 입력</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.insurance_company} / {manager.name}
              </option>
            ))}
          </select>
        </label>

        {selectedManager ? (
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, fontSize: 12, color: COLORS.textGray }}>
            {selectedManager.phone || '전화번호 없음'} · {selectedManager.specialty || '담당영역 미입력'}
          </div>
        ) : useManualManager ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={labelStyle}>
              보험회사
              <input
                value={form.manual_company}
                onChange={(event) => onChangeForm('manual_company', event.target.value)}
                placeholder="보험회사"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              매니저 이름
              <input
                value={form.manual_manager_name}
                onChange={(event) => onChangeForm('manual_manager_name', event.target.value)}
                placeholder="이름"
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
              매니저 연락처
              <input
                value={form.manual_manager_phone}
                onChange={(event) => onChangeForm('manual_manager_phone', event.target.value)}
                placeholder="선택 입력"
                style={inputStyle}
              />
            </label>
          </div>
        ) : null}

        <div>
          <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 13, marginBottom: 8 }}>포함할 정보</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
            <IncludeCheckbox label="고객명" checked={includeSections.customerName} onChange={(value) => onChangeInclude('customerName', value)} />
            <IncludeCheckbox label="고객명 마스킹" checked={includeSections.maskedName} onChange={(value) => onChangeInclude('maskedName', value)} />
            <IncludeCheckbox label="휴대폰번호" checked={includeSections.phone} onChange={(value) => onChangeInclude('phone', value)} />
            <IncludeCheckbox label="생년월일" checked={includeSections.birth} onChange={(value) => onChangeInclude('birth', value)} />
            <IncludeCheckbox label="나이" checked={includeSections.age} onChange={(value) => onChangeInclude('age', value)} />
            <IncludeCheckbox label="성별" checked={includeSections.gender} onChange={(value) => onChangeInclude('gender', value)} />
            <IncludeCheckbox label="주소" checked={includeSections.address} onChange={(value) => onChangeInclude('address', value)} />
            <IncludeCheckbox label="직업" checked={includeSections.job} onChange={(value) => onChangeInclude('job', value)} />
            <IncludeCheckbox label="병력" checked={includeSections.medical} onChange={(value) => onChangeInclude('medical', value)} />
            <IncludeCheckbox label="알릴의무" checked={includeSections.disclosure} onChange={(value) => onChangeInclude('disclosure', value)} />
            <IncludeCheckbox label="부담보" checked={includeSections.exclusions} onChange={(value) => onChangeInclude('exclusions', value)} />
            <IncludeCheckbox label="현재 주요보장" checked={includeSections.currentCoverage} onChange={(value) => onChangeInclude('currentCoverage', value)} />
            <IncludeCheckbox label="부족보장" checked={includeSections.shortageCoverage} onChange={(value) => onChangeInclude('shortageCoverage', value)} />
          </div>
        </div>

        {needsInfoConfirm && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: COLORS.redBg, borderRadius: 12, padding: 12, color: COLORS.red, fontSize: 12, fontWeight: 800, lineHeight: 1.45 }}>
            <input
              type="checkbox"
              checked={form.consent_checked}
              onChange={(event) => onChangeForm('consent_checked', event.target.checked)}
              style={{ marginTop: 2 }}
            />
            고객 동의 또는 업무상 필요한 전달 범위를 확인했습니다. 개인정보와 민감정보는 전송 전 메시지에서 다시 검토합니다.
            {includesSensitiveInfo ? ' 병력/알릴의무/부담보가 포함되어 있습니다.' : ''}
          </label>
        )}

        <label style={labelStyle}>
          설계사 메모 / 요청 조건
          <textarea
            value={form.request_note}
            onChange={(event) => onChangeForm('request_note', event.target.value)}
            placeholder="예: 20년납 비갱신 위주, 암/뇌/심장 보강안 요청"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </label>

        <label style={labelStyle}>
          전송 전 미리보기
          <textarea
            value={messagePreview}
            onChange={(event) => onChangeMessage(event.target.value)}
            rows={14}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55, fontFamily: 'inherit' }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onShare} disabled={saving || !messagePreview.trim()} style={ghostSmallButtonStyle}>
            공유/복사
          </button>
          <button type="button" onClick={onSave} disabled={saving || !messagePreview.trim()} style={primarySmallButtonStyle}>
            {saving ? '저장 중...' : '의뢰완료로 저장'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function IncludeCheckbox({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '9px 10px', color: COLORS.text, fontSize: 12, fontWeight: 800 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function buildDesignRequestMessage({ customer, consultations, summary, analysisRows, includeSections, requestNote }) {
  const lines = ['[보플랜 설계의뢰]'];
  const customerLines = [];
  const age = calculateAgeFromBirth(customer?.birth);
  const customerName = includeSections.maskedName ? maskCustomerName(customer?.name) : String(customer?.name || '').trim();
  const gender = getCustomerGender(customer);
  const jobDetail = getCustomerJobDetail(customer);

  if (includeSections.customerName && customerName) customerLines.push(`고객명: ${customerName}`);
  if (includeSections.phone && customer?.phone) customerLines.push(`휴대폰번호: ${customer.phone}`);
  if (includeSections.birth && customer?.birth) customerLines.push(`생년월일: ${customer.birth}`);
  if (includeSections.age) customerLines.push(`나이: ${age ? `${age}세` : '확인 필요'}`);
  if (includeSections.gender) customerLines.push(`성별: ${gender || '확인 필요'}`);
  if (includeSections.address && customer?.address) customerLines.push(`주소: ${customer.address}`);
  if (includeSections.job && customer?.job) customerLines.push(`직업: ${customer.job}`);
  if (includeSections.job && jobDetail) customerLines.push(`직업 상세: ${jobDetail}`);

  if (customerLines.length) {
    lines.push('', '고객 기본정보', ...customerLines.map((line) => `- ${line}`));
  }

  if (includeSections.currentCoverage) {
    const coverageLines = (summary || [])
      .slice(0, 10)
      .map((item) => `- ${item.name}: ${formatCoverageAmount(item.totalAmount)} (${item.contractCount || 0}건, ${item.statusLabel || '확인 필요'})`);
    lines.push('', '현재 주요보장', ...(coverageLines.length ? coverageLines : ['- 등록된 현재보장 없음']));
  }

  if (includeSections.shortageCoverage) {
    const shortageLines = (analysisRows || [])
      .filter((row) => row.status === '부족')
      .slice(0, 10)
      .map((row) => `- ${row.name}: 현재 ${formatCoverageAmount(row.currentAmount)} / 기준 ${formatCoverageAmount(row.targetAmount)} / 부족 ${formatCoverageAmount(Math.abs(row.difference || 0))}`);
    lines.push('', '부족보장', ...(shortageLines.length ? shortageLines : ['- 부족으로 표시된 보장 없음']));
  }

  if (includeSections.medical) {
    lines.push('', '병력', ...getMedicalLines(consultations));
  }

  if (includeSections.disclosure) {
    lines.push('', '알릴의무', ...getDisclosureLines(consultations));
  }

  if (includeSections.exclusions) {
    lines.push('', '부담보', ...getExclusionLines(consultations));
  }

  if (includeSections.memo && String(requestNote || '').trim()) {
    lines.push('', '설계 요청 메모', String(requestNote).trim());
  }

  lines.push('', '※ 주민등록번호 전체, 계좌번호, 은행정보, 증권번호는 자동 포함하지 않았습니다.');
  return lines.join('\n');
}

function getMedicalLines(consultations) {
  const items = (consultations || []).flatMap((item) => item.medical_history || []);
  if (!items.length) return ['- 등록된 병력 없음'];

  return items.slice(0, 10).map((item) => {
    const parts = [
      item.disease || item.name || '질병명 미입력',
      item.diagnosed_at || item.diagnosis_date ? `진단: ${item.diagnosed_at || item.diagnosis_date}` : '',
      item.treatment || item.treatment_detail ? `치료: ${item.treatment || item.treatment_detail}` : '',
      item.memo ? `메모: ${item.memo}` : '',
    ].filter(Boolean);
    return `- ${parts.join(' / ')}`;
  });
}

function getDisclosureLines(consultations) {
  const disclosures = (consultations || [])
    .map((item) => item.disclosure_info)
    .filter(Boolean);

  if (!disclosures.length) return ['- 등록된 알릴의무 정보 없음'];

  return disclosures.slice(0, 5).map((info) => {
    const checked = info.checked ? '확인됨' : '미확인';
    const memo = info.memo || info.detail || info.note || '';
    return `- ${checked}${memo ? ` / ${memo}` : ''}`;
  });
}

function getExclusionLines(consultations) {
  const items = (consultations || []).flatMap((item) => item.exclusions || []);
  if (!items.length) return ['- 등록된 부담보 없음'];

  return items.slice(0, 10).map((item) => {
    const parts = [
      item.body_part || item.part || item.disease || '부담보 항목',
      item.period ? `기간: ${item.period}` : '',
      item.result ? `결과: ${item.result}` : '',
      item.memo ? `메모: ${item.memo}` : '',
    ].filter(Boolean);
    return `- ${parts.join(' / ')}`;
  });
}

function getDesignRequestStatusLabel(status) {
  const labels = {
    draft: '작성중',
    sent: '의뢰완료',
    received: '설계수신',
    reviewed: '검토완료',
    canceled: '취소',
  };
  return labels[status] || '의뢰완료';
}

function CriteriaModal({ visible, name, items, saving, onNameChange, onChangeItem, onSave, onClose }) {
  return (
    <Modal visible={visible} onClose={onClose} title="내 분석기준 설정">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={labelStyle}>
          기준 이름
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="내 분석기준"
            style={inputStyle}
          />
        </label>

        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 12, color: COLORS.textGray, fontSize: 12, lineHeight: 1.55 }}>
          목표금액은 설계사가 직접 입력합니다. 합산 가능한 담보만 금액 비교에 사용하며, 별도/확인 필요 담보는 단순 비교하지 않습니다.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '52vh', overflowY: 'auto', paddingRight: 2 }}>
          {items.map((item, index) => {
            const category = item.category || {};
            const comparable = category.aggregation_mode === 'sum';

            return (
              <div key={item.standard_coverage_id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 900, color: COLORS.text }}>
                    <input
                      type="checkbox"
                      checked={item.is_enabled}
                      onChange={(event) => onChangeItem(index, 'is_enabled', event.target.checked)}
                    />
                    {category.name}
                  </label>
                  <span style={{ color: comparable ? COLORS.primary : '#92400E', background: comparable ? COLORS.primaryBg : '#FEF3C7', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 900 }}>
                    {comparable ? '금액 비교' : category.aggregation_mode === 'separate' ? '별도' : '확인 필요'}
                  </span>
                </div>

                <div style={{ color: COLORS.textGray, fontSize: 11, marginTop: 6 }}>
                  {category.group_name || '기타'} · {comparable ? '목표금액을 입력하면 현재보장과 비교합니다.' : '금액 비교 대상이 아닙니다.'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: comparable ? '1fr 92px' : '92px', gap: 8, marginTop: 10 }}>
                  {comparable && (
                    <label style={labelStyle}>
                      목표금액(만원)
                      <input
                        type="number"
                        min="0"
                        value={item.target_amount_manwon}
                        onChange={(event) => onChangeItem(index, 'target_amount_manwon', event.target.value)}
                        placeholder="직접 입력"
                        style={inputStyle}
                      />
                    </label>
                  )}
                  <label style={labelStyle}>
                    표시순서
                    <input
                      type="number"
                      value={item.display_order}
                      onChange={(event) => onChangeItem(index, 'display_order', event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>

                <label style={{ ...labelStyle, marginTop: 8 }}>
                  메모
                  <input
                    value={item.memo}
                    onChange={(event) => onChangeItem(index, 'memo', event.target.value)}
                    placeholder="기준 관련 메모"
                    style={inputStyle}
                  />
                </label>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={onSave} disabled={saving} style={{ ...primarySmallButtonStyle, width: '100%', justifyContent: 'center', padding: '12px 14px' }}>
          {saving ? '저장 중...' : '분석기준 저장'}
        </button>
      </div>
    </Modal>
  );
}

function FilterButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: active ? COLORS.primary : '#fff',
        color: active ? '#fff' : COLORS.textGray,
        boxShadow: active ? '0 7px 16px rgba(124,92,252,0.16)' : `inset 0 0 0 1px ${PASTEL.purpleBorder}`,
        borderRadius: 999,
        padding: '7px 11px',
        fontSize: 12,
        fontWeight: 900,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function MetricText({ label, value }) {
  return (
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'block', color: COLORS.textGray, fontSize: 10, fontWeight: 800 }}>{label}</span>
      <span style={{ display: 'block', color: COLORS.text, fontSize: 12, fontWeight: 900, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </span>
  );
}

function SmallMetric({ label, value }) {
  return (
    <div style={{ background: PASTEL.grayPurple, border: `1px solid ${PASTEL.grayPurpleBorder}`, borderRadius: 10, padding: '8px 9px', minWidth: 0 }}>
      <div style={{ color: COLORS.textGray, fontSize: 10, fontWeight: 800 }}>{label}</div>
      <div style={{ color: COLORS.text, fontSize: 12, fontWeight: 900, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: COLORS.textGray,
  fontSize: 12,
  fontWeight: 800,
};

const inputStyle = {
  border: `1.5px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: '10px 11px',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  color: COLORS.text,
  boxSizing: 'border-box',
  width: '100%',
};

const primarySmallButtonStyle = {
  border: 'none',
  background: COLORS.primary,
  color: '#fff',
  borderRadius: 999,
  padding: '9px 12px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const ghostSmallButtonStyle = {
  border: 'none',
  background: COLORS.primaryBg,
  color: COLORS.primary,
  borderRadius: 999,
  padding: '9px 12px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const tinyButtonStyle = {
  border: 'none',
  background: '#F3F4F6',
  color: COLORS.text,
  borderRadius: 999,
  padding: '6px 9px',
  fontSize: 11,
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
