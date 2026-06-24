// src/pages/CustomersPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { COLORS, CUSTOMER_FILTERS } from '../constants';
import { Card, LoadingSpinner, FilterChip } from '../components/Common';
import EmptyState from '../components/EmptyState';
import CustomerCard from '../components/CustomerCard';
import CustomerForm from '../components/CustomerForm';
import Modal from '../components/Modal';
import customerService from '../services/customerService';
import consultationService from '../services/consultationService';
import { supabase } from '../supabaseClient';
import getFunctionErrorMessage from '../services/functionErrorService';
import KakaoCustomerImportModal from '../components/KakaoCustomerImportModal';
import { formatDueDateWithDDay } from '../utils';

const EXCEL_HEADERS = [
  '이름', '전화번호', '생년월일', '성별', '상태', '고객유형',
  '반려동물명', '태아/자녀명', '주소', '직업', '자동차번호',
  '자동차만기일', '관계', '메모',
];

const CLIENT_SIDE_FILTERS = ['생일', '자동차만기', '태아', '펫'];

function getCarExpiry(c) {
  return c.car_expiry || c.carExpiry || c.car_expiry_date || c.carExpiryDate || c.car_expiry_at || '';
}

function getDueDate(c) {
  return c.due_date || c.dueDate || c.expected_birth_date || c.expectedBirthDate || '';
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

function formatDday(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return '';
  if (d === 0) return 'D-DAY';
  return d > 0 ? `D-${d}` : `D+${Math.abs(d)}`;
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
  const [showKakaoImport, setShowKakaoImport] = useState(false);

  const [showKakaoModal, setShowKakaoModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [kakaoMessage, setKakaoMessage] = useState('');

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

  if (filter === '태아') return (c.customer_type === '태아' || !!c.baby_name) && !!getDueDate(c);
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
  

 function generateMessage(type) {
  const rawName = selectedCustomer?.name || '';
  const name = rawName ? `${rawName} 고객님` : '고객님';

  const templates = {
    first: `안녕하세요 ${name} 😊

처음 인사드립니다.

보험 관련 궁금하신 부분이나
보장 점검이 필요하시면
언제든 편하게 말씀주세요.`,

    review: `안녕하세요 ${name} 😊

기존 가입하신 보험 보장 점검차
연락드렸습니다.

최근 보장 변경사항이나
보험료 절감 가능 여부를
함께 확인해드릴 수 있습니다.

편하실 때 연락 부탁드립니다.`,

    car: `안녕하세요 ${name} 😊

자동차보험 만기가 다가와
안내드리려고 연락드렸습니다.

현재 조건보다 유리한 상품이
있는지 비교 도와드리겠습니다.

편하실 때 연락 부탁드립니다.`,

    birthday: `${name} 생일 진심으로 축하드립니다 🎂

오늘 하루 행복하게 보내시고
늘 건강하시길 바랍니다 😊`,

    claim: `안녕하세요 ${name} 😊

보험금 청구 관련 진행이 완료되어
안내드립니다.

확인 후 궁금하신 점 있으시면
편하게 말씀주세요.`,

    reconnect: `안녕하세요 ${name} 😊

오랜만에 안부 인사드립니다.

최근 보장 변경이나
궁금하신 부분은 없으신지
확인차 연락드렸습니다.

필요하신 내용 있으시면
편하게 말씀주세요.`,
  };

      setKakaoMessage(templates[type] || '');
  }

async function generateAiKakaoMessage() {
  if (!selectedCustomer) return;

  const previousMessage = kakaoMessage;

  try {
    setKakaoMessage('AI가 고객 맞춤 멘트를 생성중입니다... ✨');

    const { data, error } = await supabase.functions.invoke(
      'boplan-kakao-message',
      {
        body: {
          customerName: selectedCustomer.name,
          status: '보험 점검 및 안부 연락',
          recentConsultation:
  consultations
    .filter(item =>
      String(item.customer_id || '') === String(selectedCustomer.db_id || selectedCustomer.id || '') ||
      String(item.customer_name || '') === String(selectedCustomer.name || '')
    )
    .sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0))
    .slice(0, 1)
    .map(item =>
      [
        item.content,
        item.memo,
        item.summary,
        item.next_action,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n'),
        },
      }
    );

    if (error) throw error;

    setKakaoMessage(data?.message || '');
  } catch (err) {
    console.error(err);
    setKakaoMessage(previousMessage);
    alert(await getFunctionErrorMessage(err));
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
            type="button"
            onClick={() => setShowKakaoImport(true)}
            style={{
              height: 44,
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.white,
              color: COLORS.primary,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              padding: '0 12px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            📋 카톡
          </button>

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

      {(c.customer_type === '태아' || c.baby_name) && getDueDate(c) && (
        <div
          style={{
            padding: '0 14px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
         <span
  style={{
    background: '#FFF7ED',
    color: '#EA580C',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 900,
  }}
>
  👶 {c.baby_name || c.name || '태아'}
</span>

<span style={{ fontSize: 11, color: COLORS.textGray }}>
  출산예정일 {formatDueDateWithDDay(getDueDate(c)).split(' · ')[0]}
</span>

<span
  style={{
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: 900,
  }}
>
  {formatDueDateWithDDay(getDueDate(c)).split(' · ')[1] || ''}
</span>
        </div>
      )}

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

        <div style={{ width: '100%', marginTop: 6 }}>
          <button
            type="button"
           onClick={() => {
  setSelectedCustomer(c);
  setShowKakaoModal(true);
}}
            style={{
              width: '100%',
              border: `1px solid ${COLORS.primary}`,
              background: '#F8F5FF',
              color: COLORS.primary,
              borderRadius: 12,
              padding: '10px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            💬 AI 카톡 멘트 만들기
          </button>
        </div>
      </div>
    </div>
  ))}
</Card>
        )}
      </div>

<Modal
  visible={showKakaoModal}
  onClose={() => setShowKakaoModal(false)}
  title="💬 AI 카톡 멘트"
>
  {selectedCustomer && (
  <div
    style={{
      marginBottom: 12,
      padding: 12,
      background: '#F8F5FF',
      borderRadius: 12,
      border: `1px solid ${COLORS.border}`,
      fontWeight: 700,
    }}
  >
    👤 고객 : {selectedCustomer.name}
  </div>
)}
  <div
    style={{
      display: 'grid',
      gap: 10,
    }}
  >
    <button
      onClick={() => generateMessage('first')}
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      👋 첫 인사
    </button>

    <button
      onClick={() => generateMessage('review')}
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      📋 보험 점검
    </button>

    <button
      onClick={() => generateMessage('car')}
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      🚗 자동차 만기
    </button>

    <button
      onClick={() => generateMessage('birthday')}
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      🎂 생일 축하
    </button>

    <button
      onClick={() => generateMessage('claim')}
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      📄 청구 완료
    </button>

    <button
      onClick={() => generateMessage('reconnect')}
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      📞 오랜만에 연락
    </button>
    <button
  onClick={generateAiKakaoMessage}
  style={{
    padding: 12,
    borderRadius: 12,
    border: 'none',
    background: '#FEE500',
    color: '#191919',
    fontWeight: 700,
    cursor: 'pointer',
  }}
>
  ✨ AI 맞춤 생성
</button>

    {kakaoMessage && (
  <>
    <div
      style={{
        marginTop: 8,
        marginBottom: 8,
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      📄 생성된 멘트
    </div>

      <textarea
  value={kakaoMessage}
  onChange={(e) => setKakaoMessage(e.target.value)}
      style={{
        width: '100%',
        minHeight: 180,
        marginTop: 16,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        padding: 12,
        fontSize: 13,
        resize: 'none',
        boxSizing: 'border-box',
      }}
    />

    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(kakaoMessage);
        alert('카톡 멘트가 복사되었습니다 😊');
      }}
      style={{
        width: '100%',
        marginTop: 10,
        padding: '12px',
        border: 'none',
        borderRadius: 12,
        background: COLORS.primary,
        color: '#fff',
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      📋 복사하기
    </button>

<button
  type="button"
  onClick={async () => {
    if (kakaoMessage?.trim()) {
      await navigator.clipboard.writeText(kakaoMessage);
    }

    window.location.href = 'kakaotalk://';

    setTimeout(() => {
      alert('카톡 멘트가 복사되었습니다 😊\n카카오톡이 열리지 않으면 직접 카톡을 실행해주세요.');
    }, 300);
  }}
  style={{
    width: '100%',
    marginTop: 10,
    padding: '12px',
    border: 'none',
    borderRadius: 12,
    background: '#FEE500',
    color: '#191919',
    fontWeight: 800,
    cursor: 'pointer',
  }}
>
  💛 카카오톡 열기
</button>

    <button
  type="button"
  onClick={async () => {
    if (!selectedCustomer || !kakaoMessage.trim()) return;

    try {
      await consultationService.create({
        customer_id: selectedCustomer.db_id || selectedCustomer.id,
        customer_name: selectedCustomer.name,
        content: kakaoMessage,
        category: 'AI 카톡',
        memo: 'AI 카톡 멘트 생성',
      });

      alert('상담기록에 저장되었습니다 😊');
      load();
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
  }}
  style={{
    width: '100%',
    marginTop: 10,
    padding: '12px',
    border: 'none',
    borderRadius: 12,
    background: '#10B981',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  }}
>
  💾 상담기록에 저장
</button>
  </>
)}
  </div>
</Modal>

      <CustomerForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSave={() => {
          load();
          setShowForm(false);
        }}
      />

      <KakaoCustomerImportModal
  visible={showKakaoImport}
  onClose={() => setShowKakaoImport(false)}
  onSave={() => {
    load();
    setShowKakaoImport(false);
  }}
/>
    </div>
  );
}
