// src/components/Header.jsx
import React from 'react';
import { COLORS } from '../constants';
import { Avatar } from './Common';

export default function Header({ user, notifCount = 0, onNotif, onProfile }) {
  const name = user?.user_metadata?.display_name || user?.email || '?';
  return (
    <div style={{
      background: 'linear-gradient(160deg,#EDE9FF,#F3EEFF)',
      padding: '0 20px 16px',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 12,
      }}>
        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src="/boplan192.png"
            alt="보플랜"
            style={{
              width: 32, height: 32,
              borderRadius: 8,
              objectFit: 'cover',
            }}
            onError={e => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          {/* fallback */}
          <div style={{
            display: 'none',
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 16,
          }}>b</div>

          <span style={{
            fontWeight: 800, fontSize: 18,
            color: COLORS.primary, letterSpacing: -0.3,
          }}>보플랜</span>
        </div>

        {/* 알림 + 프로필 */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={onNotif} style={{
            background: 'none', border: 'none',
            cursor: 'pointer', position: 'relative', lineHeight: 1,
          }}>
            <span style={{ fontSize: 22 }}>🔔</span>
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: COLORS.red, color: '#fff',
                borderRadius: 10, fontSize: 9, fontWeight: 700,
                padding: '1px 4px', minWidth: 14, textAlign: 'center',
              }}>{notifCount}</span>
            )}
          </button>
          <button onClick={onProfile} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Avatar name={name} size={32} />
          </button>
        </div>
      </div>
    </div>
  );
}