// src/pages/CustomerDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS, CUSTOMER_STATUSES } from '../constants';
import { Card, Avatar, StatusBadge, Divider, LoadingSpinner } from '../components/Common';
import Modal from '../components/Modal';
import Field from '../components/Field';
import customerService from '../services/customerService';
import { formatDate } from '../utils';

// ── 정보 행 ───────────────────────────────────
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

// ── 섹션 카드 ─────────────────────────────────
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

// ── 편집 모달 ─────────────────────────────────
function EditModal({ visible, onClose, customer, onSave }) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (customer) setForm({
      name:          customer.name || '',
      phone:         customer.phone || '',
      status:        customer.status || '상담중',
      birth:         customer.birth || '',
      email:         customer.email || '',
      memo:          customer.memo || '',
      job:           customer.job || '',
      address:       customer.address || '',
      customer_type: customer.customer_type || '일반',
      pet_name:      customer.pet_name || '',
      baby_name:     customer.baby_name || '',
      transfer_day:  customer.transfer_day || '',
      car_number:    customer.car_number || '',
      relation_type: customer.relation_type || '',
    });
  }, [customer, visible]);

  async function handleSave() {
    setLoading(true);
    try {
      await customerService.update(customer.id, form);
      onSave();
      onClose();
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="고객 정보 수정">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray }}>이름</span>
        <Field icon="👤" placeholder="이름" value={form.name || ''} onChange={e => set('name', e.target.value)} />
        <span style={{ fontSize: 13, color: COLORS.textGray }}>전화번호</span>
        <Field icon="📞" placeholder="전화번호" value={form.phone || ''} onChange={e => set('phone', e.target.value)} type="tel" />
        <span style={{ fontSize: 13, color: COLORS.textGray }}>상태</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {CUSTOMER_STATUSES.map(s => (
            <button key={s} onClick={() => set('status', s)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
              background: form.status === s ? COLORS.primary : COLORS.primaryBg,
              color: form.status === s ? '#fff' : COLORS.primary,
              fontWeight: form.status === s ? 700 : 400,
            }}>{s}</button>
          ))}
        </div>
        <span style={{ fontSize: 13, color: COLORS.textGray }}>생년월일</span>
        <Field icon="🎂" placeholder="생년월일" value={form.birth || ''} onChange={e => set('birth', e.target.value)} />
        <span style={{ fontSize: 13, color: COLORS.textGray }}>이메일</span>
        <Field icon="✉️" placeholder="이메일" value={form.email || ''} onChange={e => set('email', e.target.value)} type="email" />
        <span style={{ fontSize: 13, color: COLORS.textGray }}>직업</span>
        <Field icon="💼" placeholder="직업" value={form.job || ''} onChange={e => set('job', e.target.value)} />
        <span style={{ fontSize: 13, color: COLORS.textGray }}>주소</span>
        <Field icon="📍" placeholder="주소" value={form.address || ''} onChange={e => set('address', e.target.value)} />
        <span style={{ fontSize: 13, color: COLORS.textGray }}>메모</span>
        <textarea value={form.memo || ''} onChange={e => set('memo', e.target.value)} rows={3} placeholder="메모"
          style={{ width: '100%', border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: COLORS.text, background: '#FAFAFA', fontFamily: 'inherit', marginBottom: 10 }} />
        <span style={{ fontSize: 13, color: COLORS.textGray }}>차량번호</span>
        <Field icon="🚗" placeholder="차량번호" value={form.car_number || ''} onChange={e => set('car_number', e.target.value)} />
        <span style={{ fontSize: 13, color: COLORS.textGray }}>관계</span>
        <Field icon="👨‍👩‍👧" placeholder="관계 (예: 가족, 지인)" value={form.relation_type || ''} onChange={e => set('relation_type', e.target.value)} />
      </div>
      <button onClick={handleSave} disabled={loading} style={{
        width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
        background: COLORS.primary, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 8,
      }}>
        {loading ? '저장 중...' : '저장'}
      </button>
    </Modal>
  );
}

// ── 메인 ─────────────────────────────────────
export default function CustomerDetailPage({ customerId, onBack }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => { load(); }, [customerId]);

  async function load() {
    setLoading(true);
    try {
      const data = await customerService.get(customerId);
      setCustomer(data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!window.confirm('고객을 삭제하시겠습니까?')) return;
    try { await customerService.remove(customerId); onBack(); }
    catch(e) { console.error(e); }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <LoadingSpinner />
    </div>
  );
  if (!customer) return null;

  const val = (v) => (!v || v === 'EMPTY' || v === '') ? null : v;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ background: COLORS.white, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>고객 상세</span>
        <button onClick={() => setShowEdit(true)} style={{ background: 'none', border: 'none', color: COLORS.primary, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>편집</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 40 }}>

          {/* 프로필 카드 */}
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

          {/* 기본 정보 */}
          <Section title="기본 정보" icon="👤">
            <InfoRow label="생년월일" value={val(customer.birth)} />
            <InfoRow label="이메일" value={val(customer.email)} />
            <InfoRow label="직업" value={val(customer.job)} />
            <InfoRow label="주소" value={val(customer.address)} />
            <InfoRow label="고객 유형" value={val(customer.customer_type)} />
            <InfoRow label="관계" value={val(customer.relation_type)} />
            <InfoRow label="등록일" value={formatDate(customer.created_at)} isLast />
          </Section>

          {/* 추가 정보 - 값 있는 것만 표시 */}
          {(val(customer.pet_name) || val(customer.baby_name) || val(customer.car_number) || val(customer.transfer_day) || val(customer.bank_account)) && (
            <Section title="추가 정보" icon="📋">
              {val(customer.pet_name) && <InfoRow label="반려동물" value={customer.pet_name} />}
              {val(customer.baby_name) && <InfoRow label="자녀" value={customer.baby_name} />}
              {val(customer.car_number) && <InfoRow label="차량번호" value={customer.car_number} />}
              {val(customer.transfer_day) && <InfoRow label="이체일" value={customer.transfer_day} />}
              {val(customer.bank_account) && <InfoRow label="계좌번호" value={customer.bank_account} isLast />}
            </Section>
          )}

          {/* 태그 */}
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

          {/* 삭제 버튼 */}
          <button onClick={handleDelete} style={{
            width: '100%', padding: '13px 0', borderRadius: 12,
            border: '1.5px solid #FCA5A5', background: '#FEF2F2',
            color: '#DC2626', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>고객 삭제</button>

        </div>
      </div>

      <EditModal visible={showEdit} onClose={() => setShowEdit(false)} customer={customer} onSave={load} />
    </div>
  );
}