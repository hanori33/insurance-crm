
import React, { useState } from 'react';
import { COLORS } from '../constants';
import Modal from './Modal';
import Field from './Field';
import scheduleService from '../services/scheduleService';

export default function ScheduleForm({ visible, onClose, onSave, dateStr, initial = null }) {
  const isEdit = !!initial;
  const defaultTime = initial?.scheduled_at
    ? new Date(initial.scheduled_at).toTimeString().slice(0, 5) : '09:00';
  const [title, setTitle]       = useState(initial?.title || '');
  const [customer, setCustomer] = useState(initial?.customer_name || '');
  const [time, setTime]         = useState(defaultTime);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSave() {
    if (!title.trim()) { setError('일정 제목을 입력하세요'); return; }
    setLoading(true); setError('');
    try {
      const payload = { title, customer_name: customer, scheduled_at: `${dateStr}T${time}:00` };
      if (isEdit) await scheduleService.update(initial.id, payload);
      else        await scheduleService.create(payload);
      onSave();
      onClose();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} onClose={onClose} title={isEdit ? '일정 수정' : '일정 등록'}>
      <Field icon="📝" placeholder="일정 제목" value={title} onChange={e => setTitle(e.target.value)} />
      <Field icon="👤" placeholder="고객명 (선택)" value={customer} onChange={e => setCustomer(e.target.value)} />
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>시간</span>
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={{ border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', color: COLORS.text, background: '#FAFAFA', fontFamily: 'inherit' }} />
      </div>
      {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button onClick={handleSave} disabled={loading}
        style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: COLORS.primary, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
        {loading ? '저장 중...' : isEdit ? '수정 완료' : '일정 등록'}
      </button>
    </Modal>
  );
}