import React, { useState } from 'react';
import { COLORS } from '../constants';
import authService from '../services/authService';
import { supabase } from '../supabaseClient';

export default function DeleteAccountPage({ onBack }) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (confirmText !== '계정삭제') {
      alert('확인 문구에 "계정삭제"를 정확히 입력해주세요.');
      return;
    }

    const ok = window.confirm(
      '정말 계정을 삭제하시겠습니까?\n고객정보, 일정, 상담기록 등 계정 데이터가 삭제되며 복구할 수 없습니다.'
    );

    if (!ok) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirmText },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      alert('계정 삭제가 완료되었습니다.');
      await authService.signOut();
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('계정 삭제 중 오류가 발생했습니다: ' + (e.message || '알 수 없는 오류'));
    } finally {
      setLoading(false);
    }
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

        <span style={{ fontWeight: 700, fontSize: 17 }}>계정 삭제</span>
      </div>

      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: 14,
            padding: 16,
            color: '#991B1B',
            lineHeight: 1.6,
            fontSize: 14,
          }}
        >
          계정을 삭제하면 고객정보, 일정, 상담기록, 매출기록, 프로필 등 계정과 연결된 데이터가 삭제됩니다.
          <br />
          삭제 후에는 복구할 수 없습니다.
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            padding: 16,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 8 }}>
            계속하려면 아래에 <b>계정삭제</b> 를 입력하세요.
          </div>

          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="계정삭제"
            style={{
              width: '100%',
              border: `1.5px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 14,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        <button
          onClick={handleDelete}
          disabled={loading}
          style={{
            background: '#DC2626',
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            padding: '14px 0',
            fontWeight: 800,
            fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '삭제 처리 중...' : '계정 및 데이터 삭제'}
        </button>
      </div>
    </div>
  );
}