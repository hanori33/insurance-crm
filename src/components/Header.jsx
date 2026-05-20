// src/components/Header.jsx
import React, { useState } from 'react';
import { COLORS } from '../constants';
import { Avatar } from './Common';

export default function Header({ user, notifCount = 0, onNotif, onProfile, onNavigate }) {
  const name = user?.user_metadata?.display_name || user?.email || '?';
  const photoUrl = user?.user_metadata?.photo_url || '';
  const [drawerOpen, setDrawerOpen] = useState(false);

  const menuItems = [
    { id: 'home',             icon: '🏠', label: '홈'           },
    { id: 'notices',          icon: '📢', label: '공지사항'     },
    { id: 'notifications',    icon: '🔔', label: '알림 센터'    },
    { id: 'customers',        icon: '👥', label: '고객 관리'    },
    { id: 'schedule',         icon: '📅', label: '일정 관리'    },
    { id: 'sales',            icon: '📊', label: '통계 / 분석'  },
    { id: 'consulting',       icon: '📝', label: '상담 기록'    },
    { id: 'tree',             icon: '🌳', label: '소개 트리'    },
    { id: 'team',             icon: '👨‍👩‍👧', label: '팀 관리'     },
    { id: 'fax',              icon: '📠', label: '보험팩스청구'  },
    { id: 'insuranceContact', icon: '📞', label: '보험사 연락처' },
    { id: 'roleRequest',      icon: '🔑', label: '권한 신청'    },
    { id: 'more',             icon: '⚙️', label: '설정'         },
  ];

  return (
    <>
      <div style={{
  background: 'linear-gradient(160deg,#EDE9FF,#F3EEFF)',
  padding: '0 20px 16px',
  flexShrink: 0,
  position: 'relative',  // ✅ 추가
  zIndex: 10,            // ✅ 추가
}}>
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12,
    position: 'relative',
  }}>
    {/* 햄버거 메뉴 */}
    <button
      onClick={() => setDrawerOpen(true)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 24 }}
    >
      ☰
    </button>

    {/* 로고 - 중앙 고정 */}
<div style={{
  position: 'absolute',
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 8,
  pointerEvents: 'none',
}}>
  <img
    src="/boplan192.png"
    alt="보플랜"
    style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', pointerEvents: 'none' }}
    onError={e => {
      e.target.style.display = 'none';
      e.target.nextSibling.style.display = 'flex';
    }}
  />
  <div style={{
    display: 'none', width: 32, height: 32, borderRadius: 8,
    background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
    alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 900, fontSize: 16,
  }}>b</div>
  <span style={{ fontWeight: 800, fontSize: 18, color: COLORS.primary, letterSpacing: -0.3, pointerEvents: 'none' }}>
    보플랜
  </span>
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
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <Avatar name={name} size={42} />
        )}
      </button>
    </div>
  </div>
</div>

{/* 드로어 오버레이 */}
{drawerOpen && (
  <div
    onClick={() => setDrawerOpen(false)}
    style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', zIndex: 200,
    }}
  />
)}

{/* 드로어 */}
<div style={{
  position: 'fixed', top: 0, left: 0, bottom: 0,
  width: 260,
  background: '#fff',
  zIndex: 201,
  transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
  transition: 'transform 0.25s ease',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: drawerOpen ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
}}>
  {/* 드로어 헤더 */}
  <div style={{
    background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
    padding: '48px 20px 20px',
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    {photoUrl ? (
      <img src={photoUrl} alt={name}
        style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }}
      />
    ) : (
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'rgba(255,255,255,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 900, fontSize: 20,
      }}>
        {name.charAt(0)}
      </div>
    )}
    <div>
      <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{name}</div>
      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
        {user?.user_metadata?.position || '보플랜'}
      </div>
    </div>
  </div>

  {/* 메뉴 목록 */}
  <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
    {menuItems.map(item => (
      <button
        key={item.id}
        onClick={() => {
          onNavigate(item.id);
          setDrawerOpen(false);
        }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: 12, padding: '12px 14px', borderRadius: 12, border: 'none',
          background: 'transparent', cursor: 'pointer',
          textAlign: 'left', marginBottom: 2, fontSize: 14,
          color: COLORS.text,
        }}
      >
        <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{item.icon}</span>
        {item.label}
      </button>
    ))}
  </div>

  {/* 닫기 버튼 */}
  <button
    onClick={() => setDrawerOpen(false)}
    style={{
      margin: '12px 16px 32px',
      padding: '12px 0',
      borderRadius: 12, border: 'none',
      background: COLORS.primaryBg, color: COLORS.primary,
      fontSize: 14, fontWeight: 700, cursor: 'pointer',
    }}
  >
    닫기
  </button>
</div>
</>
);
}