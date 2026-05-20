// src/pages/CustomerDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS, CUSTOMER_STATUSES } from '../constants';
import { Card, Avatar, StatusBadge, Divider, LoadingSpinner } from '../components/Common';
import Modal from '../components/Modal';
import Field from '../components/Field';
import customerService from '../services/customerService';
import consultationService from '../services/consultationService';
import { formatDate } from '../utils';

const RELATION_OPTIONS = ['가족', '지인', '친구', '동료', '고객', '고객소개', '기타'];

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

function Section({ title, icon, children }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{title}</span>
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
    if (customer) {
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
  due_date: customer.due_date || '',   // ✅ 추가
  transfer_day: customer.transfer_day || '',
  car_number: customer.car_number || '',
  car_expiry: customer.car_expiry || '',  // ✅ 추가
  relation_type: customer.relation_type || '',
  referrer_app_id: customer.referrer_app_id || '',
  policies: Array.isArray(customer.policies) ? customer.policies : [],
});

      setNewPolicy({
        company: '',
        product: '',
        premium: '',
        start_date: '',
        note: '',
      });
    }
  }, [customer, visible]);

  useEffect(() => {
    async function loadReferrers() {
      try {
        const data = await customerService.list({ status: '전체', search: '' });
        const currentId = customer?.app_customer_id || customer?.id || customer?.db_id;

        const filtered = (data || []).filter((c) =>
          String(c.app_customer_id || c.id || c.db_id) !== String(currentId)
        );

        setReferrerOptions(filtered);
      } catch (e) {
        console.error(e);
        setReferrerOptions([]);
      }
    }

    if (visible) loadReferrers();
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
          <div style={{ marginBottom: 8, fontSize: 12, color: COLORS.primary, fontWeight: 700 }}>
            소개자 연결 완료
            <button
              type="button"
              onClick={() => {
                set('referrer_app_id', '');
                setReferrerSearch('');
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
              .filter((c) =>
                c.name?.includes(referrerSearch.trim()) ||
                c.phone?.includes(referrerSearch.trim())
              )
              .slice(0, 10)
              .map((c) => (
                <button
                  key={c.app_customer_id || c.id}
                  type="button"
                  onClick={() => {
                    set('referrer_app_id', c.app_customer_id || c.id);
                    setReferrerSearch(c.name);
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
                set(
                  'policies',
                  (form.policies || []).filter((_, i) => i !== idx)
                );
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
            <Field
              icon="🏢"
              placeholder="보험사"
              value={newPolicy.company}
              onChange={(e) => setNewPolicy((p) => ({ ...p, company: e.target.value }))}
            />

            <Field
              icon="📄"
              placeholder="상품명"
              value={newPolicy.product}
              onChange={(e) => setNewPolicy((p) => ({ ...p, product: e.target.value }))}
            />

            <Field
              icon="💰"
              placeholder="보험료"
              value={newPolicy.premium}
              onChange={(e) => setNewPolicy((p) => ({ ...p, premium: e.target.value }))}
            />

            <Field
              icon="📅"
              placeholder="계약일"
              value={newPolicy.start_date}
              onChange={(e) => setNewPolicy((p) => ({ ...p, start_date: e.target.value }))}
            />

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
  onBack,
  onNavigate,
}) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [consultLoading, setConsultLoading] = useState(false);

  useEffect(() => {
    load();
  }, [customerId]);

  async function load() {
    setLoading(true);

    try {
      const data = await customerService.get(customerId);
      setCustomer(data);

      const realId = data?.db_id || data?.app_customer_id || data?.id;

      if (realId) {
        setConsultLoading(true);

        try {
          const consultationData = await consultationService.listByCustomer(realId);
          setConsultations(consultationData || []);
        } catch (consultError) {
          console.error(consultError);
          setConsultations([]);
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
      onBack();
    } catch (e) {
      console.error(e);
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

  const val = (v) => (!v || v === 'EMPTY' || v === '') ? null : v;
  const policies = Array.isArray(customer.policies) ? customer.policies : [];

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

          {(val(customer.pet_name) || val(customer.baby_name) || val(customer.car_number) || val(customer.transfer_day)) && (
            <Section title="추가 정보" icon="📋">
              {val(customer.pet_name) && <InfoRow label="🐶 반려동물" value={customer.pet_name} />}
{val(customer.baby_name) && <InfoRow label="👶 태아/자녀" value={customer.baby_name} />}
{val(customer.due_date) && <InfoRow label="🍼 출산예정일" value={customer.due_date} />}  {/* ✅ 추가 */}
{val(customer.car_number) && <InfoRow label="🚗 차량번호" value={customer.car_number} />}
{val(customer.car_expiry) && <InfoRow label="📅 자동차만기" value={customer.car_expiry} />}  {/* ✅ 추가 */}
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

          <Section title="상담 기록" icon="📝">
            <div
  style={{
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: -42,
    marginBottom: 14,
  }}

>
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
              <div style={{ fontSize: 13, color: COLORS.textGray, padding: '8px 0' }}>
                등록된 상담기록이 없습니다.
              </div>
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
                        <div style={{ fontWeight: 800, fontSize: 13, color: COLORS.primary }}>
                          {item.category || '상담'}
                        </div>

                        <div style={{ fontSize: 11, color: COLORS.textGray, marginTop: 3 }}>
                          {formatDate(item.consulted_at || item.created_at)}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        whiteSpace: 'pre-wrap',
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: COLORS.text,
                      }}
                    >
                      {item.content}
                    </div>

                    {item.next_action && (
                      <div
                        style={{
                          marginTop: 10,
                          background: COLORS.primaryBg,
                          color: COLORS.primary,
                          borderRadius: 10,
                          padding: '8px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        다음 액션: {item.next_action}
                      </div>
                    )}
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

      <EditModal
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        customer={customer}
        onSave={load}
      />
      {selectedConsultation && (
  <Modal
    visible={true}
    onClose={() => setSelectedConsultation(null)}
    title="상담기록 상세"
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, color: COLORS.textGray }}>카테고리</div>
        <div style={{ fontWeight: 800, color: COLORS.primary }}>
          {selectedConsultation.category || '상담'}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: COLORS.textGray }}>상담일시</div>
        <div>
          {formatDate(selectedConsultation.consulted_at || selectedConsultation.created_at)}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: COLORS.textGray }}>상담내용</div>
        <div
          style={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            background: '#FAFAFA',
            padding: 14,
            borderRadius: 12,
          }}
        >
          {selectedConsultation.content}
        </div>
      </div>

      {selectedConsultation.next_action && (
        <div>
          <div style={{ fontSize: 12, color: COLORS.textGray }}>다음 액션</div>
          <div
            style={{
              background: COLORS.primaryBg,
              color: COLORS.primary,
              padding: 12,
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            {selectedConsultation.next_action}
          </div>
        </div>
      )}
    </div>
  </Modal>
)}
    </div>
  );
}