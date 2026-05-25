import React from 'react';
import { COLORS } from '../constants';
import authService from '../services/authService';

export default function DeleteAccountPage({ onBack }) {
  async function handleDelete() {
    const ok = window.confirm(
      '정말 계정을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.'
    );

    if (!ok) return;

    alert(
      '계정 삭제 기능은 현재 준비 중입니다.\n정식 버전에서 제공될 예정입니다.'
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          background: '#fff',
          padding: '14px 20px',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          ←
        </button>

        <span style={{ fontWeight: 700, fontSize: 17 }}>
          계정 삭제
        </span>
      </div>

      <div
        style={{
          flex: 1,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: 12,
            padding: 16,
            color: '#991B1B',
            lineHeight: 1.6,
          }}
        >
          계정을 삭제하면 고객정보, 일정, 상담기록 등
          계정과 연결된 데이터가 삭제될 수 있습니다.
        </div>

        <button
          onClick={handleDelete}
          style={{
            background: '#DC2626',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '14px 0',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          계정 삭제 요청
        </button>
      </div>
    </div>
  );
}