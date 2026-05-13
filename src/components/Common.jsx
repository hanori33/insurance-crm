
import React from 'react';
import { COLORS, STATUS_CONFIG } from '../constants';

export function Avatar({ name = '?', size = 40, src }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #C4B5FD, #8B5CF6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38,
      flexShrink: 0, userSelect: 'none',
    }}>
      {(name || '?').charAt(0)}
    </div>
  );
}

export function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG['상담중'];
  return (
    <span style={{ background: c.bg, color: c.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {c.label}
    </span>
  );
}

export function Divider({ style }) {
  return <div style={{ height: 1, background: COLORS.border, ...style }} />;
}

export function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background: COLORS.white, borderRadius: 16, padding: 16, boxShadow: `0 2px 14px rgba(124,92,252,0.10)`, ...style }}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, onViewAll }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{title}</span>
      {onViewAll && <button onClick={onViewAll} style={{ background: 'none', border: 'none', color: COLORS.textGray, fontSize: 12, cursor: 'pointer' }}>전체 보기 &gt;</button>}
    </div>
  );
}

export function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
      background: active ? COLORS.primary : COLORS.white,
      color: active ? '#fff' : COLORS.textGray,
      fontWeight: active ? 700 : 400, fontSize: 13,
      boxShadow: active ? 'none' : `inset 0 0 0 1px ${COLORS.border}`,
    }}>{label}</button>
  );
}

export function LoadingSpinner({ size = 32 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: size, height: size, border: `3px solid ${COLORS.primaryBg}`, borderTop: `3px solid ${COLORS.primary}`, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function EmptyState({ icon = '📋', message = '데이터가 없습니다', sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', gap: 10 }}>
      <div style={{ fontSize: 44 }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.textGray }}>{message}</div>
      {sub && <div style={{ fontSize: 13, color: COLORS.textLight, textAlign: 'center' }}>{sub}</div>}
    </div>
  );
}