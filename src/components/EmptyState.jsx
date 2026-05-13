
import React from 'react';
import { COLORS } from '../constants';

export default function EmptyState({ icon = '📋', message = '데이터가 없습니다', sub, action, actionLabel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: 12 }}>
      <div style={{ fontSize: 48 }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.textGray }}>{message}</div>
      {sub && <div style={{ fontSize: 13, color: COLORS.textLight, textAlign: 'center' }}>{sub}</div>}
      {action && (
        <button onClick={action} style={{
          marginTop: 8, padding: '10px 24px', borderRadius: 10, border: 'none',
          background: COLORS.primary, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}>{actionLabel || '추가하기'}</button>
      )}
    </div>
  );
}