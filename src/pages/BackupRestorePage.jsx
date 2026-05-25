// src/pages/BackupRestorePage.jsx
import React, { useRef, useState } from 'react';
import { COLORS } from '../constants';
import { supabase } from '../supabaseClient';

const TABLES = ['customers', 'schedules', 'sales'];

function cleanRows(rows, userId) {
  return (rows || []).map((row) => {
    const copy = { ...row };

    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    delete copy.completed_at;

    copy.user_id = userId;
    return copy;
  });
}

export default function BackupRestorePage({ onBack }) {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [backupData, setBackupData] = useState(null);

  async function getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error('로그인이 필요합니다.');
    return data.user;
  }

  async function handleBackup() {
    setLoading(true);

    try {
      const user = await getUser();

      const result = {
        app: 'BoPlan',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        userEmail: user.email,
        customers: [],
        schedules: [],
        sales: [],
      };

      for (const table of TABLES) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;
        result[table] = data || [];
      }

      const json = JSON.stringify(result, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const today = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boplan-backup-${today}.json`;
      a.click();

      URL.revokeObjectURL(url);
      alert('백업 파일이 다운로드되었습니다.');
    } catch (e) {
      console.error(e);
      alert('백업 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);

        if (!parsed || parsed.app !== 'BoPlan') {
          alert('보플랜 백업 파일이 아닙니다.');
          return;
        }

        setBackupData(parsed);
      } catch {
        alert('JSON 파일을 읽을 수 없습니다.');
      }
    };

    reader.readAsText(file);
  }

  async function handleRestore() {
    if (!backupData) {
      alert('복원할 백업 파일을 먼저 선택해주세요.');
      return;
    }

    const ok = window.confirm(
      '백업 파일의 고객/일정/매출 데이터를 현재 계정에 추가 복원합니다.\n기존 데이터는 삭제되지 않습니다.\n계속할까요?'
    );

    if (!ok) return;

    setLoading(true);

    try {
      const user = await getUser();

      for (const table of TABLES) {
        const rows = cleanRows(backupData[table], user.id);

        if (rows.length === 0) continue;

        const { error } = await supabase
          .from(table)
          .insert(rows);

        if (error) throw error;
      }

      alert('복원이 완료되었습니다.');
      setBackupData(null);
      setRestoreFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      console.error(e);
      alert('복원 실패: ' + e.message);
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
        <span style={{ fontWeight: 700, fontSize: 17 }}>백업 / 복원</span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 18,
            boxShadow: '0 2px 14px rgba(124,92,252,0.08)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>📥 데이터 백업</h3>
          <p style={{ color: COLORS.textGray, fontSize: 14, lineHeight: 1.6 }}>
            고객정보, 일정, 매출 데이터를 JSON 파일로 다운로드합니다.
            권한정보와 계정정보는 백업하지 않습니다.
          </p>

          <button
            onClick={handleBackup}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              border: 'none',
              background: COLORS.primary,
              color: '#fff',
              fontWeight: 800,
              fontSize: 15,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '처리 중...' : '백업 파일 다운로드'}
          </button>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 18,
            boxShadow: '0 2px 14px rgba(124,92,252,0.08)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>📤 데이터 복원</h3>
          <p style={{ color: COLORS.textGray, fontSize: 14, lineHeight: 1.6 }}>
            보플랜 백업 JSON 파일을 선택해 현재 계정에 데이터를 추가합니다.
            기존 데이터는 삭제되지 않습니다.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%',
              padding: '13px 0',
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              background: '#fff',
              color: COLORS.text,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            JSON 파일 선택
          </button>

          {restoreFileName && (
            <div
              style={{
                fontSize: 13,
                color: COLORS.textGray,
                marginBottom: 10,
              }}
            >
              선택된 파일: {restoreFileName}
            </div>
          )}

          <button
            onClick={handleRestore}
            disabled={loading || !backupData}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              border: 'none',
              background: backupData ? '#16A34A' : '#D1D5DB',
              color: '#fff',
              fontWeight: 800,
              fontSize: 15,
              cursor: backupData ? 'pointer' : 'default',
            }}
          >
            {loading ? '처리 중...' : '복원 실행'}
          </button>
        </div>

        <div
          style={{
            background: '#FEF3C7',
            borderRadius: 14,
            padding: 14,
            color: '#92400E',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          ※ 주민등록번호, 계좌번호, 카드번호 등 민감정보는 보플랜에 저장하지 않는 것을 원칙으로 합니다.
        </div>
      </div>
    </div>
  );
}