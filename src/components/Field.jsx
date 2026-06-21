
import React from 'react';
import { COLORS } from '../constants';

export default function Field({ icon, placeholder, value, onChange, type = 'text', right, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      border: `1.5px solid ${COLORS.border}`, borderRadius: 12,
      padding: '12px 16px', background: '#FAFAFA', marginBottom: 10,
      width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box',
      overflow: 'hidden', position: 'relative', ...style,
    }}>
      {icon && <span style={{ color: COLORS.textGray, fontSize: 16, flexShrink: 0 }}>{icon}</span>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ border: 'none', background: 'none', outline: 'none', flex: 1, width: '100%', minWidth: 0, fontSize: 14, color: COLORS.text, fontFamily: 'inherit' }} />
      {right && <span style={{ display: 'flex', flexShrink: 0 }}>{right}</span>}
    </div>
  );
}
