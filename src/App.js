// src/App.js
import InsuranceContactPage from './pages/InsuranceContactPage';
import React, { useState, useEffect } from 'react';
import { COLORS } from './constants';
import authService from './services/authService';

import LoginScreen     from './components/LoginScreen';
import BottomTabBar    from './components/BottomTabBar';
import { LoadingSpinner } from './components/Common';

import DashboardPage      from './pages/DashboardPage';
import CustomersPage      from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import SchedulePage       from './pages/SchedulePage';
import TeamPage           from './pages/TeamPage';
import MorePage           from './pages/MorePage';
import SalesPage          from './pages/SalesPage';
import NotificationsPage  from './pages/NotificationsPage';

// ── 모바일 감지 ───────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ── 모바일 앱 래퍼 ────────────────────────────
function MobileShell({ children }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#DDD8F5',
    }}>
      <div style={{
        width: '100%', maxWidth: 430,
        height: '100dvh', maxHeight: 900,
        background: COLORS.bg,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 60px rgba(0,0,0,0.25)',
        position: 'relative',
      }}>
        {children}
      </div>
    </div>
  );
}

// ── PC 웹 래퍼 ────────────────────────────────
function WebShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </div>
  );
}

export default function App() {
  const isMobile = useIsMobile();
  const [session, setSession]     = useState(undefined);
  const [activeTab, setActiveTab] = useState('home');
  const [stack, setStack]         = useState([]);

  useEffect(() => {
    authService.getSession().then(s => setSession(s));
    const { data: { subscription } } = authService.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setActiveTab('home'); setStack([]); }
    });
    return () => subscription.unsubscribe();
  }, []);

  function navigate(page, payload) { setStack(prev => [...prev, { page, payload }]); }
  function goBack()                { setStack(prev => prev.slice(0, -1)); }
  function changeTab(tab)          { setStack([]); setActiveTab(tab); }

  const user     = session?.user;
  const current  = stack[stack.length - 1];
  const hasStack = stack.length > 0;

  function renderStack() {
    if (!current) return null;
    switch (current.page) {
      case 'customerDetail': return <CustomerDetailPage customerId={current.payload?.id} onBack={goBack} />;
      case 'sales':          return <SalesPage onBack={goBack} />;
      case 'notifications':  return <NotificationsPage onBack={goBack} />;
      case 'insuranceContact': return <InsuranceContactPage onBack={goBack} />;
      default:               return null;
    }
  }

  function renderTab() {
    switch (activeTab) {
      case 'home':      return <DashboardPage user={user} onNavigate={navigate} />;
      case 'customers': return <CustomersPage onNavigate={navigate} />;
      case 'schedule':  return <SchedulePage />;
      case 'tree':      return <TeamPage />;
      case 'more':      return <MorePage user={user} onNavigate={navigate} />;
      default:          return <DashboardPage user={user} onNavigate={navigate} />;
    }
  }

  const isDashboard = !hasStack && activeTab === 'home';

  // ── 로딩 ─────────────────────────────────────
  if (session === undefined) {
    const Shell = isMobile ? MobileShell : WebShell;
    return (
      <Shell>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg }}>
          <LoadingSpinner size={48} />
        </div>
      </Shell>
    );
  }

  // ── 비로그인 ─────────────────────────────────
  if (!session) {
    const Shell = isMobile ? MobileShell : WebShell;
    return (
      <Shell>
                <div style={{ flex: 1, overflowY: 'auto' }}>
          <LoginScreen />
        </div>
      </Shell>
    );
  }

  // ── 모바일 앱 레이아웃 ────────────────────────
  if (isMobile) {
    return (
      <MobileShell>
        
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* 탭 페이지 */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            visibility: hasStack ? 'hidden' : 'visible',
          }}>
            {renderTab()}
          </div>
          {/* 스택 페이지 */}
          {hasStack && (
            <div style={{
              position: 'absolute', inset: 0,
              background: COLORS.bg,
              display: 'flex', flexDirection: 'column',
              zIndex: 10,
            }}>
              {renderStack()}
            </div>
          )}
        </div>
        {!hasStack && <BottomTabBar activeTab={activeTab} onChange={changeTab} />}
      </MobileShell>
    );
  }

  // ── PC 웹 레이아웃 ────────────────────────────
  return (
    <WebShell>
      {/* PC 상단 네비 */}
      <div style={{
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.border}`,
        padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60, flexShrink: 0,
        boxShadow: '0 2px 12px rgba(124,92,252,0.08)',
      }}>
        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/boplan192.png" alt="보플랜" style={{ width: 32, height: 32, borderRadius: 8 }}
            onError={e => { e.target.style.display = 'none'; }} />
          <span style={{ fontWeight: 800, fontSize: 20, color: COLORS.primary }}>보플랜</span>
        </div>

        {/* 탭 메뉴 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'home',      label: '홈'      },
            { id: 'customers', label: '고객'    },
            { id: 'schedule',  label: '일정'    },
            { id: 'tree',      label: '소개트리' },
            { id: 'more',      label: '더보기'  },
          ].map(tab => (
            <button key={tab.id} onClick={() => changeTab(tab.id)} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? COLORS.primaryBg : 'none',
              color: activeTab === tab.id ? COLORS.primary : COLORS.textGray,
              fontWeight: activeTab === tab.id ? 700 : 400, fontSize: 14,
            }}>{tab.label}</button>
          ))}
        </div>

        {/* 유저 */}
        <div style={{ fontSize: 13, color: COLORS.textGray }}>
          {user?.user_metadata?.display_name || user?.email}
        </div>
      </div>

      {/* PC 콘텐츠 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: COLORS.bg }}>
        <div style={{
          width: '100%',
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '0 24px',
        }}>
          {hasStack ? renderStack() : renderTab()}
        </div>
      </div>
    </WebShell>
  );
}