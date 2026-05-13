
import React from 'react';
import { COLORS } from '../constants';

export default function StatCard({ icon, label, value, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: COLORS.bgGray, borderRadius: 14, padding: '12px 4px', gap: 6, cursor: onClick ? 'pointer' : 'default', flex: 1 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: COLORS.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 10, color: COLORS.textGray, textAlign: 'center' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.text, textAlign: 'center', lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}