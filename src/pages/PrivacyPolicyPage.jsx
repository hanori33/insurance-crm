import React from 'react';
import { COLORS } from '../constants';

export default function PrivacyPolicyPage({ onBack }) {
return (
<div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F8F7FF' }}>
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
{onBack ? (
  <button
    onClick={onBack}
    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}
  >
    ←
  </button>
) : (
  <a href="/" style={{ color: COLORS.primary, textDecoration: 'none', fontWeight: 700 }}>
    보플랜 홈
  </a>
)}

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
      width: '100%',
      maxWidth: 900,
      margin: '0 auto',
      boxSizing: 'border-box',
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
        보플랜은 보험설계사를 위한 CRM 서비스로서 이용자와 이용자가 관리하는
        고객의 개인정보를 중요하게 생각하며 관련 법령을 준수합니다.
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
          <li>고객 정보(이름, 연락처, 생년월일, 주소, 직업 등)</li>
          <li>병력, 질병명, 진단·수술·입원 정보 등 건강 관련 정보</li>
          <li>상담 내용, 상담 메모 및 보험금 청구 관련 기록</li>
          <li>일정 정보</li>
          <li>보험 가입 이력, 보장 내용 및 증권 분석 결과</li>
          <li>업로드한 보험증권, 보험금 청구서류 및 팩스 첨부파일</li>
          <li>팩스 발송 이력, 수신처, 발송 상태 및 접수번호</li>
          <li>로그인, 알림 설정 등 서비스 이용 기록</li>
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
          <li>보험증권 분석, 병력 분석, 상담 요약 등 AI 기능 제공</li>
          <li>보험금 청구서류의 팩스 발송 및 발송 이력 관리</li>
          <li>서비스 개선 및 오류 수정</li>
          <li>고객 문의 응대</li>
        </ul>
      }
    />

    <Section
      title="🩺 고객정보 및 민감정보 처리"
      content={
        <>
          <p>
            이용자는 고객 관리와 보험 상담을 위해 고객의 개인정보 및 병력·건강정보를
            입력할 수 있습니다. 이용자는 해당 정보를 보플랜에 입력하거나 처리할 적법한
            권한과 동의를 확보해야 합니다.
          </p>
          <p>
            주민등록번호, 신용카드번호 등 서비스 제공에 필요하지 않은 고유식별정보나
            금융정보는 입력하지 않아야 합니다.
          </p>
        </>
      }
    />

    <Section
      title="📄 파일 업로드 및 보관"
      content={
        <p>
          보험증권 및 팩스 첨부파일은 비공개 Supabase Storage에 저장됩니다. 증권파일은
          고객별 폴더에서 관리되며, 팩스 첨부파일은 발송 처리를 위해 임시 저장된 후
          발송 요청이 종료되면 삭제됩니다. 계정 삭제 시 계정과 연결된 고객별 증권파일과
          팩스파일도 함께 삭제합니다.
        </p>
      }
    />

    <Section
      title="🤖 AI 분석"
      content={
        <>
          <p>
            이용자가 AI 분석을 실행하면 고객명, 상담 내용, 병력·질병 정보 및 증권에서
            추출된 내용이 분석 결과 생성을 위해 OpenAI에 전송될 수 있습니다.
          </p>
          <p>
            AI 결과는 보험 상담을 돕기 위한 참고자료이며 의료 진단, 치료 또는 보험금
            지급을 보장하지 않습니다. 중요한 판단은 전문가와 관련 기관의 확인을 받아야 합니다.
          </p>
        </>
      }
    />

    <Section
      title="📠 팩스 발송"
      content={
        <p>
          이용자가 팩스 발송을 요청하면 수신 팩스번호, 수신처명 및 첨부파일이 팩스
          발송 대행사인 팝빌에 전달됩니다. 발송 결과 확인과 중복 발송 방지를 위해
          접수번호, 발송 상태, 발송 장수 및 발송 이력이 저장될 수 있습니다.
        </p>
      }
    />

    <Section
      title="🗄 보관 기간"
      content={
        <p>
          회원 탈퇴 시 계정, 고객정보, 상담·일정·매출·증권·팩스 이력 및 연결된 파일은
          지체 없이 삭제됩니다. 관련 법령에 따라 보관이 필요한 정보는 해당 법령에서
          정한 기간 동안 분리 보관한 후 삭제합니다.
        </p>
      }
    />

    <Section
      title="🗑 계정 및 개인정보 삭제"
      content={
        <>
          <p>
            로그인 후 <b>설정 → 계정 삭제</b>에서 계정과 관련 데이터를 직접 삭제할 수
            있습니다. 로그인이 어려운 경우 개인정보 문의 이메일로 삭제를 요청할 수 있습니다.
          </p>
          <p>
            삭제가 완료되면 인증 계정과 고객정보, 상담·일정·매출 기록, 증권·팩스 이력 및
            연결된 Storage 파일은 복구할 수 없습니다.
          </p>
        </>
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
          <li>OpenAI (보험증권·병력·상담 AI 분석)</li>
          <li>Firebase (푸시 알림)</li>
          <li>팝빌 (이용자가 요청한 팩스 발송)</li>
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
      시행일 : 2026-06-18
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
