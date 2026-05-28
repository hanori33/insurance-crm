// src/pages/CustomersPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { COLORS, CUSTOMER_FILTERS } from '../constants';
import { Card, LoadingSpinner, FilterChip } from '../components/Common';
import EmptyState from '../components/EmptyState';
import CustomerCard from '../components/CustomerCard';
import CustomerForm from '../components/CustomerForm';
import customerService from '../services/customerService';
import consultationService from '../services/consultationService';

const EXCEL_HEADERS = [
  '이름', '전화번호', '생년월일', '성별', '상태', '고객유형',
  '반려동물명', '태아/자녀명', '주소', '직업', '자동차번호',
  '자동차만기일', '관계', '메모',
];

const CLIENT_SIDE_FILTERS = ['생일', '자동차만기', '태아', '펫'];

function getCarExpiry(c) {
  return c.car_expiry || c.carExpiry || c.car_expiry_date || c.carExpiryDate || c.car_expiry_at || '';
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function isBirthdayToday(c) {
  const raw = String(c.ssn || c.birth || '').trim();
  if (!raw) return false;

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDate = today.getDate();

  const ssnMatch = raw.match(/^(\d{2})(\d{2})(\d{2})/);
  if (ssnMatch) {
    return parseInt(ssnMatch[2], 10) === todayMonth && parseInt(ssnMatch[3], 10) === todayDate;
  }

  const isoMatch = raw.match(/\d{4}[-./](\d{2})[-./](\d{2})/);
  if (isoMatch) {
    return parseInt(isoMatch[1], 10) === todayMonth && parseInt(isoMatch[2], 10) === todayDate;
  }

  return false;
}

function downloadCsvTemplate() {
  const sample = [
    '홍길동', '010-1234-5678', '1990-01-01', '남', '상담중', '일반',
    '', '', '서울시', '직장인', '12가3456', '2026-05-15', '지인', '상담 메모 예시',
  ];

  const csv = '\uFEFF' + EXCEL_HEADERS.join(',') + '\n' + sample.join(',');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = '보플랜_고객업로드_양식.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = text.replace(/\r/g, '').split('\n').map(row => row.trim()).filter(Boolean);
  if (rows.length <= 1) return [];

  return rows.slice(1).map(row => {
    const cols = row.split(',').map(v => v.trim());

    return {
      name: cols[0] || '',
      phone: cols[1] || '',
      birth: cols[2] || '',
      gender: cols[3] || '',
      status: cols[4] || '상담중',
      customer_type: cols[5] || '일반',
      pet_name: cols[6] || '',
      baby_name: cols[7] || '',
      address: cols[8] || '',
      job: cols[9] || '',
      car_number: cols[10] || '',
      car_expiry: cols[11] || '',
      relation_type: cols[12] || '',
      memo: cols[13] || '',
    };
  }).filter(c => c.name || c.phone);
}

export default function CustomersPage({ onNavigate, initialFilter, initialSearch }) {
  const [filter, setFilter] = useState(initialFilter || '전체');
  const [search, setSearch] = useState(initialSearch || '');
  const [customers, setCustomers] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
  }, [initialSearch]);

  const filteredCustomers = customers.filter((c) => {
  const q = search.trim().toLowerCase();

  const customerId = String(c.db_id || c.id || c.app_customer_id || '');

  const relatedConsultations = consultations.filter(item => {
    const itemCustomerId = String(item.customer_id || '');
    const itemCustomerName = String(item.customer_name || '');

    return (
      itemCustomerId === customerId ||
      itemCustomerName === String(c.name || '')
    );
  });

  const medicalText = relatedConsultations
    .flatMap(item => item.medical_history || [])
    .map(item => [
      item.disease,
      item.medication,
      item.memo,
      item.current_treatment,
      item.treatment_period,
    ].filter(Boolean).join(' '))
    .join(' ')
    .toLowerCase();

  const exclusionText = relatedConsultations
    .flatMap(item => item.exclusions || [])
    .map(item => [
      item.body_part,
      item.disease,
      item.insurance_company,
      item.product_name,
      item.memo,
      item.period,
      item.result,
    ].filter(Boolean).join(' '))
    .join(' ')
    .toLowerCase();

  const basicSearchMatch =
    !q ||
    String(c.name || '').toLowerCase().includes(q) ||
    String(c.phone || '').toLowerCase().includes(q) ||
    medicalText.includes(q) ||
    exclusionText.includes(q);

  if (!basicSearchMatch) return false;

  if (filter === '생일') return isBirthdayToday(c);

  if (filter === '자동차만기') {
    const d = daysUntil(getCarExpiry(c));
    return d !== null && d >= 0 && d <= 30;
  }

  if (filter === '태아') return c.customer_type === '태아' || !!c.baby_name;
  if (filter === '펫') return c.customer_type === '펫' || !!c.pet_name;

  return true;
});

 const load = useCallback(async () => {
  setLoading(true);

  try {
    const apiStatus = CLIENT_SIDE_FILTERS.includes(filter) ? '전체' : filter;

    const [customerData, consultationData] = await Promise.all([
      customerService.list({ status: apiStatus, search: '' }),
      consultationService.list(),
    ]);

    setCustomers(customerData || []);
    setConsultations(consultationData || []);
  } catch (e) {
    console.error(e);
    setCustomers([]);
    setConsultations([]);
  } finally {
    setLoading(false);
  }
}, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUploadCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsv(text);

      if (parsed.length === 0) {
        alert('업로드할 고객 데이터가 없습니다.');
        return;
      }

      if (!window.confirm(`${parsed.length}명의 고객을 업로드할까요?`)) return;

      if (customerService.bulkCreate) {
        await customerService.bulkCreate(parsed);
      } else {
        for (const customer of parsed) {
          await customerService.create(customer);
        }
      }

      alert('고객 업로드가 완료되었습니다.');
      load();
    } catch (err) {
      console.error(err);
      alert('업로드 중 오류가 발생했습니다. CSV 양식을 확인해주세요.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: COLORS.bg,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          background: COLORS.white,
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>
          고객 관리
        </span>
        <span style={{ fontSize: 12, color: COLORS.textGray }}>
          {filteredCustomers.length}명
        </span>
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px 0',
          background: COLORS.bg,
        }}
      >
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: COLORS.white,
              borderRadius: 12,
              padding: '10px 14px',
              border: `1.5px solid ${COLORS.border}`,
            }}
          >
            <span style={{ color: COLORS.textGray }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="고객명, 전화번호, 병력/부담보 검색"
              style={{
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: 13,
                flex: 1,
                minWidth: 0,
                color: COLORS.text,
                fontFamily: 'inherit',
              }}
            />
          </div>

          <button
            onClick={() => setShowForm(true)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: 'none',
              background: COLORS.primary,
              color: '#fff',
              fontSize: 24,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={downloadCsvTemplate}
            style={{
              border: `1px solid ${COLORS.border}`,
              background: COLORS.white,
              color: COLORS.text,
              borderRadius: 10,
              padding: '8px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📥 양식 다운로드
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `1px solid ${COLORS.border}`,
              background: COLORS.white,
              color: COLORS.text,
              borderRadius: 10,
              padding: '8px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📤 고객 업로드
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleUploadCsv}
            style={{ display: 'none' }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            paddingBottom: 6,
          }}
        >
          {CUSTOMER_FILTERS.map(f => (
            <FilterChip
              key={f}
              label={f}
              active={filter === f}
              onClick={() => setFilter(f)}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '0 16px calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        {loading && customers.length === 0 ? (
  <LoadingSpinner />
) : filteredCustomers.length === 0 ? (
          <EmptyState
            icon="👥"
            message="고객이 없습니다"
            sub="+ 버튼으로 추가하세요"
            action={() => setShowForm(true)}
            actionLabel="고객 추가"
          />
        ) : (
          <Card style={{ padding: 0, marginTop: 4 }}>
  {filteredCustomers.map((c, i) => (
    <div
      key={c.db_id || c.id || c.app_customer_id || i}
      style={{
        borderBottom:
          i === filteredCustomers.length - 1
            ? 'none'
            : `1px solid ${COLORS.border}`,
      }}
    >
      <CustomerCard
        customer={c}
        isLast={i === filteredCustomers.length - 1}
        onClick={() =>
          onNavigate('customerDetail', {
            id: c.db_id || c.id,
          })
        }
      />

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '0 14px 14px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() =>
            onNavigate('customerDetail', {
              id: c.db_id || c.id,
              tab: 'consultation',
            })
          }
          style={{
            border: 'none',
            background: COLORS.primaryBg,
            color: COLORS.primary,
            borderRadius: 999,
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          🩺 상담기록
        </button>

        <button
          type="button"
          onClick={() =>
            onNavigate('customerDetail', {
              id: c.db_id || c.id,
              tab: 'medical',
            })
          }
          style={{
            border: 'none',
            background: '#FEF3C7',
            color: '#D97706',
            borderRadius: 999,
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          💊 병력
        </button>

        <button
          type="button"
          onClick={() =>
            onNavigate('customerDetail', {
              id: c.db_id || c.id,
              tab: 'exclusion',
            })
          }
          style={{
            border: 'none',
            background: '#FEE2E2',
            color: '#DC2626',
            borderRadius: 999,
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          🚫 부담보
        </button>
      </div>
    </div>
  ))}
</Card>
        )}
      </div>

      <CustomerForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSave={() => {
          load();
          setShowForm(false);
        }}
      />
    </div>
  );
}