
import React, { useState } from 'react';
import { COLORS, CUSTOMER_STATUSES } from '../constants';
import Modal from './Modal';
import Field from './Field';
import customerService from '../services/customerService';

export default function CustomerForm({ visible, onClose, onSave, initial = null }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(initial || { name: '', phone: '', status: '상담중', memo: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.name.trim()) { setError('이름을 입력하세요'); return; }
    if (!form.phone.trim()) { setError('전화번호를 입력하세요'); return; }
    setLoading(true); setError('');
    try {
      if (isEdit) await customerService.update(initial.id, form);
      else        await customerService.create(form);
      onSave();
      onClose();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} onClose={onClose} title={isEdit ? '고객 수정' : '고객 등록'}>
      <Field icon="👤" placeholder="이름" value={form.name} onChange={e => set('name', e.target.value)} />
      <Field icon="📞" placeholder="전화번호" value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" />
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>상태</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CUSTOMER_STATUSES.map(s => (
            <button key={s} onClick={() => set('status', s)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
              background: form.status === s ? COLORS.primary : COLORS.primaryBg,
              color: form.status === s ? '#fff' : COLORS.primary,
              fontWeight: form.status === s ? 700 : 400,
            }}>{s}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>메모</span>
        <textarea value={form.memo} onChange={e => set('memo', e.target.value)} rows={3} placeholder="상담 메모"
          style={{ width: '100%', border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: COLORS.text, background: '#FAFAFA', fontFamily: 'inherit' }} />
      </div>
      {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button onClick={handleSave} disabled={loading}
        style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: COLORS.primary, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
        {loading ? '저장 중...' : isEdit ? '수정 완료' : '고객 등록'}
      </button>
    </Modal>
  );
}