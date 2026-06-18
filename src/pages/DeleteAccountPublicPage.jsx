import React from 'react';

export default function DeleteAccountPublicPage() {
  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: 30,
        lineHeight: 1.8,
      }}
    >
      <h1>계정 삭제 안내</h1>

      <p>
        보플랜(BOPLAN)은 사용자가 직접 계정을 삭제할 수 있는 기능을 제공합니다.
      </p>

      <h2>계정 삭제 방법</h2>

      <p>
        앱 실행 후 아래 경로로 이동하세요.
      </p>

      <p>
        <b>더보기 → 계정 삭제</b>
      </p>

      <p>
        계정 삭제 화면에서 "계정삭제" 문구를 입력한 후 삭제를 진행할 수 있습니다.
      </p>

      <h2>계정 삭제 시 삭제되는 데이터</h2>

      <ul>
        <li>프로필 정보</li>
        <li>고객 정보</li>
        <li>상담 기록</li>
        <li>일정 정보</li>
        <li>매출 기록</li>
        <li>증권 파일 및 분석 결과</li>
        <li>팩스 발송 이력</li>
        <li>알림 토큰</li>
        <li>권한 신청 정보</li>
        <li>앱 로그인 계정(Auth)</li>
      </ul>

      <p>
        삭제된 데이터는 복구할 수 없습니다.
      </p>

      <h2>문의</h2>

      <p>
        이메일: gksmf629@naver.com
      </p>

      <hr />

      <p>
        최종 업데이트: 2026년 6월
      </p>

      <p>
        보플랜(BOPLAN)
      </p>
    </div>
  );
}