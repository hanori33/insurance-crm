// src/components/NoticeForm.jsx
import React, { useState } from 'react';
import { COLORS } from '../constants';
import Modal from './Modal';
import Field from './Field';
import noticeService from '../services/noticeService';

const ROLE_OPTIONS = [
  { value: 'division_head', label: '사업단장' },
  { value: 'branch_head', label: '본부장' },
  { value: 'office_head', label: '지점장' },
  { value: 'team_leader', label: '팀장' },
  { value: 'agent', label: '사원' },
];

const ROLE_LABELS = {
  superadmin: '최고관리자',
  division_head: '사업단장',
  branch_head: '본부장',
  office_head: '지점장',
  team_leader: '팀장',
  agent: '사원',
};

function getAllowedTargets(myRole) {
  if (myRole === 'superadmin' || myRole === 'division_head') return ROLE_OPTIONS;
  if (myRole === 'branch_head') return ROLE_OPTIONS.filter(r => ['office_head', 'team_leader', 'agent'].includes(r.value));
  if (myRole === 'office_head') return ROLE_OPTIONS.filter(r => ['team_leader', 'agent'].includes(r.value));
  if (myRole === 'team_leader') return ROLE_OPTIONS.filter(r => r.value === 'agent');
  return [];
}

export default function NoticeForm({ visible, onClose, myRole, userName, onSave }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetRoles, setTargetRoles] = useState(['agent']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allowedTargets = getAllowedTargets(myRole);

  function toggleRole(role) {
    setTargetRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  async function handleSave() {
    if (!title.trim()) { setError('제목을 입력하세요'); return; }
    if (!content.trim()) { setError('내용을 입력하세요'); return; }
    if (targetRoles.length === 0) { setError('공지 대상을 선택하세요'); return; }

    setLoading(true);
    setError('');
    try {
      await noticeService.create({
        title: title.trim(),
        content: content.trim(),
        author_name: userName,
        author_role: ROLE_LABELS[myRole] || myRole,
        target_roles: targetRoles,
      });
      setTitle('');
      setContent('');
      setTargetRoles(['agent']);
      onSave();
    } catch(e) {
      setError(e.message || '저장 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="공지사항 작성">
      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>제목</span>
      <Field icon="📢" placeholder="공지 제목" value={title} onChange={e => setTitle(e.target.value)} />

      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>내용</span>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="공지 내용을 입력하세요"
        rows={5}
        style={{
          width: '100%', border: `1.5px solid ${COLORS.border}`,
          borderRadius: 12, padding: '12px 14px', fontSize: 14,
          outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          color: COLORS.text, background: '#FAFAFA', fontFamily: 'inherit',
          marginBottom: 14,
        }}
      />

      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 8, display: 'block' }}>공지 대상</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {allowedTargets.map(r => (
          <button
            key={r.value}
            type="button"
            onClick={() => toggleRole(r.value)}
            style={{
              padding: '6px 14px', borderRadius: 999, border: 'none',
              cursor: 'pointer', fontSize: 13,
              background: targetRoles.includes(r.value) ? COLORS.primary : COLORS.primaryBg,
              color: targetRoles.includes(r.value) ? '#fff' : COLORS.primary,
              fontWeight: targetRoles.includes(r.value) ? 700 : 400,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

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
        {loading ? '저장 중...' : '공지 등록'}
      </button>
    </Modal>
  );
}