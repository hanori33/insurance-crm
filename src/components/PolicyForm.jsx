
import React, { useState } from 'react';
import { COLORS } from '../constants';
import Modal from './Modal';
import Field from './Field';
import policyService from '../services/policyService';

export default function PolicyForm({ visible, onClose, onSave, customerId }) {
  const [form, setForm] = useState({ product_name: '', company: '', premium: '', start_date: '', end_date: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.product_name.trim()) { setError('상품명을 입력하세요'); return; }
    setLoading(true); setError('');
    try {
      await policyService.create({ ...form, customer_id: customerId });
      setForm({ product_name: '', company: '', premium: '', start_date: '', end_date: '' });
      onSave(); onClose();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="보험 이력 추가">
      <Field icon="📋" placeholder="상품명" value={form.product_name} onChange={e => set('product_name', e.target.value)} />
      <Field icon="🏢" placeholder="보험사" value={form.company} onChange={e => set('company', e.target.value)} />
      <Field icon="💰" placeholder="월 보험료 (원)" value={form.premium} onChange={e => set('premium', e.target.value)} type="number" />
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>시작일</span>
        <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
          style={{ border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', color: COLORS.text, background: '#FAFAFA', fontFamily: 'inherit' }} />
      </div>
      {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button onClick={handleSave} disabled={loading}
        style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: COLORS.primary, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
        {loading ? '저장 중...' : '저장'}
      </button>
    </Modal>
  );
}