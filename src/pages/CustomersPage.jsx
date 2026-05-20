// src/pages/CustomersPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { COLORS, CUSTOMER_FILTERS } from '../constants';
import { Card, LoadingSpinner, FilterChip } from '../components/Common';
import EmptyState from '../components/EmptyState';
import CustomerCard from '../components/CustomerCard';
import CustomerForm from '../components/CustomerForm';
import customerService from '../services/customerService';

const EXCEL_HEADERS = [
  '이름', '전화번호', '생년월일', '성별', '상태', '고객유형',
  '반려동물명', '태아/자녀명', '주소', '직업', '자동차번호',
  '자동차만기일', '관계', '메모',
];

// 클라이언트에서 처리하는 필터 (API status로 넘기면 안 됨)
const CLIENT_SIDE_FILTERS = ['생일', '자동차만기', '태아', '펫'];

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
  const rows = text
    .replace(/\r/g, '')
    .split('\n')
    .map(row => row.trim())
    .filter(Boolean);

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
  const [search, setSearch] = useState(initialSearch || ''); // ✅ initialSearch로 초기화

  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);

  // ✅ 추가
  useEffect(() => {
  if (initialSearch !== undefined) setSearch(initialSearch);
}, [initialSearch]);
  
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef(null);

  const filteredCustomers = customers.filter((c) => {
 if (filter === '생일') {
  if (!c.ssn && !c.birth) return false;

  const today = new Date();
  const todayMonth = today.getMonth() + 1; // 1-indexed
  const todayDate = today.getDate();

  const raw = String(c.ssn || c.birth || '').trim();

  // 주민번호 형식: 850722-XXXXXXX 또는 850722XXXXXXX
  const ssnMatch = raw.match(/^(\d{2})(\d{2})(\d{2})/);
  if (ssnMatch) {
    const month = parseInt(ssnMatch[2], 10);
    const date = parseInt(ssnMatch[3], 10);
    return month === todayMonth && date === todayDate;
  }

  // ISO 날짜 형식: 1989-08-16
  const isoMatch = raw.match(/\d{4}[-./](\d{2})[-./](\d{2})/);
  if (isoMatch) {
    const month = parseInt(isoMatch[1], 10);
    const date = parseInt(isoMatch[2], 10);
    return month === todayMonth && date === todayDate;
  }

  return false;
}
    if (filter === '자동차만기') return !!c.car_expiry;
    if (filter === '태아') return c.customer_type === '태아';
    if (filter === '펫') return c.customer_type === '펫';
    return true;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ 클라이언트 측 필터는 API에 넘기지 않고 전체 조회 후 클라이언트에서 필터링
      const apiStatus = CLIENT_SIDE_FILTERS.includes(filter) ? '전체' : filter;
      const data = await customerService.list({ status: apiStatus, search });
      setCustomers(data || []);
    } catch (e) {
      console.error(e);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

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
<div style={{
  width: '100%'
}}>
      {/* 헤더 */}
      <div style={{
        background: COLORS.white, padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>고객 관리</span>
        {/* ✅ 실제 화면에 표시 중인 고객 수로 변경 */}
        <span style={{ fontSize: 12, color: COLORS.textGray }}>{filteredCustomers.length}명</span>
      </div>

      {/* 검색 + 추가 */}
      <div style={{ padding: '12px 16px 0', background: COLORS.bg, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: COLORS.white, borderRadius: 12, padding: '10px 14px',
            border: `1.5px solid ${COLORS.border}`,
          }}>
            <span style={{ color: COLORS.textGray }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="고객명, 전화번호 검색"
              style={{
                border: 'none', background: 'none', outline: 'none',
                fontSize: 13, flex: 1, color: COLORS.text, fontFamily: 'inherit',
              }}
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none',
              background: COLORS.primary, color: '#fff', fontSize: 24,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}
          >+</button>
        </div>

        {/* 엑셀 버튼 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button
            type="button" onClick={downloadCsvTemplate}
            style={{
              border: `1px solid ${COLORS.border}`, background: COLORS.white,
              color: COLORS.text, borderRadius: 10, padding: '8px 10px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >📥 양식 다운로드</button>
          <button
            type="button" onClick={() => fileInputRef.current?.click()}
            style={{
              border: `1px solid ${COLORS.border}`, background: COLORS.white,
              color: COLORS.text, borderRadius: 10, padding: '8px 10px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >📤 고객 업로드</button>
          <input
            ref={fileInputRef} type="file" accept=".csv"
            onChange={handleUploadCsv} style={{ display: 'none' }}
          />
        </div>

        {/* 필터 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', overflowX: 'visible', paddingBottom: 6 }}>
          {CUSTOMER_FILTERS.map(f => (
            <FilterChip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
          ))}
        </div>
      </div>

      {/* 리스트 */}
      {/* 리스트 */}
<div style={{
  padding: '0 16px 24px'
}}>
        {loading ? (
          <LoadingSpinner />
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            icon="👥" message="고객이 없습니다" sub="+ 버튼으로 추가하세요"
            action={() => setShowForm(true)} actionLabel="고객 추가"
          />
        ) : (
          <Card style={{ padding: 0, marginTop: 4 }}>
            {filteredCustomers.map((c, i) => (
              <CustomerCard
                key={c.id || i}
                customer={c}
                isLast={i === filteredCustomers.length - 1}
                onClick={() => onNavigate('customerDetail', { id: c.db_id || c.id })}
              />
            ))}
          </Card>
        )}
      </div>

      {/* ✅ 추가 */}
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