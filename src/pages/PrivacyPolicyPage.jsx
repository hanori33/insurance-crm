import React from 'react';
import { COLORS } from '../constants';

export default function PrivacyPolicyPage({ onBack }) {
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
          개인정보처리방침
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          lineHeight: 1.7,
          color: COLORS.text,
        }}
      >
        <h3>보플랜 개인정보처리방침</h3>

        <p>
          보플랜은 보험설계사를 위한 CRM 서비스로,
          회원가입 및 서비스 제공을 위해 최소한의 개인정보만 수집합니다.
        </p>

        <h4>1. 수집하는 정보</h4>
        <ul>
          <li>이메일 주소</li>
          <li>이름</li>
          <li>프로필 사진(선택)</li>
          <li>서비스 이용 기록</li>
        </ul>

        <h4>2. 이용 목적</h4>
        <ul>
          <li>회원 식별 및 로그인</li>
          <li>고객 관리 서비스 제공</li>
          <li>일정 및 상담기록 관리</li>
          <li>서비스 개선</li>
        </ul>

        <h4>3. 보관 기간</h4>
        <p>
          회원 탈퇴 시 관련 개인정보는 즉시 삭제되며,
          법령에 따라 보관이 필요한 경우에만 일정 기간 보관됩니다.
        </p>

        <h4>4. 개인정보 보호</h4>
        <p>
          보플랜은 Supabase 기반 보안 정책 및 접근 권한 관리(RLS)를 적용하여
          사용자 정보를 보호합니다.
        </p>

        <h4>5. 문의</h4>
        <p>
          개인정보 관련 문의는 관리자에게 연락해 주세요.
        </p>

        <div style={{ marginTop: 30, color: COLORS.textGray, fontSize: 13 }}>
          시행일: 2026-05-25
        </div>
      </div>
    </div>
  );
}