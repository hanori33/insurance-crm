
import React, { useState } from 'react';
import { COLORS } from '../constants';
import Modal from './Modal';
import Field from './Field';
import consultationService from '../services/consultationService';

export default function ConsultationForm({ visible, onClose, onSave, customerId }) {
  const [content, setContent] = useState('');
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSave() {
    if (!content.trim()) { setError('내용을 입력하세요'); return; }
    setLoading(true); setError('');
    try {
      await consultationService.create({ customer_id: customerId, content, consulted_at: date });
      setContent(''); onSave(); onClose();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="상담 메모 추가">
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>상담일</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', color: COLORS.text, background: '#FAFAFA', fontFamily: 'inherit', marginBottom: 10 }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>내용</span>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="상담 내용을 입력하세요"
          style={{ width: '100%', border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: COLORS.text, background: '#FAFAFA', fontFamily: 'inherit' }} />
      </div>
      {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button onClick={handleSave} disabled={loading}
        style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: COLORS.primary, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
        {loading ? '저장 중...' : '저장'}
      </button>
    </Modal>
  );
}