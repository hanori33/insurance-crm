
import React, { useState } from 'react';
import { COLORS } from '../constants';
import Modal from './Modal';
import noteService from '../services/noteService';

export default function NoteForm({ visible, onClose, onSave, customerId }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSave() {
    if (!content.trim()) { setError('내용을 입력하세요'); return; }
    setLoading(true); setError('');
    try {
      await noteService.create({ customer_id: customerId || null, content });
      setContent(''); onSave(); onClose();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="메모 추가">
      <div style={{ marginBottom: 16 }}>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="메모를 입력하세요"
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