
import React from 'react';
import { COLORS } from '../constants';

export default function Modal({ visible, onClose, title, children }) {
  if (!visible) return null;
  return (
    <div style={{
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: '#fff',
  borderRadius: 24,
  width: '90%',
  maxWidth: 520,
  maxHeight: '80vh',
  overflowY: 'auto',
  zIndex: 9999,

  boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
  border: '1px solid rgba(255,255,255,0.9)',

}}
 onClick={onClose}>
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