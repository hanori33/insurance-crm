
import React from 'react';
import { COLORS } from '../constants';

export default function Modal({ visible, onClose, title, children }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 999999,  // ✅ 더 높게
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLORS.white, borderRadius: '24px 24px 0 0',
        width: '100%', maxWidth: 480, padding: '24px 20px 48px',
        maxHeight: '92vh', overflowY: 'auto',
        position: 'relative', zIndex: 999999,  // ✅ 추가
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}