import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { COLORS } from '../constants';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [passwordCheck, setPasswordCheck] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleUpdatePassword() {
    setError('');
    setMessage('');

    if (!password || !passwordCheck) {
      setError('새 비밀번호를 입력해주세요.');
      return;
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상 입력해주세요.');
      return;
    }

    if (password !== passwordCheck) {
      setError('비밀번호가 서로 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setMessage('비밀번호가 변경되었습니다. 다시 로그인해주세요.');

      await supabase.auth.signOut();

      setTimeout(() => {
        window.location.href = '/';
      }, 1200);
    } catch (e) {
      setError(e.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg,#EDE9FF 0%,#F5F3FF 45%,#fff 100%)',
        padding: '40px 24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          borderRadius: 24,
          padding: '30px 24px',
          boxShadow: '0 8px 30px rgba(124,92,252,0.16)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="/boplan192.png"
            alt="보플랜"
            style={{
              width: 82,
              height: 82,
              borderRadius: 22,
              objectFit: 'cover',
              boxShadow: '0 12px 28px rgba(124,92,252,0.3)',
              marginBottom: 14,
            }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />

          <div
            style={{
              fontSize: 23,
              fontWeight: 900,
              color: COLORS.primary,
              marginBottom: 6,
            }}
          >
            비밀번호 재설정
          </div>

          <div
            style={{
              fontSize: 13,
              color: COLORS.textGray,
              lineHeight: 1.5,
            }}
          >
            새로 사용할 비밀번호를 입력해주세요.
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>새 비밀번호</label>
          <div style={inputWrapStyle}>
            <span style={iconStyle}>🔒</span>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="새 비밀번호"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={eyeButtonStyle}
            >
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>새 비밀번호 확인</label>
          <div style={inputWrapStyle}>
            <span style={iconStyle}>🔐</span>
            <input
              type={showPw ? 'text' : 'password'}
              value={passwordCheck}
              onChange={(e) => setPasswordCheck(e.target.value)}
              placeholder="새 비밀번호 확인"
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdatePassword();
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{ color: '#16A34A', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={handleUpdatePassword}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            background: loading
              ? COLORS.primaryLighter
              : 'linear-gradient(135deg,#9B7EFF,#7C3AED)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 900,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 20px rgba(124,92,252,0.32)',
          }}
        >
          {loading ? '변경 중...' : '비밀번호 변경하기'}
        </button>

        <button
          type="button"
          onClick={() => {
            window.location.href = '/';
          }}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '12px 0',
            borderRadius: 14,
            border: 'none',
            background: '#F5F3FF',
            color: COLORS.primary,
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          로그인 화면으로 돌아가기
        </button>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 800,
  color: '#4B5563',
  marginBottom: 7,
};

const inputWrapStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: '1.5px solid #E5E7EB',
  borderRadius: 14,
  padding: '0 12px',
  background: '#FAFAFA',
};

const iconStyle = {
  fontSize: 17,
  flexShrink: 0,
};

const inputStyle = {
  flex: 1,
  height: 48,
  border: 'none',
  background: 'transparent',
  outline: 'none',
  fontSize: 14,
  color: '#111827',
  fontFamily: 'inherit',
};

const eyeButtonStyle = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 16,
  padding: 0,
};
