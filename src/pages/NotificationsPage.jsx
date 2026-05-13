
import React from 'react';
import { COLORS } from '../constants';
import { Card } from '../components/Common';

const MOCK = [
  { id: 1, icon: '📅', title: '오늘 일정 알림',   body: '10:00 김하늘 고객 상담이 있습니다',        time: '방금 전' },
  { id: 2, icon: '⚠️', title: '고객 유지 알림',   body: '이민수 고객 계약 만료가 30일 남았습니다',   time: '1시간 전' },
  { id: 3, icon: '👤', title: '새 고객 등록',      body: '박지영 고객이 등록되었습니다',             time: '3시간 전' },
];

export default function NotificationsPage({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: COLORS.white, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>알림</span>
        <span style={{ fontSize: 13, color: COLORS.primary, cursor: 'pointer', fontWeight: 600 }}>모두 읽음</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MOCK.map(n => (
          <Card key={n.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: COLORS.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{n.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{n.title}</div>
              <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>{n.time}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}