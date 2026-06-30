import React, { useState } from 'react';
import { COLORS } from '../constants';
import Modal from './Modal';
import customerService from '../services/customerService';
import { formatPhoneNumber } from '../utils';

const RELATION_NAMES = ['어머니', '엄마', '모친', '아버지', '아빠', '부친', '아이', '자녀', '태아'];
const MOTHER_RELATIONS = ['어머니', '엄마', '모친'];
const CHILD_RELATIONS = ['아이', '자녀', '태아'];

const TEMPLATE_TEXT = `어머니

★성함:
★주민번호:
★직업:
★주소:
★핸드폰번호:

아이

★성함:
★주민번호:
★직업 : 미취학아동
★주소:
★핸드폰번호 : 엄마핸드폰번호

아버지

★성함:
★주민번호:
★직업:
★주소:
★핸드폰번호:`;

function cleanValue(value = '') {
  return String(value).replace(/^[:：\s]+/, '').trim();
}

function normalizeLine(line = '') {
  return String(line).replace(/\r/g, '').trim();
}

function normalizeRelation(line = '') {
  const text = normalizeLine(line).replace(/\s/g, '');
  return RELATION_NAMES.includes(text) ? text : '';
}

function isFieldLine(line = '') {
  return /^★?\s*(성함|이름|주민번호|주민등록번호|직업|주소|핸드폰번호|휴대폰번호|전화번호|연락처)\s*[:：]/.test(normalizeLine(line));
}

function hasCompletedContactBlock(lines = []) {
  const text = lines.join('\n');
  const hasName = /(?:^|\n)★?\s*(성함|이름)\s*[:：]\s*\S+/m.test(text);
  const hasIdentifier = /(?:^|\n)★?\s*(주민번호|주민등록번호|핸드폰번호|휴대폰번호|전화번호|연락처)\s*[:：]\s*\S+/m.test(text);

  return hasName && hasIdentifier;
}

function formatBirthFromSsn(value = '') {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 6) return '';

  const yy = Number(digits.slice(0, 2));
  const mm = digits.slice(2, 4);
  const dd = digits.slice(4, 6);
  const genderCode = digits[6];

  let century = yy >= 30 ? '19' : '20';
  if (genderCode === '1' || genderCode === '2') century = '19';
  if (genderCode === '3' || genderCode === '4') century = '20';

  return `${century}${String(yy).padStart(2, '0')}-${mm}-${dd}`;
}

function getField(block, labels) {
  const lines = String(block || '').split('\n');

  for (const line of lines) {
    const normalized = normalizeLine(line).replace(/^★\s*/, '');

    for (const label of labels) {
      const regex = new RegExp(`^${label}\\s*[:：]\\s*(.*)$`, 'i');
      const match = normalized.match(regex);
      if (match) return cleanValue(match[1]);
    }
  }

  return '';
}

function looksLikePhone(line = '') {
  const digits = String(line).replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(digits);
}

function looksLikeSsn(line = '') {
  const compact = String(line).replace(/\s/g, '');
  return /^\d{6}(-?\d(\*{0,6})?)?$/.test(compact);
}

function looksLikeAddress(line = '') {
  const text = normalizeLine(line);
  return /(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주|시|군|구|읍|면|동|로|길|아파트|빌라|오피스텔)/.test(text);
}

function parseFreeBlock(block) {
  const result = {
    name: '',
    ssn: '',
    job: '',
    address: '',
    phone: '',
  };

  const lines = String(block || '')
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line) => !normalizeRelation(line));

  for (const line of lines) {
    if (!result.phone && looksLikePhone(line)) {
      result.phone = line;
      continue;
    }

    if (!result.ssn && looksLikeSsn(line)) {
      result.ssn = line;
      continue;
    }

    if (!result.address && looksLikeAddress(line)) {
      result.address = line;
      continue;
    }

    if (!result.name) {
      result.name = line;
      continue;
    }

    if (!result.job) {
      result.job = line;
    }
  }

  return result;
}

function splitKakaoBlocks(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let current = [];

  function flush() {
    const block = current.join('\n').trim();
    if (block) blocks.push(block);
    current = [];
  }

  lines.forEach((line) => {
    const trimmed = normalizeLine(line);
    const relation = normalizeRelation(trimmed);

    if (relation) {
      flush();
      current.push(relation);
      return;
    }

    if (!trimmed) {
      const usefulLines = current.map(normalizeLine).filter(Boolean);
      const hasField = usefulLines.some(isFieldLine);
      const hasOnlyRelation = usefulLines.length === 1 && normalizeRelation(usefulLines[0]);

      if (usefulLines.length >= 2 && (!hasField || hasCompletedContactBlock(usefulLines)) && !hasOnlyRelation) {
        flush();
      } else if (current.length) {
        current.push('');
      }
      return;
    }

    current.push(line);
  });

  flush();
  return blocks;
}

export function parseKakaoCustomers(text) {
  const blocks = splitKakaoBlocks(text);
  const parsed = [];
  let motherPhone = '';

  blocks.forEach((block) => {
    const firstLine = block.trim().split('\n')[0] || '';
    const relation = normalizeRelation(firstLine) || '고객';
    const freeValues = parseFreeBlock(block);

    const name = getField(block, ['성함', '이름']) || freeValues.name;
    const ssn = getField(block, ['주민번호', '주민등록번호']) || freeValues.ssn;
    const job = getField(block, ['직업']) || freeValues.job;
    const address = getField(block, ['주소']) || freeValues.address;
    let phone = getField(block, ['핸드폰번호', '휴대폰번호', '전화번호', '연락처']) || freeValues.phone;

    if (!name && !phone) return;

    const isMother = MOTHER_RELATIONS.includes(relation);
    const isChild = CHILD_RELATIONS.includes(relation);
    const phoneText = String(phone || '').replace(/\s/g, '');

    if (isMother && looksLikePhone(phone)) {
      motherPhone = phone;
    }

    if (isChild && /엄마|어머니|모친/.test(phoneText) && motherPhone) {
      phone = motherPhone;
    }

    parsed.push({
      checked: true,
      relationLabel: relation,
      name,
      phone: formatPhoneNumber(phone),
      birth: formatBirthFromSsn(ssn),
      job,
      address,
      status: '상담중',
      customer_type: isChild ? '태아' : '일반',
      baby_name: isChild ? name : '',
      relation_type: relation === '고객' ? '' : relation,
      memo: '카톡 고객정보 자동등록',
    });
  });

  return parsed;
}

export default function KakaoCustomerImportModal({ visible, onClose, onSave }) {
  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  function resetModal() {
    setRawText('');
    setItems([]);
    setLoading(false);
  }

  function handleClose() {
    resetModal();
    onClose?.();
  }

  async function handleCopyTemplate() {
    try {
      await navigator.clipboard.writeText(TEMPLATE_TEXT);
      alert('고객정보 양식이 복사되었습니다.');
    } catch (e) {
      console.error(e);
      alert('클립보드 복사에 실패했습니다. 다시 시도해주세요.');
    }
  }

  function handleAnalyze() {
    const result = parseKakaoCustomers(rawText);

    if (result.length === 0) {
      alert('분석된 고객정보가 없습니다.');
      return;
    }

    setItems(result);
  }

  function toggleItem(index) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  }

  async function handleSave() {
    const selected = items.filter((item) => item.checked);

    if (selected.length === 0) {
      alert('등록할 고객을 선택해주세요.');
      return;
    }

    setLoading(true);

    try {
      for (const item of selected) {
        const { checked, relationLabel, ...customer } = item;
        await customerService.create(customer);
      }

      alert(`${selected.length}명 고객 등록이 완료되었습니다.`);
      resetModal();
      onSave?.();
    } catch (e) {
      console.error(e);
      alert(e.message || '고객 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} onClose={handleClose} title="📋 카톡 고객정보 등록">
      <div style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 10 }}>
        카카오톡으로 받은 고객정보를 그대로 붙여넣어 주세요.
      </div>

      <button
        type="button"
        onClick={handleCopyTemplate}
        style={{
          width: '100%',
          marginBottom: 10,
          padding: '10px 0',
          borderRadius: 12,
          border: `1px solid ${COLORS.border}`,
          background: '#fff',
          color: COLORS.text,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        📋 양식 복사
      </button>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={`예)

박하늘
890629
설계사
경기도 시흥시 배곧4로
01023232229

또는

${TEMPLATE_TEXT}`}
        rows={10}
        style={{
          width: '100%',
          border: `1.5px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 12,
          fontSize: 13,
          boxSizing: 'border-box',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />

      <button
        type="button"
        onClick={handleAnalyze}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '12px 0',
          borderRadius: 12,
          border: 'none',
          background: COLORS.primary,
          color: '#fff',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        분석하기
      </button>

      {items.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>
            총 {items.length}명 발견
          </div>

          {items.map((item, index) => (
            <label
              key={`${item.name}-${index}`}
              style={{
                display: 'block',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleItem(index)}
                />
                <strong>
                  {item.relationLabel} · {item.name || '-'}
                </strong>
              </div>

              <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 6, lineHeight: 1.6 }}>
                생년월일: {item.birth || '-'}<br />
                직업: {item.job || '-'}<br />
                주소: {item.address || '-'}<br />
                연락처: {item.phone || '-'}
              </div>
            </label>
          ))}

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '13px 0',
              borderRadius: 12,
              border: 'none',
              background: '#10B981',
              color: '#fff',
              fontWeight: 900,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '등록 중...' : '선택 고객 등록'}
          </button>
        </div>
      )}
    </Modal>
  );
}
