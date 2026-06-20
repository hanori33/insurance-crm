// src/pages/CustomerDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS, CUSTOMER_STATUSES } from '../constants';
import { Card, Avatar, StatusBadge, Divider, LoadingSpinner } from '../components/Common';
import Modal from '../components/Modal';
import Field from '../components/Field';
import customerService from '../services/customerService';
import consultationService from '../services/consultationService';
import policyFileService from '../services/policyFileService';
import { formatDate } from '../utils';
import scheduleService from '../services/scheduleService';
import { supabase } from '../supabaseClient';
import getFunctionErrorMessage from '../services/functionErrorService';

const RELATION_OPTIONS = ['가족', '지인', '친구', '동료', '고객', '고객소개', '기타'];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function formatDueDateWithDDay(dueDate, now = new Date()) {
  const dateText = String(dueDate || '').trim();
  const match = dateText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (!match) return dateText;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dueDay = Date.UTC(year, month - 1, day);
  const parsedDueDate = new Date(dueDay);

  if (
    parsedDueDate.getUTCFullYear() !== year ||
    parsedDueDate.getUTCMonth() !== month - 1 ||
    parsedDueDate.getUTCDate() !== day
  ) {
    return dateText;
  }

  const nowInKorea = new Date(now.getTime() + KST_OFFSET_MS);
  const todayInKorea = Date.UTC(
    nowInKorea.getUTCFullYear(),
    nowInKorea.getUTCMonth(),
    nowInKorea.getUTCDate()
  );
  const daysLeft = Math.round((dueDay - todayInKorea) / DAY_IN_MS);
  const dDay = daysLeft === 0 ? 'D-DAY' : daysLeft > 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`;

  return `${dateText} · ${dDay}`;
}

function InfoRow({ label, value, isLast }) {
  if (!value || value === 'EMPTY' || value === '') return null;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0' }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, flexShrink: 0, width: 90 }}>{label}</span>
        <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 500, textAlign: 'right', flex: 1 }}>{value}</span>
      </div>
      {!isLast && <Divider />}
    </>
  );
}

function Section({ title, icon, action, children }) {
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{title}</span>
        </div>

        {action}
      </div>

      {children}
    </Card>
  );
}

function PolicyCard({ policy, onDelete }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 14,
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: COLORS.text }}>
            {policy.company || '보험사 미입력'}
          </div>
          <div style={{ fontSize: 13, color: COLORS.text, marginTop: 4 }}>
            {policy.product || '상품명 미입력'}
          </div>
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            style={{
              border: 'none',
              background: '#FEE2E2',
              color: '#DC2626',
              borderRadius: 999,
              padding: '5px 9px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              height: 28,
            }}
          >
            삭제
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        {policy.premium && (
          <span style={{ background: COLORS.primaryBg, color: COLORS.primary, borderRadius: 999, padding: '4px 9px', fontSize: 11, fontWeight: 700 }}>
            월 {policy.premium}
          </span>
        )}

        {policy.start_date && (
          <span style={{ background: '#F3F4F6', color: COLORS.textGray, borderRadius: 999, padding: '4px 9px', fontSize: 11, fontWeight: 700 }}>
            계약일 {policy.start_date}
          </span>
        )}
      </div>

      {policy.note && (
        <div style={{ marginTop: 10, fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
          📝 {policy.note}
        </div>
      )}
    </div>
  );
}

function EditModal({ visible, onClose, customer, onSave }) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [referrerSearch, setReferrerSearch] = useState('');
  const [selectedReferrerName, setSelectedReferrerName] = useState('');
  const [referrerOptions, setReferrerOptions] = useState([]);
  const [newPolicy, setNewPolicy] = useState({
    company: '',
    product: '',
    premium: '',
    start_date: '',
    note: '',
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!customer) return;    


    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      status: customer.status || '상담중',
      birth: customer.birth || '',
      email: customer.email || '',
      memo: customer.memo || '',
      job: customer.job || '',
      address: customer.address || '',
      customer_type: customer.customer_type || '일반',
      pet_name: customer.pet_name || '',
      baby_name: customer.baby_name || '',
      due_date: customer.due_date || '',
      transfer_day: customer.transfer_day || '',
      car_number: customer.car_number || '',
      car_expiry: customer.car_expiry || '',
      relation_type: customer.relation_type || '',
      referrer_app_id: customer.referrer_app_id || '',
      referrer_name: customer.referrer_name || '',
      policies: Array.isArray(customer.policies) ? customer.policies : [],
    });

    setNewPolicy({
      company: '',
      product: '',
      premium: '',
      start_date: '',
      note: '',
    });
  }, [customer, visible]);

  useEffect(() => {
    async function loadReferrers() {
      try {
        const data = await customerService.list({ status: '전체', search: '' });
        const currentId = customer?.app_customer_id || customer?.id || customer?.db_id;

        const filtered = (data || []).filter((c) => {
          return String(c.app_customer_id || c.id || c.db_id) !== String(currentId);
        });

        setReferrerOptions(filtered);

        const savedReferrerId = customer?.referrer_app_id || '';

        if (!savedReferrerId) {
          setSelectedReferrerName('');
          setReferrerSearch('');
          return;
        }

        const found = (data || []).find((c) => {
          return String(c.app_customer_id || c.id || c.db_id) === String(savedReferrerId);
        });

        if (found) {
          setSelectedReferrerName(found.name || '');
          setReferrerSearch(found.name || '');
        } else {
          setSelectedReferrerName('');
          setReferrerSearch('');
        }
      } catch (e) {
        console.error(e);
        setReferrerOptions([]);
      }
    }

    if (visible && customer) {
      loadReferrers();
    }
  }, [visible, customer]);

  function addPolicy() {
    if (!newPolicy.company.trim() && !newPolicy.product.trim()) {
      alert('보험사 또는 상품명을 입력해주세요.');
      return;
    }

    set('policies', [
      ...(form.policies || []),
      {
        id: Date.now(),
        company: newPolicy.company.trim(),
        product: newPolicy.product.trim(),
        premium: newPolicy.premium.trim(),
        start_date: newPolicy.start_date.trim(),
        note: newPolicy.note.trim(),
      },
    ]);

    setNewPolicy({
      company: '',
      product: '',
      premium: '',
      start_date: '',
      note: '',
    });
  }

  async function handleSave() {
    setLoading(true);

    try {
      console.log(form);
      await customerService.update(customer.db_id || customer.id, form);
      onSave();
      onClose();
    } catch (e) {
      console.error(e);
      alert(e.message || '저장 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="고객 정보 수정">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray }}>이름</span>
        <Field icon="👤" placeholder="이름" value={form.name || ''} onChange={(e) => set('name', e.target.value)} />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>전화번호</span>
        <Field icon="📞" placeholder="전화번호" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} type="tel" />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>상태</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {CUSTOMER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set('status', s)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                background: form.status === s ? COLORS.primary : COLORS.primaryBg,
                color: form.status === s ? '#fff' : COLORS.primary,
                fontWeight: form.status === s ? 700 : 400,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 13, color: COLORS.textGray }}>생년월일</span>
        <Field icon="🎂" placeholder="생년월일" value={form.birth || ''} onChange={(e) => set('birth', e.target.value)} />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>이메일</span>
        <Field icon="✉️" placeholder="이메일" value={form.email || ''} onChange={(e) => set('email', e.target.value)} type="email" />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>직업</span>
        <Field icon="💼" placeholder="직업" value={form.job || ''} onChange={(e) => set('job', e.target.value)} />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>주소</span>
        <Field icon="📍" placeholder="주소" value={form.address || ''} onChange={(e) => set('address', e.target.value)} />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>고객 유형</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {['일반', '가족', '펫', '태아'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => set('customer_type', type)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                background: form.customer_type === type ? COLORS.primary : COLORS.primaryBg,
                color: form.customer_type === type ? '#fff' : COLORS.primary,
                fontWeight: form.customer_type === type ? 700 : 400,
              }}
            >
              {type === '가족' ? '👨‍👩‍👧 가족' : type === '펫' ? '🐶 펫' : type === '태아' ? '👶 태아' : '일반'}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 13, color: COLORS.textGray }}>관계</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {RELATION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => set('relation_type', option)}
              style={{
                padding: '7px 12px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                background: form.relation_type === option ? COLORS.primary : COLORS.primaryBg,
                color: form.relation_type === option ? '#fff' : COLORS.primary,
                fontWeight: form.relation_type === option ? 800 : 600,
              }}
            >
              {option}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 13, color: COLORS.textGray }}>누구 소개인가요?</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#FAFAFA',
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 8,
          }}
        >
          <span>🔍</span>
          <input
            value={referrerSearch}
            onChange={(e) => setReferrerSearch(e.target.value)}
            placeholder="소개자 고객명 검색"
            style={{
              border: 'none',
              background: 'none',
              outline: 'none',
              flex: 1,
              fontSize: 13,
              color: COLORS.text,
              fontFamily: 'inherit',
            }}
          />
        </div>

        {form.referrer_app_id && (
          <div
            style={{
              marginBottom: 8,
              fontSize: 12,
              color: COLORS.primary,
              fontWeight: 700,
            }}
          >
            👥 최초 소개자 : {form.referrer_name || selectedReferrerName || '-'}

            <button
              type="button"
              onClick={() => {
  set('referrer_app_id', '');
  set('referrer_name', '');
  setReferrerSearch('');
  setSelectedReferrerName('');
}}
              style={{
                marginLeft: 8,
                border: 'none',
                background: '#FEE2E2',
                color: '#DC2626',
                borderRadius: 999,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              해제
            </button>
          </div>
        )}

        {referrerSearch.trim() && (
          <div
            style={{
              marginBottom: 10,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              overflow: 'hidden',
              background: '#fff',
              maxHeight: 180,
              overflowY: 'auto',
            }}
          >
            {referrerOptions
              .filter((c) => c.name?.includes(referrerSearch.trim()) || c.phone?.includes(referrerSearch.trim()))
              .slice(0, 10)
              .map((c) => (
                <button
                  key={c.app_customer_id || c.id}
                  type="button"
                  onClick={() => {
  set('referrer_app_id', c.app_customer_id || c.id);
  set('referrer_name', c.name || '');
  setSelectedReferrerName(c.name || '');
  setReferrerSearch('');
}}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: '#fff',
                    padding: '10px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.text }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textGray, marginTop: 2 }}>{c.phone || '-'}</div>
                </button>
              ))}
          </div>
        )}

        <span style={{ fontSize: 13, color: COLORS.textGray }}>메모</span>
        <textarea
          value={form.memo || ''}
          onChange={(e) => set('memo', e.target.value)}
          rows={3}
          placeholder="메모"
          style={{
            width: '100%',
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 14,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            color: COLORS.text,
            background: '#FAFAFA',
            fontFamily: 'inherit',
            marginBottom: 10,
          }}
        />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>차량번호</span>
        <Field icon="🚗" placeholder="차량번호" value={form.car_number || ''} onChange={(e) => set('car_number', e.target.value)} />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>자동차 만기일</span>
        <Field icon="📅" placeholder="자동차 만기일 (예: 2026-05-15)" value={form.car_expiry || ''} onChange={(e) => set('car_expiry', e.target.value)} />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>반려동물명</span>
        <Field icon="🐶" placeholder="반려동물명" value={form.pet_name || ''} onChange={(e) => set('pet_name', e.target.value)} />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>태아/자녀명</span>
        <Field icon="👶" placeholder="태아/자녀명" value={form.baby_name || ''} onChange={(e) => set('baby_name', e.target.value)} />

        <span style={{ fontSize: 13, color: COLORS.textGray }}>출산예정일</span>
        <Field icon="🍼" placeholder="출산예정일 (예: 2026-08-15)" value={form.due_date || ''} onChange={(e) => set('due_date', e.target.value)} />

        <span style={{ fontSize: 13, color: COLORS.textGray, marginTop: 8 }}>보험 이력</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          {(form.policies || []).map((policy, idx) => (
            <PolicyCard
              key={policy.id || idx}
              policy={policy}
              onDelete={() => {
                set('policies', (form.policies || []).filter((_, i) => i !== idx));
              }}
            />
          ))}

          <div
            style={{
              border: `1px dashed ${COLORS.border}`,
              borderRadius: 14,
              padding: 12,
              background: '#fff',
            }}
          >
            <Field icon="🏢" placeholder="보험사" value={newPolicy.company} onChange={(e) => setNewPolicy((p) => ({ ...p, company: e.target.value }))} />
            <Field icon="📄" placeholder="상품명" value={newPolicy.product} onChange={(e) => setNewPolicy((p) => ({ ...p, product: e.target.value }))} />
            <Field icon="💰" placeholder="보험료" value={newPolicy.premium} onChange={(e) => setNewPolicy((p) => ({ ...p, premium: e.target.value }))} />
            <Field icon="📅" placeholder="계약일" value={newPolicy.start_date} onChange={(e) => setNewPolicy((p) => ({ ...p, start_date: e.target.value }))} />

            <textarea
              value={newPolicy.note}
              onChange={(e) => setNewPolicy((p) => ({ ...p, note: e.target.value }))}
              placeholder="보험 이력 메모"
              rows={2}
              style={{
                width: '100%',
                border: `1.5px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 13,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                marginTop: 6,
                fontFamily: 'inherit',
              }}
            />

            <button
              type="button"
              onClick={addPolicy}
              style={{
                width: '100%',
                marginTop: 10,
                border: 'none',
                background: COLORS.primary,
                color: '#fff',
                borderRadius: 12,
                padding: '10px 0',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + 보험 추가
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 12,
          border: 'none',
          background: COLORS.primary,
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        {loading ? '저장 중...' : '저장'}
      </button>
    </Modal>
  );
}

export default function CustomerDetailPage({
  customerId,
  initialTab,
  onBack,
  onNavigate,
}) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [selectedRiskModal, setSelectedRiskModal] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [consultLoading, setConsultLoading] = useState(false);
  const [customerSchedules, setCustomerSchedules] = useState([]);
  const [policyFiles, setPolicyFiles] = useState([]);
  const [policyFileUploading, setPolicyFileUploading] = useState(false);
  const [policyAnalyzing, setPolicyAnalyzing] = useState(false);
  const [showPolicyAnalysisModal, setShowPolicyAnalysisModal] = useState(false);
  const [policyAnalysisResult, setPolicyAnalysisResult] = useState(null);
  const [activeQuickTab, setActiveQuickTab] = useState(initialTab || '');
  
useEffect(() => {
  setActiveQuickTab(initialTab || '');
}, [initialTab, customerId]);

  useEffect(() => {
    load();
  }, [customerId]);

  useEffect(() => {
  if (!activeQuickTab || loading) return;

  const timer = setTimeout(() => {
    const el = document.getElementById(`quick-section-${activeQuickTab}`);

    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, 300);

  return () => clearTimeout(timer);
}, [activeQuickTab, loading, consultations]);

  async function load() {
    setLoading(true);

    try {
      const data = await customerService.get(customerId);

      let referrerName = '';

      if (data?.referrer_app_id) {
        try {
          const list = await customerService.list({ status: '전체', search: '' });
          const found = (list || []).find((c) => {
            return String(c.app_customer_id || c.id || c.db_id) === String(data.referrer_app_id);
          });

          referrerName = found?.name || '';
        } catch (e) {
          console.error('소개자 조회 실패:', e);
        }
      }

      setCustomer({
        ...data,
        referrer_name_display: referrerName,
      });

      const realId = data?.db_id || data?.app_customer_id || data?.id;

      if (realId) {
        setConsultLoading(true);

        try {
          
const consultationData = await consultationService.listByCustomer(realId);
setConsultations(consultationData || []);

const scheduleData = await scheduleService.listByCustomer(data.name);
setCustomerSchedules(scheduleData || []);

const policyFileData = await policyFileService.listByCustomer(realId);
setPolicyFiles(policyFileData || []);
        
        } catch (consultError) {
          console.error(consultError);
          setConsultations([]);
          setPolicyFiles([]);
        } finally {
          setConsultLoading(false);
        }
      } else {
        setConsultations([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('고객을 삭제하시겠습니까?')) return;

    try {
      await customerService.remove(customer.db_id || customer.id);
      alert('고객이 삭제되었습니다.');
      onBack();
    } catch (e) {
      console.error(e);
      alert(e?.message || JSON.stringify(e) || '고객 삭제 실패');
    }
  }

  async function handlePolicyFileUpload(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    setPolicyFileUploading(true);

    const realId =
      customer?.db_id ||
      customer?.app_customer_id ||
      customer?.id;

    await policyFileService.upload(realId, file);

    const files =
      await policyFileService.listByCustomer(realId);

    setPolicyFiles(files);

    alert('증권이 등록되었습니다 😊');
  } catch (e) {
    console.error(e);
    alert('증권 등록 실패: ' + (e.message || JSON.stringify(e)));
  } finally {
    setPolicyFileUploading(false);
    event.target.value = '';
  }
}
async function handlePolicyAnalysis(file) {
  try {
    setPolicyAnalyzing(true);

    const signedUrl = await policyFileService.getSignedUrl(file.file_url);

    const { data, error } = await supabase.functions.invoke(
      'boplan-policy-analysis',
      {
        body: {
          customer_name: customer?.name || '',
          file_name: file.file_name || '',
          file_url: signedUrl,
        },
      }
    );

    if (error) throw error;

    const savedFile = await policyFileService.saveAnalysis(file.id, data);

    setPolicyFiles((prev) =>
      prev.map((item) =>
        item.id === file.id ? savedFile : item
      )
    );

    setPolicyAnalysisResult(data);
    setShowPolicyAnalysisModal(true);
  } catch (e) {
    console.error(e);
    alert(await getFunctionErrorMessage(e));
  } finally {
    setPolicyAnalyzing(false);
  }
}

function handlePolicyAnalysisView(file) {
  if (!file.analysis_result) {
    alert('저장된 AI 분석 결과가 없습니다.');
    return;
  }

  setPolicyAnalysisResult(file.analysis_result);
  setShowPolicyAnalysisModal(true);
}

  async function handlePolicyFileView(file) {
    try {
      const signedUrl = await policyFileService.getSignedUrl(file.file_url);

      if (signedUrl) {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('파일을 열 수 없습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('증권 열기 실패: ' + (e.message || JSON.stringify(e)));
    }
  }

  async function handlePolicyFileDelete(file) {
    if (!window.confirm('증권 파일을 삭제할까요?')) return;

    try {
      await policyFileService.remove(file.id, file.file_url);

      setPolicyFiles((prev) =>
        prev.filter((item) => item.id !== file.id)
      );

      alert('증권이 삭제되었습니다 😊');
    } catch (e) {
      console.error(e);
      alert('증권 삭제 실패: ' + (e.message || JSON.stringify(e)));
    }
  }

    if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!customer) return null;

  const val = (v) => (!v || v === 'EMPTY' || v === '' ? null : v);
  const policies = Array.isArray(customer.policies) ? customer.policies : [];
  const schedules = Array.isArray(customerSchedules) ? customerSchedules : [];
  const medicalItems = consultations.flatMap((item) => item.medical_history || []);
  const exclusionItems = consultations.flatMap((item) => item.exclusions || []);
 
  const disclosureDone = consultations.some((item) => item?.disclosure_info?.checked);

    let faxClaims = [];

  try {
    faxClaims = JSON.parse(localStorage.getItem('boplan_fax_claims') || '[]');
  } catch {
    faxClaims = [];
  }

  const customerFaxClaims = faxClaims.filter((claim) => {
    const customerKeys = [
      customer.db_id,
      customer.app_customer_id,
      customer.id,
    ].filter(Boolean).map(String);

    return customerKeys.includes(String(claim.customer_id));
  });

  const timelineItems = [
    ...consultations.map((item) => ({
      id: `consult-${item.id}`,
      icon: '📝',
      type: item.category || '상담',
      title: item.content || '상담기록',
      sub: item.next_action ? `다음 액션: ${item.next_action}` : '',
      date: item.consulted_at || item.created_at,
    })),
    ...policies.map((policy, idx) => ({
      id: `policy-${policy.id || idx}`,
      icon: '📋',
      type: '보험 이력',
      title: `${policy.company || '보험사 미입력'} ${policy.product || ''}`.trim(),
      sub: policy.premium ? `월 ${policy.premium}` : '',
      date: policy.start_date || customer.created_at,
    })),
    ...schedules.map((schedule, idx) => ({
      id: `schedule-${schedule.id || idx}`,
      icon: schedule.schedule_icon || '📅',
      type: '일정',
      title: schedule.title || '등록된 일정',
      sub: schedule.memo || '',
      date: schedule.scheduled_at || schedule.created_at,
    })),
        ...customerFaxClaims.map((claim) => ({
      id: `fax-${claim.id}`,
      icon: '📠',
      type: '보험금 청구',
      title: `${claim.insurance_company || '보험사 미입력'} / ${claim.claim_type || '청구유형 미입력'}`,
      sub: claim.memo ? `메모: ${claim.memo}` : '',
      date: claim.created_at,
    })),

    ...policyFiles.map((file) => ({
  id: `policy-file-${file.id}`,
  icon: '📄',
  type: '증권 등록',
  title: file.file_name || '증권 파일',
  sub: '',
  date: file.created_at,
})),
  ]
    .filter((item) => item.title)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          background: COLORS.white,
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}
      >
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}>
          ←
        </button>

        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>고객 상세</span>

        <button onClick={() => setShowEdit(true)} style={{ background: 'none', border: 'none', color: COLORS.primary, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          편집
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 40 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: val(customer.memo) ? 14 : 0 }}>
              <Avatar name={customer.name} size={56} />

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 20, color: COLORS.text }}>{customer.name}</div>
                <div style={{ fontSize: 14, color: COLORS.textGray, marginTop: 4 }}>{customer.phone}</div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {disclosureDone && (
                    <button type="button" onClick={() => setSelectedRiskModal('disclosure')} style={chipButtonStyle}>
                      📋 알릴의무 완료
                    </button>
                  )}

                  {medicalItems.length > 0 && (
                    <button type="button" onClick={() => setSelectedRiskModal('medical')} style={chipButtonStyle}>
                      🏥 병력 {medicalItems.length}건
                    </button>
                  )}

                  {exclusionItems.length > 0 && (
                    <button type="button" onClick={() => setSelectedRiskModal('exclusion')} style={chipButtonStyle}>
                      🚫 부담보 {exclusionItems.length}건
                    </button>
                  )}
                </div>
              </div>

              <StatusBadge status={customer.status} />
            </div>

            {val(customer.memo) && (
              <div style={{ background: COLORS.primaryBg, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: COLORS.text, marginTop: 12 }}>
                💬 {customer.memo}
              </div>
            )}
          </Card>

          <Section title="기본 정보" icon="👤">
            <InfoRow label="생년월일" value={val(customer.birth)} />
            <InfoRow label="주민번호" value={val(customer.ssn_masked)} />
            <InfoRow label="이메일" value={val(customer.email)} />
            <InfoRow label="직업" value={val(customer.job)} />
            <InfoRow label="주소" value={val(customer.address)} />
            <InfoRow label="최초 소개자" value={val(customer.referrer_name)} />
            <InfoRow
              label="고객 유형"
              value={
                customer.customer_type === '펫'
                  ? `🐶 ${customer.customer_type}`
                  : customer.customer_type === '태아'
                  ? `👶 ${customer.customer_type}`
                  : customer.customer_type === '가족'
                  ? `👨‍👩‍👧 ${customer.customer_type}`
                  : val(customer.customer_type)
              }
            />
            <InfoRow label="관계" value={val(customer.relation_type)} />
            <InfoRow label="등록일" value={formatDate(customer.created_at)} isLast />
          </Section>

          {(val(customer.pet_name) || val(customer.baby_name) || val(customer.car_number) || val(customer.transfer_day) || val(customer.car_expiry) || val(customer.due_date)) && (
            <Section title="추가 정보" icon="📋">
              {val(customer.pet_name) && <InfoRow label="🐶 반려동물" value={customer.pet_name} />}
              {val(customer.baby_name) && <InfoRow label="👶 태아/자녀" value={customer.baby_name} />}
              {val(customer.due_date) && <InfoRow label="🍼 출산예정일" value={formatDueDateWithDDay(customer.due_date)} />}
              {val(customer.car_number) && <InfoRow label="🚗 차량번호" value={customer.car_number} />}
              {val(customer.car_expiry) && <InfoRow label="📅 자동차만기" value={customer.car_expiry} />}
              {val(customer.transfer_day) && <InfoRow label="💳 이체일" value={customer.transfer_day} isLast />}
            </Section>
          )}

          <Section title="보험 이력" icon="📋">
            {policies.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.textGray, padding: '8px 0' }}>
                등록된 보험 이력이 없습니다. 편집에서 보험 이력을 추가하세요.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {policies.map((policy, idx) => (
                  <PolicyCard key={policy.id || idx} policy={policy} />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="증권 관리"
            icon="📄"
            action={
              <label
                style={{
                  border: 'none',
                  background: COLORS.primary,
                  color: '#fff',
                  borderRadius: 999,
                  padding: '6px 11px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: policyFileUploading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: policyFileUploading ? 0.65 : 1,
                }}
              >
                {policyFileUploading ? '업로드 중...' : '+ 등록'}

                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handlePolicyFileUpload}
                  disabled={policyFileUploading}
                  style={{ display: 'none' }}
                />
              </label>
            }
          >
            <div
    style={{
      background: '#F5F3FF',
      border: '1px solid #DDD6FE',
      color: '#7C3AED',
      padding: '10px 12px',
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 600,
      marginBottom: 10,
    }}
  >
    🤖 증권을 등록하면 AI가 보장내용을 분석하고 상담 포인트를 자동으로 정리해드립니다.
  </div>

  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}
  ></div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {policyAnalyzing && (
  <div
    style={{
      background: '#EEF2FF',
      border: '1px solid #C7D2FE',
      color: '#3730A3',
      padding: 12,
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 700,
      textAlign: 'center',
    }}
  >
    🤖 AI가 증권을 분석하고 있습니다...
    <br />
    잠시만 기다려주세요 😊
  </div>
)}

              {policyFiles.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: COLORS.textGray,
                    padding: '8px 0',
                  }}
                >
                  등록된 증권이 없습니다.
                </div>
              ) : (
                policyFiles.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 12,
                      padding: 12,
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div
  style={{
    flex: 1,
  }}
>
  <div
  style={{
    fontWeight: 700,
    fontSize: 13,
    color: COLORS.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }}
>
  📄 {file.file_name}
</div>

{file.analysis_result?.company && (
  <div
    style={{
      marginTop: 4,
      fontSize: 12,
      fontWeight: 700,
      color: COLORS.primary,
    }}
  >
    🏢 {file.analysis_result.company}
  </div>
)}

{file.analysis_result?.productName && (
  <div
    style={{
      fontSize: 11,
      color: COLORS.textGray,
      marginTop: 2,
    }}
  >
    {file.analysis_result.productName}
  </div>
)}

{file.analysis_result && (
  <div
    style={{
      marginTop: 4,
      fontSize: 11,
      color: '#15803D',
      fontWeight: 700,
    }}
  >
    ✅ AI 분석 완료
  </div>
)}
  

  <div
    style={{
      fontSize: 11,
      color: COLORS.textGray,
      marginTop: 4,
    }}
  >
    등록일 {formatDate(file.created_at)}
  </div>
</div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handlePolicyFileView(file)}
                        style={{
                          border: 'none',
                          background: COLORS.primaryBg,
                          color: COLORS.primary,
                          borderRadius: 999,
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        보기
                      </button>

                     {file.analysis_result ? (
  <button
    type="button"
    onClick={() => handlePolicyAnalysisView(file)}
    style={{
      border: 'none',
      background: '#DCFCE7',
      color: '#15803D',
      borderRadius: 8,
      padding: '6px 10px',
      fontSize: 12,
      fontWeight: 800,
      cursor: 'pointer',
    }}
  >
    📋 결과보기
  </button>
) : (
  <button
    type="button"
    onClick={() => handlePolicyAnalysis(file)}
    disabled={policyAnalyzing}
    style={{
      border: 'none',
      background: '#F3E8FF',
      color: '#7C3AED',
      borderRadius: 8,
      padding: '6px 10px',
      fontSize: 12,
      fontWeight: 800,
      cursor: policyAnalyzing ? 'not-allowed' : 'pointer',
      opacity: policyAnalyzing ? 0.6 : 1,
    }}
  >
    🤖 분석
  </button>
)}

                      <button
                        type="button"
                        onClick={() => handlePolicyFileDelete(file)}
                        style={{
                          border: 'none',
                          background: '#FEE2E2',
                          color: '#DC2626',
                          borderRadius: 999,
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Section>

          <div id="quick-section-medical">
            <Section title="병력 / 알릴의무" icon="💊">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    background: disclosureDone ? COLORS.primaryBg : '#F8FAFC',
                    color: disclosureDone ? COLORS.primary : COLORS.textGray,
                    padding: 14,
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {disclosureDone ? '📋 알릴의무 확인완료' : '📋 등록된 알릴의무 확인 정보가 없습니다.'}
                </div>

                {medicalItems.length > 0 ? (
                  medicalItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#F8FAFC',
                        padding: 14,
                        borderRadius: 12,
                        lineHeight: 1.6,
                        fontSize: 13,
                        color: COLORS.text,
                      }}
                    >
                      <div style={{ fontWeight: 900, marginBottom: 4 }}>
                        🏥 {item.disease || '질병명 미입력'}
                      </div>
                      {item.diagnosed_at && <div>진단일: {item.diagnosed_at}</div>}
                      {item.treatment_period && <div>치료기간: {item.treatment_period}</div>}
                      {item.current_treatment && <div>현재 치료: {item.current_treatment}</div>}
                      {item.medication && <div>복용약: {item.medication}</div>}
                      {item.hospitalization && <div>입원: {item.hospitalization}</div>}
                      {item.surgery && <div>수술: {item.surgery}</div>}
                      {item.memo && <div>메모: {item.memo}</div>}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, color: COLORS.textGray, padding: '8px 0' }}>
                    등록된 병력 정보가 없습니다.
                  </div>
                )}
              </div>
            </Section>
          </div>

          <div id="quick-section-exclusion">
            <Section title="부담보" icon="🚫">
              {exclusionItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {exclusionItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#FEF2F2',
                        color: '#991B1B',
                        padding: 14,
                        borderRadius: 12,
                        lineHeight: 1.6,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 900, marginBottom: 4 }}>
                        🚫 {item.body_part || item.disease || '부담보 항목'}
                      </div>
                      {item.insurance_company && <div>보험사: {item.insurance_company}</div>}
                      {item.product_name && <div>상품명: {item.product_name}</div>}
                      {item.period && <div>기간: {item.period}</div>}
                      {item.start_date && <div>시작일: {item.start_date}</div>}
                      {item.end_date && <div>종료일: {item.end_date}</div>}
                      {item.result && <div>심사결과: {item.result}</div>}
                      {item.memo && <div>메모: {item.memo}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: COLORS.textGray, padding: '8px 0' }}>
                  등록된 부담보 정보가 없습니다.
                </div>
              )}
            </Section>
          </div>

          <div id="quick-section-consultation">
              <Section title="상담 기록" icon="📝">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -42, marginBottom: 14 }}>
              <button
                onClick={() =>
                  onNavigate?.('consulting', {
                    initialCustomer: customer,
                  })
                }
                style={{
                  border: 'none',
                  background: COLORS.primary,
                  color: '#fff',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                + 상담기록 추가
              </button>
            </div>

            {consultLoading ? (
              <LoadingSpinner />
            ) : consultations.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.textGray, padding: '8px 0' }}>등록된 상담기록이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {consultations.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedConsultation(item)}
                    style={{
                      cursor: 'pointer',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 14,
                      padding: 14,
                      background: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
  <div style={{
    fontWeight: 800,
    fontSize: 13,
    color: item.category === '증권분석'
      ? '#7C3AED'
      : COLORS.primary
  }}>
    {item.category === '증권분석'
      ? '🤖 AI 증권분석'
      : item.category || '상담'}
  </div>

  <div style={{
    fontSize: 11,
    color: COLORS.textGray,
    marginTop: 3,
  }}>
    {formatDate(item.consulted_at || item.created_at)}
  </div>
</div>
</div>
                    <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55, color: COLORS.text }}>{item.content}</div>

                    {item.next_action && (
                      <div style={{ marginTop: 10, background: COLORS.primaryBg, color: COLORS.primary, borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 700 }}>
                        다음 액션: {item.next_action}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
          </div>

          <Section title="최근 활동" icon="🧭">
            {timelineItems.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.textGray, padding: '8px 0' }}>최근 활동이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {timelineItems.map((item) => (
                  <div key={item.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        background: COLORS.primaryBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: 16,
                      }}
                    >
                      {item.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.primary }}>{item.type}</div>
                      <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: COLORS.text, lineHeight: 1.4, wordBreak: 'keep-all' }}>
                        {item.title}
                      </div>
                      <div style={{ marginTop: 5, fontSize: 11, color: COLORS.textGray }}>
                        {item.sub && `${item.sub} · `}
                        {formatDate(item.date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {customer.tags && customer.tags.length > 0 && (
            <Section title="태그" icon="🏷️">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {customer.tags.map((tag, i) => (
                  <span key={i} style={{ background: COLORS.primaryBg, color: COLORS.primary, padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                    {tag}
                  </span>
                ))}
              </div>
            </Section>
          )}

          <button
            onClick={handleDelete}
            style={{
              width: '100%',
              padding: '13px 0',
              borderRadius: 12,
              border: '1.5px solid #FCA5A5',
              background: '#FEF2F2',
              color: '#DC2626',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            고객 삭제
          </button>
        </div>
      </div>

      {selectedRiskModal && (
        <Modal
          visible={true}
          onClose={() => setSelectedRiskModal(null)}
          title={selectedRiskModal === 'disclosure' ? '📋 알릴의무' : selectedRiskModal === 'medical' ? '🏥 병력고지' : '🚫 부담보'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedRiskModal === 'disclosure' && (
              <div style={{ background: COLORS.primaryBg, color: COLORS.primary, padding: 14, borderRadius: 12, fontWeight: 800 }}>📋 알릴의무 확인완료</div>
            )}

            {selectedRiskModal === 'medical' &&
              medicalItems.map((item, idx) => (
                <div key={idx} style={{ background: '#F8FAFC', padding: 14, borderRadius: 12, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 900 }}>🏥 {item.disease || '질병명 미입력'}</div>
                  {item.diagnosed_at && <div>진단일: {item.diagnosed_at}</div>}
                  {item.treatment_period && <div>치료기간: {item.treatment_period}</div>}
                  {item.current_treatment && <div>현재 치료: {item.current_treatment}</div>}
                  {item.medication && <div>복용약: {item.medication}</div>}
                  {item.hospitalization && <div>입원: {item.hospitalization}</div>}
                  {item.surgery && <div>수술: {item.surgery}</div>}
                  {item.memo && <div>메모: {item.memo}</div>}
                </div>
              ))}

            {selectedRiskModal === 'exclusion' &&
              exclusionItems.map((item, idx) => (
                <div key={idx} style={{ background: '#FEF2F2', color: '#991B1B', padding: 14, borderRadius: 12, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 900 }}>🚫 {item.body_part || item.disease || '부담보 항목'}</div>
                  {item.insurance_company && <div>보험사: {item.insurance_company}</div>}
                  {item.product_name && <div>상품명: {item.product_name}</div>}
                  {item.period && <div>기간: {item.period}</div>}
                  {item.start_date && <div>시작일: {item.start_date}</div>}
                  {item.end_date && <div>종료일: {item.end_date}</div>}
                  {item.result && <div>심사결과: {item.result}</div>}
                  {item.memo && <div>메모: {item.memo}</div>}
                </div>
              ))}
          </div>
        </Modal>
      )}

      <EditModal visible={showEdit} onClose={() => setShowEdit(false)} customer={customer} onSave={load} />

{showPolicyAnalysisModal && (
  <Modal
    visible={showPolicyAnalysisModal}
    onClose={() => setShowPolicyAnalysisModal(false)}
    title="🤖 AI 증권분석"
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><b>보험사</b><br />{policyAnalysisResult?.company || '확인 필요'}</div>
      <div><b>상품명</b><br />{policyAnalysisResult?.productName || '확인 필요'}</div>
      <div><b>계약자</b><br />{policyAnalysisResult?.contractor || '확인 필요'}</div>
      <div><b>피보험자</b><br />{policyAnalysisResult?.insured || '확인 필요'}</div>
      <div><b>보험료</b><br />{policyAnalysisResult?.premium || '확인 필요'}</div>
      <div><b>보험기간</b><br />{policyAnalysisResult?.policyPeriod || '확인 필요'}</div>

      <div>
        <b>주요 보장 요약</b>
        <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>
          {Array.isArray(policyAnalysisResult?.coverageSummary)
            ? policyAnalysisResult.coverageSummary.map(x => `- ${x}`).join('\n')
            : '확인 필요'}
        </div>
      </div>

      <div>
        <b>추가 확인 필요</b>
        <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>
          {Array.isArray(policyAnalysisResult?.missingChecks)
            ? policyAnalysisResult.missingChecks.map(x => `- ${x}`).join('\n')
            : '확인 필요'}
        </div>
      </div>

      <div><b>상담 포인트</b><br />{policyAnalysisResult?.salesPoint || '확인 필요'}</div>
      <div><b>고객 설명 멘트</b><br />{policyAnalysisResult?.customerScript || '확인 필요'}</div>

      <button
        type="button"
        onClick={async () => {
          try {
            const realId =
              customer?.db_id ||
              customer?.app_customer_id ||
              customer?.id;

            const content = `AI 증권분석 결과

보험사: ${policyAnalysisResult?.company || '확인 필요'}
상품명: ${policyAnalysisResult?.productName || '확인 필요'}
계약자: ${policyAnalysisResult?.contractor || '확인 필요'}
피보험자: ${policyAnalysisResult?.insured || '확인 필요'}
보험료: ${policyAnalysisResult?.premium || '확인 필요'}
보험기간: ${policyAnalysisResult?.policyPeriod || '확인 필요'}

주요 보장 요약:
${Array.isArray(policyAnalysisResult?.coverageSummary)
  ? policyAnalysisResult.coverageSummary.map(x => `- ${x}`).join('\n')
  : '확인 필요'}

추가 확인 필요:
${Array.isArray(policyAnalysisResult?.missingChecks)
  ? policyAnalysisResult.missingChecks.map(x => `- ${x}`).join('\n')
  : '확인 필요'}

상담 포인트:
${policyAnalysisResult?.salesPoint || '확인 필요'}

고객 설명 멘트:
${policyAnalysisResult?.customerScript || '확인 필요'}`;

            await consultationService.create({
              customer_id: realId,
              customer_name: customer?.name || '',
              category: '증권분석',
              content,
              next_action: 'AI 증권분석 결과 확인 후 보완 상담 진행',
            });

            alert('상담기록에 저장되었습니다 😊');
            setShowPolicyAnalysisModal(false);
            load();
          } catch (e) {
            console.error(e);
            alert('상담기록 저장 실패: ' + (e.message || JSON.stringify(e)));
          }
        }}
        style={{
          width: '100%',
          border: 'none',
          background: COLORS.primary,
          color: '#fff',
          borderRadius: 12,
          padding: '12px 0',
          fontSize: 14,
          fontWeight: 900,
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        💾 상담기록에 저장
      </button>
    </div>
  </Modal>
)}

      {selectedConsultation && (
        <Modal visible={true} onClose={() => setSelectedConsultation(null)} title="상담기록 상세">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: COLORS.textGray }}>카테고리</div>
              <div style={{ fontWeight: 800, color: COLORS.primary }}>{selectedConsultation.category || '상담'}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: COLORS.textGray }}>상담일시</div>
              <div>{formatDate(selectedConsultation.consulted_at || selectedConsultation.created_at)}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: COLORS.textGray }}>상담내용</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, background: '#FAFAFA', padding: 14, borderRadius: 12 }}>{selectedConsultation.content}</div>
            </div>

            {selectedConsultation?.disclosure_info?.checked && (
              <div>
                <div style={{ fontSize: 12, color: COLORS.textGray }}>알릴의무</div>
                <div style={{ background: COLORS.primaryBg, color: COLORS.primary, padding: 12, borderRadius: 12, fontWeight: 800 }}>📋 확인완료</div>
              </div>
            )}

            {(selectedConsultation?.medical_history || []).length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: COLORS.textGray }}>병력고지</div>
                <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 12, lineHeight: 1.6 }}>
                  {selectedConsultation.medical_history.map((item, idx) => (
                    <div key={idx}>
                      🏥 {item.disease || '질병명 미입력'}
                      {item.medication ? ` / 복용약: ${item.medication}` : ''}
                      {item.memo ? ` / 메모: ${item.memo}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(selectedConsultation?.exclusions || []).length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: COLORS.textGray }}>부담보</div>
                <div style={{ background: '#FEF2F2', color: '#991B1B', padding: 12, borderRadius: 12, lineHeight: 1.6 }}>
                  {selectedConsultation.exclusions.map((item, idx) => (
                    <div key={idx}>
                      🚫 {item.body_part || item.disease || '부담보 항목'}
                      {item.period ? ` / 기간: ${item.period}` : ''}
                      {item.insurance_company ? ` / 보험사: ${item.insurance_company}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedConsultation.next_action && (
              <div>
                <div style={{ fontSize: 12, color: COLORS.textGray }}>다음 액션</div>
                <div style={{ background: COLORS.primaryBg, color: COLORS.primary, padding: 12, borderRadius: 12, fontWeight: 700 }}>{selectedConsultation.next_action}</div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

const chipButtonStyle = {
  border: 'none',
  background: COLORS.primaryBg,
  color: COLORS.primary,
  borderRadius: 999,
  padding: '5px 9px',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
};
