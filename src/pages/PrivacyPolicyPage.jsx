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
← </button>

    <span style={{ fontWeight: 700, fontSize: 17 }}>
      개인정보처리방침
    </span>
  </div>

  <div
    style={{
      flex: 1,
      overflowY: 'auto',
      padding: 20,
      background: '#F8F7FF',
    }}
  >
    <div
      style={{
        background: '#fff',
        borderRadius: 18,
        padding: 20,
        boxShadow: '0 6px 20px rgba(124,58,237,0.08)',
        marginBottom: 16,
      }}
    >
      <h2 style={{ margin: 0, color: '#7C3AED' }}>
        🔐 보플랜 개인정보처리방침
      </h2>

      <p
        style={{
          marginTop: 12,
          color: COLORS.textGray,
          lineHeight: 1.7,
        }}
      >
        보플랜은 보험설계사를 위한 CRM 서비스로서
        이용자의 개인정보를 중요하게 생각하며 관련 법령을 준수합니다.
      </p>
    </div>

    <Section
      title="🏢 개인정보처리자 정보"
      content={
        <>
          <p><b>상호명</b> : 보플랜</p>
          <p><b>대표자</b> : 박하늘</p>
          <p><b>사업자등록번호</b> : 558-05-03331</p>
          <p><b>주소</b> : 경기도 시흥시</p>
          <p><b>문의</b> : hanori33@gmail.com</p>
        </>
      }
    />

    <Section
      title="📋 수집하는 개인정보"
      content={
        <ul>
          <li>이메일 주소</li>
          <li>이름</li>
          <li>프로필 사진(선택)</li>
          <li>고객 정보(이름, 연락처, 생년월일 등)</li>
          <li>상담 기록</li>
          <li>일정 정보</li>
          <li>보험 가입 이력</li>
          <li>서비스 이용 기록</li>
        </ul>
      }
    />

    <Section
      title="🎯 개인정보 이용 목적"
      content={
        <ul>
          <li>회원 식별 및 로그인</li>
          <li>고객 관리 서비스 제공</li>
          <li>일정 및 상담 기록 관리</li>
          <li>AI 병력분석 기능 제공</li>
          <li>서비스 개선 및 오류 수정</li>
          <li>고객 문의 응대</li>
        </ul>
      }
    />

    <Section
      title="🗄 보관 기간"
      content={
        <p>
          회원 탈퇴 시 개인정보는 지체 없이 삭제되며,
          관련 법령에 따라 보관이 필요한 경우에만 일정 기간 보관됩니다.
        </p>
      }
    />

    <Section
      title="🛡 개인정보 보호"
      content={
        <ul>
          <li>Supabase 기반 데이터 보안</li>
          <li>RLS(Row Level Security) 적용</li>
          <li>HTTPS 암호화 통신</li>
          <li>사용자별 데이터 접근 제한</li>
        </ul>
      }
    />

    <Section
      title="🤖 외부 서비스 이용"
      content={
        <ul>
          <li>Supabase (데이터 저장 및 인증)</li>
          <li>OpenAI (AI 병력분석 기능)</li>
          <li>Firebase (푸시 알림)</li>
        </ul>
      }
    />

    <Section
      title="📩 문의"
      content={
        <p>
          개인정보 관련 문의는 아래 이메일로 연락해 주세요.
          <br />
          hanori33@gmail.com
        </p>
      }
    />

    <div
      style={{
        textAlign: 'center',
        marginTop: 24,
        color: COLORS.textGray,
        fontSize: 13,
      }}
    >
      시행일 : 2026-06-08
    </div>
  </div>
</div>

);
}

function Section({ title, content }) {
return (
<div
style={{
background: '#fff',
borderRadius: 18,
padding: 18,
marginBottom: 14,
boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
}}
>
<h3
style={{
marginTop: 0,
color: '#7C3AED',
fontSize: 16,
}}
>
{title} </h3>


  <div
    style={{
      color: '#444',
      lineHeight: 1.8,
      fontSize: 14,
    }}
  >
    {content}
  </div>
</div>


);
}
