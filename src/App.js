/// src/App.js
import InsuranceContactPage from './pages/InsuranceContactPage';
import React, { useState, useEffect } from 'react';
import { COLORS } from './constants';
import authService from './services/authService';
import scheduleService from './services/scheduleService';
import customerService from './services/customerService'; // ✅ 추가
import { formatDateKorean } from './utils';
import LoginScreen from './components/LoginScreen';
import BottomTabBar from './components/BottomTabBar';
import { LoadingSpinner } from './components/Common';

import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import SchedulePage from './pages/SchedulePage';
import TeamPage from './pages/TeamPage';
import MorePage from './pages/MorePage';
import SalesPage from './pages/SalesPage';
import NotificationsPage from './pages/NotificationsPage';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function MobileShell({ children }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#DDD8F5',
    }}>
      <div style={{
        width: '100%', maxWidth: 430,
        height: '100dvh',
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
  const [session, setSession] = useState(undefined);
  const [activeTab, setActiveTab] = useState('home');
  const [stack, setStack] = useState([]);
  const [notifiedIds, setNotifiedIds] = useState([]);
  const [customersFilter, setCustomersFilter] = useState('전체');
const [headerSearch, setHeaderSearch] = useState('');
const [customersSearch, setCustomersSearch] = useState(''); // ✅ 추가 
const [notifCount, setNotifCount] = useState(0); // ✅ 추가
useEffect(() => {
    authService.getSession().then(s => setSession(s));
    const { data: { subscription } } = authService.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setActiveTab('home'); setStack([]); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const interval = setInterval(async () => {
      try {
        const schedules = await scheduleService.today();
        const now = new Date();
        schedules.forEach((schedule) => {
          if (!schedule.reminder_minutes || schedule.reminder_minutes === 'none') return;
          const id = schedule.id;
          if (notifiedIds.includes(id)) return;
          const raw = schedule.scheduled_at || `${schedule.date}T${schedule.time}`;
          const match = String(raw).match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
          if (!match) return;
          const scheduleTime = new Date(
            Number(match[1]), Number(match[2]) - 1, Number(match[3]),
            Number(match[4]), Number(match[5]), 0
          );
          const reminderTime = new Date(scheduleTime.getTime() - Number(schedule.reminder_minutes) * 60 * 1000);
          const fiveMinutesAfterSchedule = new Date(scheduleTime.getTime() + 5 * 60 * 1000);
          if (now >= reminderTime && now <= fiveMinutesAfterSchedule) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('📅 일정 알림', {
                body: `${schedule.title}\n${schedule.customer_name || ''}`,
                icon: '/boplan192.png',
              });
            } else {
              alert(`📅 일정 알림\n${schedule.title}`);
            }
            setNotifiedIds(prev => [...prev, id]);
          }
        });
      } catch (e) {
        console.error('알림 체크 실패', e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [session, notifiedIds]);

  useEffect(() => {
  if (!session) return;
  loadNotifCount();
}, [session]);

async function loadNotifCount() {
  try {
    const [schedules, customers] = await Promise.all([
      scheduleService.today().catch(() => []),
      customerService.list({ status: '전체', search: '' }).catch(() => []),
    ]);
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDate = today.getDate();
    const todayMMDD = `${String(todayMonth).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;
    let count = 0;
    count += schedules.length;
    customers.forEach(c => {
      const raw = String(c.ssn || c.birth || '').trim();
      const ssnMatch = raw.match(/^(\d{2})(\d{2})(\d{2})/);
      if (ssnMatch && `${ssnMatch[2]}-${ssnMatch[3]}` === todayMMDD) count++;
      const isoMatch = raw.match(/\d{4}[-./](\d{2})[-./](\d{2})/);
      if (isoMatch && `${isoMatch[1]}-${isoMatch[2]}` === todayMMDD) count++;
    });
    customers.forEach(c => {
      if (!c.car_expiry) return;
      const target = new Date(c.car_expiry);
      if (isNaN(target.getTime())) return;
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
      const d = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (d >= 0 && d <= 30) count++;
    });
    setNotifCount(count);
  } catch (e) {
    console.error(e);
  }
}

  function navigate(page, payload) {
    if (page === 'customers') {
      setStack([]);
      setActiveTab('customers');
      setCustomersFilter(payload?.filter || '전체');
     setCustomersSearch(payload?.search || ''); // ✅ search도 payload로 받기
      return;
    }
    setStack(prev => [...prev, { page, payload }]);
  }

  function goBack() { setStack(prev => prev.slice(0, -1)); }

  function changeTab(tab) {
    setStack([]);
    setActiveTab(tab);
    if (tab === 'customers') setCustomersFilter('전체');
  }

  const user = session?.user;
  const current = stack[stack.length - 1];
  const hasStack = stack.length > 0;

  function renderStack() {
    if (!current) return null;
    switch (current.page) {
      case 'customerDetail': return <CustomerDetailPage customerId={current.payload?.id} onBack={goBack} />;
      case 'sales':          return <SalesPage onBack={goBack} />;
      case 'notifications':  return <NotificationsPage onBack={goBack} />;
      case 'insuranceContact': return <InsuranceContactPage onBack={goBack} />;
      case 'schedule':       return <SchedulePage onBack={goBack} />;
      default:               return null;
    }
  }

  function renderTab() {
    switch (activeTab) {
      case 'home':             return <DashboardPage user={user} onNavigate={navigate} />;
      case 'customers': return (
  <CustomersPage
    key={`${customersFilter}-${customersSearch}`}
    onNavigate={navigate}
    initialFilter={customersFilter}
    initialSearch={customersSearch}
  />
);
      case 'schedule':         return <SchedulePage />;
      case 'tree':             return <TeamPage />;
      case 'more':             return <MorePage user={user} onNavigate={navigate} />;
      case 'sales':            return <SalesPage onBack={() => setActiveTab('home')} />;
      case 'notifications':    return <NotificationsPage onBack={() => setActiveTab('home')} />;
      case 'insuranceContact': return <InsuranceContactPage onBack={() => setActiveTab('home')} />;
      default:                 return <DashboardPage user={user} onNavigate={navigate} />;
    }
  }

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

  if (isMobile) {
    return (
      <MobileShell>
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          WebkitOverflowScrolling: 'touch', background: COLORS.bg,
        }}>
          {hasStack ? renderStack() : renderTab()}
        </div>
        {!hasStack && <BottomTabBar activeTab={activeTab} onChange={changeTab} />}
      </MobileShell>
    );
  }

  // ── PC 웹 레이아웃 ────────────────────────────
  return (
    <WebShell>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* 사이드바 */}
        <div style={{
          width: 240, flexShrink: 0, background: '#fff',
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex', flexDirection: 'column',
          height: '100vh', position: 'fixed',
          left: 0, top: 0, zIndex: 100,
          boxShadow: '2px 0 12px rgba(124,92,252,0.06)',
        }}>
          {/* 로고 */}
<div
  onClick={() => changeTab('home')}
  style={{
    padding: '24px 20px 16px',
    borderBottom: `1px solid ${COLORS.border}`,
    cursor: 'pointer',
  }}
>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <img src="/boplan192.png" alt="보플랜"
      style={{ width: 36, height: 36, borderRadius: 10 }}
      onError={e => { e.target.style.display = 'none'; }}
    />
    <div>
      <div style={{ fontWeight: 900, fontSize: 18, color: COLORS.primary }}>보플랜</div>
      <div style={{ fontSize: 11, color: COLORS.textGray }}>보험설계사 CRM</div>
    </div>
  </div>
</div>
          {/* 메뉴 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
            {[
              { id: 'home',             icon: '🏠', label: '홈'           },
              { id: 'customers',        icon: '👥', label: '고객 관리'    },
              { id: 'schedule',         icon: '📅', label: '일정 관리'    },
              { id: 'sales',            icon: '📊', label: '보험 이력'    },
              { id: 'tree',             icon: '🌳', label: '소개 트리'    },
              { id: 'notifications',    icon: '🔔', label: '알림 센터'    },
              { id: 'insuranceContact', icon: '📞', label: '보험사 연락처' },
              { id: 'more',             icon: '⚙️', label: '설정'         },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: 12, padding: '11px 14px', borderRadius: 12, border: 'none',
                  background: activeTab === tab.id ? COLORS.primaryBg : 'transparent',
                  color: activeTab === tab.id ? COLORS.primary : COLORS.textGray,
                  fontWeight: activeTab === tab.id ? 800 : 500,
                  fontSize: 14, cursor: 'pointer', marginBottom: 2,
                  textAlign: 'left', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{tab.icon}</span>
{tab.label}
{tab.id === 'notifications' && notifCount > 0 && (
  <span style={{
    marginLeft: 'auto', background: COLORS.primary,
    color: '#fff', borderRadius: 999, padding: '2px 7px',
    fontSize: 11, fontWeight: 800,
  }}>{notifCount}</span>
)}
                              </button>
            ))}
          </div>

          {/* 보플랜 PRO */}
          <div style={{
            margin: '0 12px 12px',
            background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
            borderRadius: 16, padding: '16px', color: '#fff',
          }}>
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}>보플랜 PRO</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 12, lineHeight: 1.4 }}>
              팀 협업 기능을<br />사용해보세요!
            </div>
            <button style={{
              background: '#fff', color: COLORS.primary, border: 'none',
              borderRadius: 8, padding: '7px 12px', fontSize: 12,
              fontWeight: 800, cursor: 'pointer', width: '100%',
            }}>
              자세히 보기 &gt;
            </button>
          </div>

          {/* 프로필 */}
          <div style={{
            padding: '14px 16px', borderTop: `1px solid ${COLORS.border}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {user?.user_metadata?.photo_url ? (
              <img
                src={`${user.user_metadata.photo_url}?t=${Date.now()}`}
                alt="프로필"
                style={{
                  width: 52, height: 52, borderRadius: '50%',
                  objectFit: 'cover', flexShrink: 0,
                  border: '2px solid #fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              />
            ) : (
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
                color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0,
              }}>
                {(user?.user_metadata?.display_name || user?.email || '?').charAt(0)}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.user_metadata?.display_name || user?.email?.split('@')[0]}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textGray }}>
                {user?.user_metadata?.position || '보플랜 지점'}
              </div>
            </div>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div style={{
          marginLeft: 240, flex: 1, display: 'flex',
          flexDirection: 'column', height: '100vh', overflow: 'hidden',
        }}>
          {/* 상단 헤더 */}
          <div style={{
            background: '#fff', borderBottom: `1px solid ${COLORS.border}`,
            padding: '0 32px', height: 64, display: 'flex',
            alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0, boxShadow: '0 2px 12px rgba(124,92,252,0.06)',
          }}>
            {/* 인사말 */}
            <div style={{ flexShrink: 0, marginRight: 24 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: COLORS.text }}>
                👋 {user?.user_metadata?.display_name || user?.email?.split('@')[0]}
                {user?.user_metadata?.position ? ` ${user.user_metadata.position}` : ''}님, 좋은 하루 보내세요!
              </div>
              <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 2 }}>
                {formatDateKorean()}
              </div>
            </div>

            {/* 검색창 */}
<div style={{
  display: 'flex', alignItems: 'center', gap: 10,
  flex: 1, maxWidth: 360, background: COLORS.bg,
  borderRadius: 12, padding: '10px 16px',
  border: `1.5px solid ${COLORS.border}`,
}}>
  <span style={{ color: COLORS.textGray }}>🔍</span>
  <input
    placeholder="고객명, 전화번호를 검색"
    value={headerSearch}
    onChange={e => {
      const val = e.target.value;
      setHeaderSearch(val);
      // ✅ 입력하는 즉시 고객 페이지로 이동하며 검색
      if (val.trim()) {
        setStack([]);
        setActiveTab('customers');
        setCustomersFilter('전체');
        setCustomersSearch(val);
      }
    }}
    onKeyDown={e => {
      if (e.key === 'Enter' && headerSearch.trim()) {
        navigate('customers', { search: headerSearch });
        setHeaderSearch('');
      }
    }}
    style={{
      border: 'none', background: 'none', outline: 'none',
      fontSize: 13, flex: 1, color: COLORS.text, fontFamily: 'inherit',
    }}
  />
  {/* ✅ 검색어 지우기 버튼 */}
  {headerSearch && (
    <button
      onClick={() => {
        setHeaderSearch('');
        setCustomersSearch('');
      }}
      style={{
        background: 'none', border: 'none',
        cursor: 'pointer', color: COLORS.textGray,
        fontSize: 16, padding: 0,
      }}
    >
      ✕
    </button>
  )}
</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16 }}>
              <button
                onClick={() => changeTab('notifications')}
                style={{
                  width: 42, height: 42, borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20, position: 'relative',
                }}
              >
                🔔
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 8, height: 8, borderRadius: '50%',
                  background: COLORS.primary,
                }} />
              </button>

              <button
                onClick={() => navigate('schedule')}
                style={{
                  border: 'none',
                  background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)',
                  color: '#fff', borderRadius: 12, padding: '10px 18px',
                  fontSize: 13, fontWeight: 900, cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(124,58,237,0.25)',
                  whiteSpace: 'nowrap',
                }}
              >
                + 새 일정 등록
              </button>
            </div>
          </div>

          {/* 콘텐츠 */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '10px 7px 44px 20px',
            background: COLORS.bg,
          }}>
            {hasStack ? renderStack() : renderTab()}
          </div>
        </div>
      </div>
    </WebShell>
  );
}