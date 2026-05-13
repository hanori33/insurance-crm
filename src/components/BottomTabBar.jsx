// src/components/BottomTabBar.jsx
import React from 'react';
import { COLORS, TAB_LIST } from '../constants';

export default function BottomTabBar({ activeTab, onChange }) {
  return (
    <div style={{ display: 'flex', borderTop: `1px solid ${COLORS.border}`, background: COLORS.white, paddingBottom: 'env(safe-area-inset-bottom,6px)', flexShrink: 0 }}>
      {TAB_LIST.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 0 5px', background: 'none', border: 'none', cursor: 'pointer',
            color: active ? COLORS.primary : COLORS.textGray,
            fontSize: 10, fontWeight: active ? 700 : 400, gap: 3, position: 'relative',
          }}>
            {active && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 28, height: 3, borderRadius: '0 0 4px 4px', background: COLORS.primary }} />}
            <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}