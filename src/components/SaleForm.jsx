// src/components/SaleForm.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import Modal from './Modal';
import Field from './Field';
import { supabase } from '../supabaseClient';
import customerService from '../services/customerService';

export default function SaleForm({ visible, onClose, onSave, initial = null }) {
  const isEdit = !!initial;
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [productName, setProductName] = useState('');
  const [monthlyPremium, setMonthlyPremium] = useState('');
  const [commission, setCommission] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

useEffect(() => {
  if (visible) {
    if (initial) {
      setSelectedCustomer({ id: initial.customer_id, name: initial.customer_name });
      setInsuranceCompany(initial.insurance_company || '');
      setProductName(initial.product_name || '');
      setMonthlyPremium(initial.monthly_premium || '');
      setCommission(initial.commission || '');
      setDate(initial.sale_date || new Date().toISOString().slice(0, 10));
      setExpiryDate(initial.expiry_date || '');
      setMemo(initial.memo || '');
    } else {
      setSelectedCustomer(null);
      setCustomerSearch('');
      setInsuranceCompany('');
      setProductName('');
      setMonthlyPremium('');
      setCommission('');
      setDate(new Date().toISOString().slice(0, 10));
      setExpiryDate('');
      setMemo('');
    }
    setError('');
  }
}, [visible, initial]);

  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerOptions([]);
      return;
    }
    async function search() {
      const data = await customerService.list({ status: '전체', search: customerSearch });
      setCustomerOptions(data || []);
    }
    search();
  }, [customerSearch]);

  async function handleSave() {
    if (!selectedCustomer) { setError('고객을 선택하세요'); return; }
    if (!monthlyPremium) { setError('월 보험료를 입력하세요'); return; }

    setLoading(true);
    setError('');
    try {
     const { data: { user } } = await supabase.auth.getUser();

if (isEdit) {
  const { error: e } = await supabase.from('sales').update({
    customer_id: selectedCustomer.id,
    customer_name: selectedCustomer.name,
    insurance_company: insuranceCompany,
    product_name: productName,
    monthly_premium: Number(monthlyPremium),
    commission: Number(commission),
    amount: Number(monthlyPremium),
    sale_date: date,
    expiry_date: expiryDate,
    memo,
  }).eq('id', initial.id);
  if (e) throw e;
} else {
  const { error: e } = await supabase.from('sales').insert({
    user_id: user.id,
    customer_id: selectedCustomer.id,
    customer_name: selectedCustomer.name,
    insurance_company: insuranceCompany,
    product_name: productName,
    monthly_premium: Number(monthlyPremium),
    commission: Number(commission),
    amount: Number(monthlyPremium),
    sale_date: date,
    expiry_date: expiryDate,
    memo,
  });
  if (e) throw e;
}
onSave();
onClose();
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} title={isEdit ? '매출 수정' : '매출 등록'}>
      {/* 고객 검색 */}
      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>고객명</span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#FAFAFA', border: `1.5px solid ${COLORS.border}`,
        borderRadius: 12, padding: '10px 14px', marginBottom: 8,
      }}>
        <span>🔍</span>
        <input
          value={selectedCustomer ? selectedCustomer.name : customerSearch}
          onChange={e => {
            setCustomerSearch(e.target.value);
            setSelectedCustomer(null);
          }}
          placeholder="고객명 검색"
          style={{
            border: 'none', background: 'none', outline: 'none',
            flex: 1, fontSize: 13, color: COLORS.text, fontFamily: 'inherit',
          }}
        />
        {selectedCustomer && (
          <button
            onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: COLORS.textGray, fontSize: 16 }}
          >✕</button>
        )}
      </div>

      {/* 고객 검색 결과 */}
      {!selectedCustomer && customerOptions.length > 0 && (
        <div style={{
          border: `1px solid ${COLORS.border}`, borderRadius: 12,
          overflow: 'hidden', marginBottom: 12, maxHeight: 160, overflowY: 'auto',
        }}>
          {customerOptions.slice(0, 8).map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomerOptions([]); }}
              style={{
                width: '100%', border: 'none', background: '#fff',
                padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.text }}>{c.name}</div>
              <div style={{ fontSize: 11, color: COLORS.textGray }}>{c.phone || '-'}</div>
            </button>
          ))}
        </div>
      )}

      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>보험사</span>
      <Field icon="🏢" placeholder="보험사명" value={insuranceCompany} onChange={e => setInsuranceCompany(e.target.value)} />

      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>상품명</span>
      <Field icon="📄" placeholder="상품명" value={productName} onChange={e => setProductName(e.target.value)} />

      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>월 보험료</span>
      <Field icon="💰" placeholder="월 보험료 (원)" value={monthlyPremium} onChange={e => setMonthlyPremium(e.target.value)} type="number" />

      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>수수료 금액</span>
      <Field icon="💵" placeholder="수수료 금액 (원)" value={commission} onChange={e => setCommission(e.target.value)} type="number" />

      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>계약일</span>
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        style={{
          border: `1.5px solid ${COLORS.border}`, borderRadius: 12,
          padding: '12px 16px', fontSize: 14, outline: 'none',
          width: '100%', boxSizing: 'border-box', color: COLORS.text,
          background: '#FAFAFA', fontFamily: 'inherit', marginBottom: 10,
        }}
      />

      {/* ✅ 여기에 추가 */}
<span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>만기일</span>
<input
  type="date"
  value={expiryDate}
  onChange={e => setExpiryDate(e.target.value)}
  style={{
    border: `1.5px solid ${COLORS.border}`, borderRadius: 12,
    padding: '12px 16px', fontSize: 14, outline: 'none',
    width: '100%', boxSizing: 'border-box', color: COLORS.text,
    background: '#FAFAFA', fontFamily: 'inherit', marginBottom: 10,
  }}
/>

      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>메모</span>
      <Field icon="📝" placeholder="메모 (선택)" value={memo} onChange={e => setMemo(e.target.value)} />

      {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <button
        onClick={handleSave}
        disabled={loading}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 12,
          border: 'none', background: COLORS.primary, color: '#fff',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {loading ? '저장 중...' : isEdit ? '수정 완료' : '매출 등록'}
      </button>
    </Modal>
  );
}