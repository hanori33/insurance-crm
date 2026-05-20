/// src/components/Header.jsx
import React, { useState } from 'react';
import { COLORS } from '../constants';
import { Avatar } from './Common';

export default function Header({
  user,
  notifCount = 0,
  onNotif,
  onProfile,
  onNavigate,
}) {
  const name = user?.user_metadata?.display_name || user?.email || '?';
  const photoUrl = user?.user_metadata?.photo_url || '';
  const [drawerOpen, setDrawerOpen] = useState(false);

  const menuItems = [
    { id: 'home',             icon: '🏠', label: '홈' },
    { id: 'notices',          icon: '📢', label: '공지사항' },
    { id: 'notifications',    icon: '🔔', label: '알림 센터' },
    { id: 'customers',        icon: '👥', label: '고객 관리' },
    { id: 'schedule',         icon: '📅', label: '일정 관리' },
    { id: 'consulting',       icon: '📝', label: '상담 기록' },
    { id: 'sales',            icon: '📊', label: '통계 / 분석' },
    { id: 'tree',             icon: '🌳', label: '소개 트리' },
    { id: 'team',             icon: '👨‍👩‍👧', label: '팀 관리' },
    { id: 'fax',              icon: '📠', label: '보험팩스청구' },
    { id: 'insuranceContact', icon: '📞', label: '보험사 연락처' },
    { id: 'roleRequest',      icon: '🔑', label: '권한 신청' },
    { id: 'more',             icon: '⚙️', label: '설정' },
  ];

  return (
    <>
      {/* 상단 헤더 */}
      <div
        style={{
          background: 'linear-gradient(160deg,#EDE9FF,#F3EEFF)',
          padding: '0 20px 16px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 30,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 12,
            position: 'relative',
            minHeight: 52,
          }}
        >
          {/* 햄버거 */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.primary,
              width: 46,
              height: 46,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              borderRadius: 14,
              flexShrink: 0,
              zIndex: 2,
            }}
          >
            ☰
          </button>

          {/* 중앙 로고 */}
          <div
            onClick={() => {
              onNavigate?.('home');
              setDrawerOpen(false);
            }}
            style={{
              position: 'absolute',
left: '50%',
transform: 'translateX(-50%)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <img
              src="/boplan192.png"
              alt="보플랜"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                objectFit: 'cover',
                flexShrink: 0,
              }}
              onError={(e) => {
                e.target.style.display = 'none';

                if (e.target.nextSibling) {
                  e.target.nextSibling.style.display = 'flex';
                }
              }}
            />

            <div
              style={{
                display: 'none',
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              B
            </div>

            <span
              style={{
                fontWeight: 900,
                fontSize: 20,
                color: COLORS.primary,
                letterSpacing: -0.4,
              }}
            >
              보플랜
            </span>
          </div>

          {/* 우측 */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexShrink: 0,
              zIndex: 2,
            }}
          >
            {/* 알림 */}
            <button
              onClick={onNotif}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                padding: 0,
                width: 42,
                height: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 24 }}>🔔</span>

              {notifCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 1,
                    right: 0,
                    background: COLORS.red,
                    color: '#fff',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 5px',
                    minWidth: 16,
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}
                >
                  {notifCount}
                </span>
              )}
            </button>

            {/* 프로필 */}
            <button
              onClick={onProfile}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={name}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <Avatar name={name} size={42} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 오버레이 */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            zIndex: 200,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* 드로어 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 270,
          background: '#fff',
          zIndex: 201,
          transform: drawerOpen
            ? 'translateX(0)'
            : 'translateX(-100%)',
          transition: 'transform 0.24s ease',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: drawerOpen
            ? '4px 0 24px rgba(0,0,0,0.18)'
            : 'none',
        }}
      >
        {/* 드로어 헤더 */}
        <div
          style={{
            background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
            padding: '54px 20px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #fff',
              }}
            />
          ) : (
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 900,
                fontSize: 20,
              }}
            >
              {name.charAt(0)}
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: '#fff',
                fontWeight: 900,
                fontSize: 16,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </div>

            <div
              style={{
                color: 'rgba(255,255,255,0.82)',
                fontSize: 12,
                marginTop: 3,
              }}
            >
              {user?.user_metadata?.position || '보플랜'}
            </div>
          </div>
        </div>

        {/* 메뉴 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 8px',
          }}
        >
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate?.(item.id);
                setDrawerOpen(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 14px',
                borderRadius: 14,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                marginBottom: 4,
                fontSize: 15,
                color: COLORS.text,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  fontSize: 21,
                  width: 30,
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>

              {item.label}
            </button>
          ))}
        </div>

        {/* 닫기 */}
        <button
          onClick={() => setDrawerOpen(false)}
          style={{
            margin: '12px 16px 32px',
            padding: '13px 0',
            borderRadius: 14,
            border: 'none',
            background: COLORS.primaryBg,
            color: COLORS.primary,
            fontSize: 15,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>
    </>
  );
}