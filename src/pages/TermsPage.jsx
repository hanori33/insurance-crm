import React from 'react';
import { COLORS } from '../constants';

export default function TermsPage({ onBack }) {
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
        <button onClick={onBack} style={backButtonStyle}>←</button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>이용약관</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#F8F7FF' }}>
        <div style={heroCardStyle}>
          <h2 style={{ margin: 0, color: '#7C3AED' }}>📜 보플랜 이용약관</h2>
          <p style={{ marginTop: 12, color: COLORS.textGray, lineHeight: 1.7 }}>
            본 약관은 보플랜 서비스의 이용 조건과 회원의 권리, 의무 및 책임사항을 정합니다.
          </p>
        </div>

        <Section title="제1조 목적">
          <p>
            본 약관은 보플랜이 제공하는 보험설계사용 CRM 서비스의 이용과 관련하여
            서비스와 회원 간의 권리, 의무 및 책임사항을 규정하는 것을 목적으로 합니다.
          </p>
        </Section>

        <Section title="제2조 서비스 내용">
          <ul>
            <li>고객 정보 관리</li>
            <li>상담 기록 관리</li>
            <li>일정 관리</li>
            <li>보험 가입 이력 관리</li>
            <li>AI 병력분석 및 보험사전 기능</li>
            <li>알림, 백업, 문의 기능</li>
          </ul>
        </Section>

        <Section title="제3조 회원가입 및 계정 관리">
          <p>
            회원은 정확한 정보를 제공해야 하며, 계정 및 비밀번호 관리 책임은 회원에게 있습니다.
            계정 도용 또는 무단 사용이 의심되는 경우 즉시 서비스 관리자에게 알려야 합니다.
          </p>
        </Section>

        <Section title="제4조 회원의 책임">
          <ul>
            <li>회원은 관련 법령과 본 약관을 준수해야 합니다.</li>
            <li>타인의 개인정보를 무단으로 수집하거나 입력해서는 안 됩니다.</li>
            <li>주민등록번호, 계좌번호, 카드번호 등 민감정보 입력은 금지됩니다.</li>
            <li>서비스를 불법적이거나 부정한 목적으로 이용해서는 안 됩니다.</li>
          </ul>
        </Section>

        <Section title="제5조 AI 기능의 한계">
          <p>
            보플랜의 AI 병력분석 및 보험사전 기능은 상담 보조용 참고 자료입니다.
            AI 분석 결과는 실제 고지의무 판단, 보험사 인수심사 결과, 보험금 지급 여부를 보장하지 않습니다.
            최종 판단은 각 보험사의 약관, 심사 기준 및 관련 법령에 따라 달라질 수 있습니다.
          </p>
        </Section>

        <Section title="제6조 개인정보 보호">
          <p>
            서비스는 개인정보처리방침에 따라 회원 및 고객 정보를 보호합니다.
            회원은 고객정보를 입력할 때 적법한 권한과 목적이 있어야 하며,
            민감정보를 입력하지 않도록 주의해야 합니다.
          </p>
        </Section>

        <Section title="제7조 서비스 변경 및 중단">
          <p>
            서비스는 운영상 필요에 따라 기능을 변경하거나 일시적으로 중단할 수 있습니다.
            중요한 변경사항은 서비스 내 공지사항 등을 통해 안내합니다.
          </p>
        </Section>

        <Section title="제8조 면책사항">
          <ul>
            <li>회원이 입력한 정보의 정확성에 대한 책임은 회원에게 있습니다.</li>
            <li>AI 분석 결과를 근거로 한 상담, 계약, 청구 결과에 대해 서비스는 보장하지 않습니다.</li>
            <li>천재지변, 외부 서비스 장애, 통신 장애 등으로 인한 서비스 이용 장애에 대해 책임이 제한될 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="제9조 문의">
          <p>
            서비스 이용 및 약관 관련 문의는 아래 이메일로 연락해 주세요.
            <br />
            hanori33@gmail.com
          </p>
        </Section>

        <Section title="사업자 정보">
          <p><b>상호명</b> : 보플랜</p>
          <p><b>대표자</b> : 박하늘</p>
          <p><b>사업자등록번호</b> : 558-05-03331</p>
          <p><b>주소</b> : 경기도 시흥시</p>
        </Section>

        <div style={{ textAlign: 'center', marginTop: 24, color: COLORS.textGray, fontSize: 13 }}>
          시행일 : 2026-06-08
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitleStyle}>{title}</h3>
      <div style={sectionContentStyle}>{children}</div>
    </div>
  );
}

const backButtonStyle = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: 18,
};

const heroCardStyle = {
  background: '#fff',
  borderRadius: 18,
  padding: 20,
  boxShadow: '0 6px 20px rgba(124,58,237,0.08)',
  marginBottom: 16,
};

const sectionStyle = {
  background: '#fff',
  borderRadius: 18,
  padding: 18,
  marginBottom: 14,
  boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
};

const sectionTitleStyle = {
  marginTop: 0,
  color: '#7C3AED',
  fontSize: 16,
};

const sectionContentStyle = {
  color: '#444',
  lineHeight: 1.8,
  fontSize: 14,
};