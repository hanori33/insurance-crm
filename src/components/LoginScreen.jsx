
import React, { useEffect, useState } from 'react';
import { COLORS } from '../constants';
import authService from '../services/authService';
import { validateSignupName } from '../utils';
import Field from './Field';

function Logo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 40 }}>
      <img
        src="/boplan192.png"
        alt="보플랜 로고"
        style={{
          width: 100,
          height: 100,
          borderRadius: 26,
          boxShadow: '0 14px 36px rgba(124,92,252,0.38)',
          display: 'block',
          margin: '0 auto 16px',
          objectFit: 'cover',
        }}
        onError={e => {
          // 이미지 로드 실패시 텍스트 로고로 fallback
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
      {/* fallback - 이미지 없을 때만 표시 */}
      <div style={{
        display: 'none',
        width: 100, height: 100, borderRadius: 26,
        background: 'linear-gradient(135deg,#9B7EFF,#7C3AED)',
        alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
        boxShadow: '0 14px 36px rgba(124,92,252,0.38)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, left: -20, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.18)' }} />
        <span style={{ color: '#fff', fontSize: 48, fontWeight: 900, lineHeight: 1 }}>b</span>
      </div>

      <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.primary, letterSpacing: -0.5 }}>보플랜</div>
      <div style={{ fontSize: 14, color: COLORS.textGray, marginTop: 4 }}>보험 설계사를 위한 스마트 CRM</div>
    </div>
  );
}

function PasswordVisibilityIcon({ visible }) {
  return visible ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.6 10.7A2 2 0 0013.3 13.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 8.5 4.4 9 6.2.1.5.1 1.1 0 1.6a11.8 11.8 0 01-2.1 3.6M6.2 6.2A12.2 12.2 0 003 11.2c-.1.5-.1 1.1 0 1.6C3.5 14.6 6.8 19 12 19c1.3 0 2.5-.3 3.5-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 11.2C3.5 9.4 6.8 5 12 5s8.5 4.4 9 6.2c.1.5.1 1.1 0 1.6C20.5 14.6 17.2 19 12 19s-8.5-4.4-9-6.2a3.7 3.7 0 010-1.6z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default function LoginScreen() {
  const [mode, setMode]       = useState('login');
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [name, setName]       = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [saveId, setSaveId]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
useEffect(() => {
  const savedEmail = localStorage.getItem('savedEmail');

  if (savedEmail) {
    setEmail(savedEmail);
    setSaveId(true);
  }
}, []);
  const reset = () => { setError(''); setSuccess(''); };

  async function handle() {
  reset();
  setLoading(true);

  try {
    if (mode === 'login') {
      await authService.signIn(email, pw);

      if (saveId) {
        localStorage.setItem('savedEmail', email);
      } else {
        localStorage.removeItem('savedEmail');
      }
    }

    if (mode === 'signup') {
      const nameValidation = validateSignupName(name, email);
      if (!nameValidation.valid) throw new Error(nameValidation.error);

      setName(nameValidation.name);
      if (pw.length < 8) throw new Error('비밀번호는 8자 이상 입력해주세요.');
      if (pw !== pwConfirm) throw new Error('비밀번호가 일치하지 않습니다.');
      await authService.signUp(email, pw, nameValidation.name);
      setSuccess('이메일 인증 후 로그인해주세요.');
      setMode('login');
    }

    if (mode === 'reset') {
      await authService.resetPassword(email);
      setSuccess('비밀번호 재설정 이메일을 발송했습니다.');
      setMode('login');
    }
  } catch (e) {
    setError(e.message || '오류가 발생했습니다');
  } finally {
    setLoading(false);
  }
}
  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg,#EDE9FF 0%,#F5F3FF 45%,#fff 100%)',
      padding: '40px 24px',
      boxSizing: 'border-box',
      overflowX: 'hidden',
    }}>
      <Logo />

      <div style={{
        background: '#fff', borderRadius: 22, padding: '28px 24px',
        width: '100%', maxWidth: 408, boxSizing: 'border-box',
        boxShadow: '0 6px 28px rgba(124,92,252,0.14)',
        overflow: 'hidden',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 22, color: COLORS.text }}>
          {mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '비밀번호 찾기'}
        </div>

        {mode === 'signup' && (
          <Field icon="👤" placeholder="이름" value={name} onChange={e => setName(e.target.value)} />
        )}
       <Field
  icon="✉️"
  placeholder="이메일"
  value={email}
  onChange={e => {
    const value = e.target.value;
    setEmail(value);

    if (saveId) {
      localStorage.setItem('savedEmail', value);
    }
  }}
  type="email"
/>
        {mode !== 'reset' && (
          <Field
            icon="🔒"
            placeholder="비밀번호"
            value={pw}
            onChange={e => setPw(e.target.value)}
            type={showPw ? 'text' : 'password'}
            right={
              <button
                type="button"
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                onClick={() => setShowPw(!showPw)}
                style={{
                  width: 28,
                  height: 28,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: COLORS.textGray,
                }}
              >
                <PasswordVisibilityIcon visible={showPw} />
              </button>
            }
          />
        )}

        {mode === 'signup' && (
          <Field
            icon="🔒"
            placeholder="비밀번호 확인"
            value={pwConfirm}
            onChange={e => setPwConfirm(e.target.value)}
            type={showPw ? 'text' : 'password'}
          />
        )}

        {mode === 'login' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: COLORS.textGray }}>
              <input
  type="checkbox"
  checked={saveId}
  onChange={e => {
    const checked = e.target.checked;
    setSaveId(checked);

    if (checked) {
      localStorage.setItem('savedEmail', email);
    } else {
      localStorage.removeItem('savedEmail');
    }
  }}
  style={{ accentColor: COLORS.primary }}
/>
              아이디 저장
            </label>
            <button onClick={() => { setMode('reset'); reset(); }}
              style={{ background: 'none', border: 'none', color: COLORS.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              비밀번호 찾기
            </button>
          </div>
        )}

        {error   && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
        {success && <div style={{ color: COLORS.green, fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{success}</div>}

        <button onClick={handle} disabled={loading} style={{
          width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
          background: loading ? COLORS.primaryLighter : 'linear-gradient(135deg,#9B7EFF,#7C3AED)',
          color: '#fff', fontSize: 16, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 18px rgba(124,92,252,0.38)',
        }}>
          {loading ? '처리 중...' : mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '이메일 발송'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: COLORS.textGray }}>
          {mode === 'login' ? (
            <>
              아직 계정이 없으신가요?{' '}
              <span onClick={() => { setMode('signup'); setPwConfirm(''); reset(); }}
                style={{ color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>
                회원가입
              </span>
            </>
          ) : (
            <span onClick={() => { setMode('login'); setPwConfirm(''); reset(); }}
              style={{ color: COLORS.primary, fontWeight: 700, cursor: 'pointer' }}>
              ← 로그인으로 돌아가기
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 28, fontSize: 12, color: COLORS.textLight }}>© 2026 보플랜. All rights reserved.</div>
    </div>
  );
}
