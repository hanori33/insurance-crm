
import React, { useState } from 'react';
import { COLORS } from '../constants';
import Modal from './Modal';
import Field from './Field';
import { supabase } from '../supabaseClient';

export default function SaleForm({ visible, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSave() {
    if (!amount) { setError('금액을 입력하세요'); return; }
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: e } = await supabase.from('sales').insert({ amount: Number(amount), sale_date: date, memo, user_id: user.id });
      if (e) throw e;
      setAmount(''); setMemo(''); onSave(); onClose();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="매출 등록">
      <Field icon="💰" placeholder="금액 (천원)" value={amount} onChange={e => setAmount(e.target.value)} type="number" />
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>날짜</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', color: COLORS.text, background: '#FAFAFA', fontFamily: 'inherit', marginBottom: 10 }} />
      </div>
      <Field icon="📝" placeholder="메모 (선택)" value={memo} onChange={e => setMemo(e.target.value)} />
      {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button onClick={handleSave} disabled={loading}
        style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: COLORS.primary, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
        {loading ? '저장 중...' : '저장'}
      </button>
    </Modal>
  );
}