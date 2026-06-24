import React, { useState } from 'react';
import { COLORS } from '../constants';
import Modal from './Modal';
import customerService from '../services/customerService';

function cleanValue(value = '') {
  return String(value)
    .replace(/^[:：\s]+/, '')
    .trim();
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
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[:：]?\\s*([^\\n]*)`, 'i');
    const match = block.match(regex);
    if (match) return cleanValue(match[1]);
  }
  return '';
}

function parseKakaoCustomers(text) {
  const sections = text
    .split(/\n(?=\s*(어머니|엄마|모|아버지|아빠|부|아이|자녀|태아)\s*\n)/g)
    .join('\n')
    .split(/(?=\n?\s*(어머니|엄마|모|아버지|아빠|부|아이|자녀|태아)\s*\n)/g)
    .filter((v) => v && v.trim().length > 3);

  const blocks = sections.length > 0 ? sections : [text];
  const parsed = [];
  let motherPhone = '';

  blocks.forEach((block) => {
    const firstLine = block.trim().split('\n')[0]?.trim() || '';
    const relation = firstLine.replace(/\s/g, '');

    const name = getField(block, ['★성함', '성함', '이름']);
    const ssn = getField(block, ['★주민번호', '주민번호', '주민등록번호']);
    const job = getField(block, ['★직업', '직업']);
    const address = getField(block, ['★주소', '주소']);
    let phone = getField(block, ['★핸드폰번호', '핸드폰번호', '휴대폰번호', '전화번호', '연락처']);

    if (!name && !phone) return;

    const isMother = /어머니|엄마|모/.test(relation);
    const isChild = /아이|자녀|태아/.test(relation);

    if (isMother && phone) motherPhone = phone;

    if (
      isChild &&
      /엄마|어머니|모/.test(phone.replace(/\s/g, '')) &&
      motherPhone
    ) {
      phone = motherPhone;
    }

    parsed.push({
      checked: true,
      relationLabel: relation || '고객',
      name,
      phone,
      birth: formatBirthFromSsn(ssn),
      job,
      address,
      status: '상담중',
      customer_type: isChild ? '태아' : '일반',
      baby_name: isChild ? name : '',
      relation_type: relation || '',
      memo: '카톡 고객정보 자동등록',
    });
  });

  return parsed;
}

export default function KakaoCustomerImportModal({ visible, onClose, onSave }) {
  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

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
      setRawText('');
      setItems([]);
      onSave?.();
    } catch (e) {
      console.error(e);
      alert(e.message || '고객 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="📋 카톡 고객정보 등록">
      <div style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 10 }}>
        카카오톡으로 받은 고객정보를 그대로 붙여넣어 주세요.
      </div>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={`예)
            
어머니

★성함:
★주민번호:
★직업:
★주소:
★핸드폰번호:

아이

★성함:
★주민번호:
★직업:미취학아동
★주소:
★핸드폰번호:엄마핸드폰번호

아버지

★성함:
★주민번호:
★직업:
★주소:
★핸드폰번호:`}

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