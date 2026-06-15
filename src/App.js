// src/App.js
import InsuranceContactPage from './pages/InsuranceContactPage';
import React, { useState, useEffect } from 'react';
import { COLORS } from './constants';
import authService from './services/authService';
import scheduleService from './services/scheduleService';
import customerService from './services/customerService';
import { formatDateKorean } from './utils';
import { supabase } from './supabaseClient';
import LoginScreen from './components/LoginScreen';
import { LoadingSpinner } from './components/Common';
import NoticesPage from './pages/NoticesPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import SchedulePage from './pages/SchedulePage';
import TeamPage from './pages/TeamPage';
import ReferralTreePage from './pages/ReferralTreePage';
import MorePage from './pages/MorePage';
import SalesPage from './pages/SalesPage';
import NotificationsPage from './pages/NotificationsPage';
import RoleRequestPage from './pages/RoleRequestPage';
import Header from './components/Header';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
import ConsultingPage from './pages/ConsultingPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import BackupRestorePage from './pages/BackupRestorePage';
import InquiryPage from './pages/InquiryPage';
import AdminInquiryPage from './pages/AdminInquiryPage';
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging, VAPID_KEY } from './firebase';
import ResetPasswordPage from './pages/ResetPasswordPage';
import FaxClaimPage from './pages/FaxClaimPage';
import DiseaseDictionaryPage from './pages/DiseaseDictionaryPage';
import TermsPage from './pages/TermsPage';

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
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#DDD8F5',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          height: '100dvh',
          background: COLORS.bg,
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 60px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function WebShell({ children }) {
  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        background: COLORS.bg,
        display: 'flex',
      }}
    >
      {children}
    </div>
  );
}

export default function App() {
  const isMobile = useIsMobile();

  const [session, setSession] = useState(undefined);
  const isResetPassword =
  window.location.pathname === '/reset-password' ||
  window.location.hash.includes('type=recovery') ||
  window.location.hash.includes('access_token') ||
  window.location.search.includes('type=recovery');
  const [activeTab, setActiveTab] = useState('home');
  const [stack, setStack] = useState([]);
  const [notifiedIds, setNotifiedIds] = useState([]);
  const [customersFilter, setCustomersFilter] = useState('전체');
  const [headerSearch, setHeaderSearch] = useState('');
  const [customersSearch, setCustomersSearch] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [profile, setProfile] = useState(null);
  const [showProModal, setShowProModal] = useState(false);

  useEffect(() => {
    authService.getSession().then(s => setSession(s));

    const {
  data: { subscription },
} = authService.onAuthStateChange((event, s) => {
  if (event === 'PASSWORD_RECOVERY') {
    window.history.replaceState({}, '', '/reset-password');
    setSession(s);
    return;
  }

  setSession(s);

  if (!s) {
    setActiveTab('home');
    setStack([]);
  }
});

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
  if (!session) return;

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  const getNotifiedIds = () => {
    try {
      return JSON.parse(localStorage.getItem('boplan_notified_schedule_ids') || '[]');
    } catch {
      return [];
    }
  };

  const saveNotifiedId = (id) => {
    const ids = getNotifiedIds();

    if (!ids.includes(id)) {
      const next = [...ids, id].slice(-200);
      localStorage.setItem('boplan_notified_schedule_ids', JSON.stringify(next));
      setNotifiedIds(next);
    }
  };

  const checkScheduleReminders = async () => {
    try {
      const schedules = await scheduleService.today();
      const now = new Date();
      const notified = getNotifiedIds();

      schedules.forEach((schedule) => {
        if (!schedule.reminder_minutes || schedule.reminder_minutes === 'none') return;
        if (!schedule.scheduled_at) return;
        if (schedule.completed) return;

        const id = `schedule-${schedule.id}-${schedule.reminder_minutes}`;
        if (notified.includes(id)) return;

        const raw = String(schedule.scheduled_at);
        const match = raw.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);

        if (!match) return;

        const scheduleTime = new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          0
        );

        const reminderTime = new Date(
          scheduleTime.getTime() - Number(schedule.reminder_minutes) * 60 * 1000
        );

        const notifyWindowEnd = new Date(reminderTime.getTime() + 60 * 1000);

        if (now >= reminderTime && now <= notifyWindowEnd) {
          const title = schedule.title || '일정 알림';
          const customer = schedule.customer_name ? `\n${schedule.customer_name} 고객` : '';
          const timeText = `${String(scheduleTime.getHours()).padStart(2, '0')}:${String(scheduleTime.getMinutes()).padStart(2, '0')}`;

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('📅 보플랜 일정 알림', {
              body: `${timeText} ${title}${customer}`,
              icon: '/boplan192.png',
              badge: '/boplan192.png',
            });
          } else {
            alert(`📅 보플랜 일정 알림\n${timeText} ${title}${customer}`);
          }

          saveNotifiedId(id);
        }
      });
    } catch (e) {
      console.error('일정 알림 체크 실패', e);
    }
  };

  checkScheduleReminders();

  const interval = setInterval(checkScheduleReminders, 15000);

  return () => clearInterval(interval);
}, [session]);

useEffect(() => {
  if (!session) return;

  loadNotifCount();
  const interval = setInterval(loadNotifCount, 30 * 1000);

  return () => clearInterval(interval);
}, [session]);

useEffect(() => {
  if (!session?.user) return;

  async function updateLastSeen() {
    try {
      await supabase
        .from('profiles')
        .update({
          last_seen: new Date().toISOString(),
        })
        .eq('user_id', session.user.id);
    } catch (e) {
      console.error('last_seen 업데이트 실패', e);
    }
  }

  updateLastSeen();

  const interval = setInterval(updateLastSeen, 30000);

  return () => clearInterval(interval);
}, [session]);

useEffect(() => {
  loadProfile();
}, [session]);

async function loadProfile() {
  if (!session?.user) return;

  const { data, error } = await supabase
  .from('profiles')
  .select('pro_plan, pro_expire_at, fax_credit, trial_used, pro_trial_start, pro_trial_end')
  .eq('user_id', session.user.id)
  .single();

if (error) {
  console.error(error);
  return;
}

let nextProfile = data;

if (!data.trial_used && !data.pro_trial_end) {
  const now = new Date();
  const trialEnd = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000
  );

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update({
      trial_used: true,
      pro_trial_start: now.toISOString(),
      pro_trial_end: trialEnd.toISOString(),
      fax_credit: Math.max(data.fax_credit ?? 0, 20),
    })
    .eq('user_id', session.user.id)
    .select('pro_plan, pro_expire_at, fax_credit, trial_used, pro_trial_start, pro_trial_end')
    .single();

  if (!updateError && updatedProfile) {
    nextProfile = updatedProfile;
  }
}

setProfile(nextProfile);
}

useEffect(() => {
  if (!session?.user) return;

  async function setupFcmToken() {
    try {
      if (!('Notification' in window)) return;

      const permission = await Notification.requestPermission();

      if (permission !== 'granted') return;

      const messaging = await getFirebaseMessaging();
      if (!messaging) return;

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (!token) return;

      const { error } = await supabase.from('fcm_tokens').upsert(
        {
          user_id: session.user.id,
          token,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );

      if (error) throw error;

      console.log('FCM 토큰 저장 완료');
    } catch (e) {
      console.error('FCM 토큰 저장 실패:', {
  code: e?.code,
  message: e?.message,
  name: e?.name,
  stack: e?.stack,
});
    }
  }

  setupFcmToken();
}, [session]);

  function clearNotifCount() {
    setNotifCount(0);
    localStorage.setItem('notif_read_date', new Date().toDateString());
  }

  function decreaseNotifCount() {
    setNotifCount(prev => Math.max(0, prev - 1));
  }

  async function loadNotifCount() {
    const readIds = JSON.parse(localStorage.getItem('read_notif_ids') || '[]');
    const notifSettings = JSON.parse(localStorage.getItem('notif_settings') || '{}');

    const carEnabled = notifSettings.carExpiry?.enabled !== false;
    const carDays = notifSettings.carExpiry?.days || 30;
    const saleEnabled = notifSettings.saleExpiry?.enabled !== false;
    const saleDays = notifSettings.saleExpiry?.days || 30;
    const birthdayEnabled = notifSettings.birthday?.enabled !== false;

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

      schedules.forEach(s => {
        if (!readIds.includes(`schedule-${s.id}`)) count += 1;
      });

      if (birthdayEnabled) {
        customers.forEach(c => {
          const raw = String(c.ssn || c.birth || '').trim();

          const ssnMatch = raw.match(/^(\d{2})(\d{2})(\d{2})/);
          if (
            ssnMatch &&
            `${ssnMatch[2]}-${ssnMatch[3]}` === todayMMDD &&
            !readIds.includes(`birthday-${c.id}`)
          ) {
            count += 1;
          }

          const isoMatch = raw.match(/\d{4}[-./](\d{2})[-./](\d{2})/);
          if (
            isoMatch &&
            `${isoMatch[1]}-${isoMatch[2]}` === todayMMDD &&
            !readIds.includes(`birthday-${c.id}`)
          ) {
            count += 1;
          }
        });
      }

      if (carEnabled) {
        customers.forEach(c => {
          const carDate = c.car_expiry || c.carExpiry || c.car_expiry_date || c.carExpiryDate;
          if (!carDate) return;

          const target = new Date(carDate);
          if (Number.isNaN(target.getTime())) return;

          const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
          const d = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

          if (d >= 0 && d <= carDays && !readIds.includes(`car-${c.id}`)) {
            count += 1;
          }
        });
      }

      if (session?.user?.email === 'gksmf629@naver.com') {
        const { data: requests } = await supabase
          .from('role_requests')
          .select('id')
          .eq('status', 'pending');

        count += (requests || []).length;
      }

      if (saleEnabled) {
        const { data: salesData } = await supabase
          .from('sales')
          .select('id, expiry_date')
          .eq('user_id', session?.user?.id);

        (salesData || []).forEach(s => {
          if (!s.expiry_date) return;

          const target = new Date(s.expiry_date);
          if (Number.isNaN(target.getTime())) return;

          const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
          const d = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

          if (d >= 0 && d <= saleDays && !readIds.includes(`sale-expiry-${s.id}`)) {
            count += 1;
          }
        });
      }

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
      setCustomersSearch(payload?.search || '');
      return;
    }

    if (page === 'schedule') {
      setStack([]);
      setActiveTab('schedule');

      if (payload?.initialSchedule) {
        setStack([{ page: 'schedule', payload }]);
      }

      return;
    }

    if (page === 'diseaseDictionary') {
  setStack([]);
  setActiveTab('diseaseDictionary');
  return;
}

    if (page === 'consulting') {
      setStack([]);
      setActiveTab('consulting');

      
      if (payload?.initialCustomer) {
        setStack([{ page: 'consulting', payload }]);
      }

      return;
    }

    if (page === 'notices') {
      setStack([]);
      setActiveTab('notices');
      return;
    }

    if (page === 'notifications') {
      setStack([]);
      setActiveTab('notifications');
      return;
    }

    if (page === 'sales') {
      setStack([]);
      setActiveTab('sales');
      return;
    }

    if (page === 'tree') {
      setStack([]);
      setActiveTab('tree');
      return;
    }

    if (page === 'team') {
      setStack([]);
      setActiveTab('team');
      return;
    }

    if (page === 'fax') {
      setStack([]);
      setActiveTab('fax');
      return;
    }

    if (page === 'insuranceContact') {
      setStack([]);
      setActiveTab('insuranceContact');
      return;
    }

    if (page === 'roleRequest') {
      setStack([]);
      setActiveTab('roleRequest');
      return;
    }

    if (page === 'more') {
      setStack([]);
      setActiveTab('more');
      return;
    }

    if (page === 'notifSettings') {
      setStack([]);
      setActiveTab('notifSettings');
      return;
    }

    if (page === 'privacyPolicy') {
  setStack([]);
  setActiveTab('privacyPolicy');
  return;
}

if (page === 'terms') {
  setStack([]);
  setActiveTab('terms');
  return;
}

if (page === 'deleteAccount') {
  setStack([]);
  setActiveTab('deleteAccount');
  return;
}

if (page === 'backupRestore') {
  setStack([]);
  setActiveTab('backupRestore');
  return;
}

if (page === 'inquiry') {
  setStack([]);
  setActiveTab('inquiry');
  return;
}

if (page === 'adminInquiry') {
  setStack([]);
  setActiveTab('adminInquiry');
  return;
}

    setStack(prev => [...prev, { page, payload }]);
  }

  function goBack() {
    setStack(prev => prev.slice(0, -1));
  }

  function changeTab(tab) {
    setStack([]);
    setActiveTab(tab);

    if (tab === 'customers') {
      setCustomersFilter('전체');
    }
  }

  const user = session?.user;
  const current = stack[stack.length - 1];
  const hasStack = stack.length > 0;

  function renderStack() {
    if (!current) return null;

    switch (current.page) {
      case 'customerDetail':
        return (
          <CustomerDetailPage
  customerId={current.payload?.id}
  initialTab={current.payload?.tab}
  onBack={goBack}
  onNavigate={navigate}
/>
        );

      case 'sales':
        return <SalesPage onBack={goBack} />;

      case 'notifications':
        return (
          <NotificationsPage
            onBack={goBack}
            onRead={clearNotifCount}
            onReadOne={decreaseNotifCount}
          />
        );

      case 'insuranceContact':
        return <InsuranceContactPage onBack={goBack} />;

      case 'schedule':
        return (
          <SchedulePage
            onBack={goBack}
            initialSchedule={current?.payload?.initialSchedule}
          />
        );

      case 'notifSettings':
        return <NotificationSettingsPage onBack={goBack} />;

      case 'consulting':
        return (
          <ConsultingPage
            initialCustomer={current.payload?.initialCustomer}
            onBack={goBack}
            onNavigate={navigate}
          />
        );

        case 'diseaseDictionary':
  return (
    <DiseaseDictionaryPage
      onBack={() => setActiveTab('consulting')}
    />
  );

      default:
        return null;
    }
  }

  function renderTab() {
    switch (activeTab) {
      case 'home':
        return (
          <DashboardPage
            user={user}
            onNavigate={navigate}
            notifCount={notifCount}
            onClearNotif={clearNotifCount}
          />
        );

      case 'customers':
        return (
          <CustomersPage
            key={`${customersFilter}-${customersSearch}`}
            onNavigate={navigate}
            initialFilter={customersFilter}
            initialSearch={customersSearch}
          />
        );

      case 'schedule':
        return (
          <SchedulePage
            onBack={() => setActiveTab('home')}
            initialSchedule={current?.payload?.initialSchedule}
          />
        );

      case 'tree':
        return <ReferralTreePage />;

      case 'team':
        return <TeamPage />;

      case 'more':
        return <MorePage user={user} onNavigate={navigate} />;

      case 'sales':
        return <SalesPage onBack={() => setActiveTab('home')} />;

      case 'notifications':
        return (
          <NotificationsPage
            onBack={() => setActiveTab('home')}
            onRead={clearNotifCount}
            onReadOne={decreaseNotifCount}
          />
        );

      case 'insuranceContact':
        return <InsuranceContactPage onBack={() => setActiveTab('home')} />;

      case 'notices':
        return <NoticesPage user={user} />;

      case 'consulting':
        return (
          <ConsultingPage
            initialCustomer={current?.payload?.initialCustomer}
            onNavigate={navigate}
          />
        );

        case 'diseaseDictionary':
  return (
    <DiseaseDictionaryPage
      onBack={() => setActiveTab('consulting')}
    />
  );

      case 'fax':
  return (
    <FaxClaimPage
      onBack={() => setActiveTab('home')}
      profile={profile}
      setProfile={setProfile}
    />
  );

      case 'roleRequest':
        return <RoleRequestPage user={user} />;

      case 'notifSettings':
        return (
          <NotificationSettingsPage
            onBack={() => setActiveTab('more')}
          />
        );

        case 'backupRestore':
  return (
    <BackupRestorePage
      onBack={() => setActiveTab('more')}
    />
  );

  case 'inquiry':
  return <InquiryPage user={user} onBack={() => setActiveTab('more')} />;

case 'adminInquiry':
  return <AdminInquiryPage onBack={() => setActiveTab('more')} />;

        case 'privacyPolicy':
  return (
    <PrivacyPolicyPage
      onBack={() => setActiveTab('more')}
    />
  );

  case 'terms':
  return (
    <TermsPage
      onBack={() => setActiveTab('more')}
    />
  );

case 'deleteAccount':
  return (
    <DeleteAccountPage
      onBack={() => setActiveTab('more')}
    />
  );

      default:
        return <DashboardPage user={user} onNavigate={navigate} />;
    }
  }

  if (isResetPassword) {
  const Shell = isMobile ? MobileShell : WebShell;

  return (
    <Shell>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ResetPasswordPage />
      </div>
    </Shell>
  );
}

if (session === undefined) {
  const Shell = isMobile ? MobileShell : WebShell;

  return (
    <Shell>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.bg,
        }}
      >
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
        <Header
          user={user}
          notifCount={notifCount}
          onNotif={() => {
            setStack([]);
            setActiveTab('notifications');
          }}
          onProfile={() => {
            setStack([]);
            setActiveTab('more');
          }}
          onNavigate={(page, payload) => {
            setStack([]);
            setActiveTab(page);

            if (page === 'customers') {
              setCustomersFilter(payload?.filter || '전체');
            }
          }}
        />

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY:
              !hasStack && (activeTab === 'customers' || activeTab === 'schedule')
                ? 'hidden'
                : 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            background: COLORS.bg,
          }}
        >
          {hasStack ? renderStack() : renderTab()}
        </div>
      </MobileShell>
    );
  }

  return (
    <WebShell>
      <div
        style={{
          width: 240,
          flexShrink: 0,
          background: '#fff',
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 100,
          boxShadow: '2px 0 12px rgba(124,92,252,0.06)',
        }}
      >
        <div
          onClick={() => changeTab('home')}
          style={{
            padding: '24px 20px 16px',
            borderBottom: `1px solid ${COLORS.border}`,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/boplan192.png"
              alt="보플랜"
              style={{ width: 36, height: 36, borderRadius: 10 }}
              onError={e => {
                e.target.style.display = 'none';
              }}
            />
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, color: COLORS.primary }}>
                보플랜
              </div>
              <div style={{ fontSize: 11, color: COLORS.textGray }}>
                보험설계사 CRM
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
          {[
            { id: 'home', icon: '🏠', label: '홈' },
            { id: 'notices', icon: '📢', label: '공지사항' },
            { id: 'notifications', icon: '🔔', label: '알림 센터' },
            { id: 'customers', icon: '👥', label: '고객 관리' },
            { id: 'schedule', icon: '📅', label: '일정 관리' },
            { id: 'consulting', icon: '📝', label: '상담 기록' },
            { id: 'sales', icon: '📊', label: '통계 / 분석' },
            { id: 'tree', icon: '🌳', label: '소개 트리' },
            { id: 'team', icon: '👨‍👩‍👧', label: '팀 관리' },
            { id: 'fax', icon: '📠', label: '보험팩스청구' },
            { id: 'insuranceContact', icon: '📞', label: '보험사 연락처' },
            { id: 'roleRequest', icon: '🔑', label: '권한 신청' },
            { id: 'more', icon: '⚙️', label: '설정' },
            ...(session?.user?.email === 'gksmf629@naver.com'
  ? [
      {
        id: 'diseaseDictionary',
        icon: '📚',
        label: '보험사전',
      },
    ]
  : []),
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => changeTab(tab.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                borderRadius: 12,
                border: 'none',
                background: activeTab === tab.id ? COLORS.primaryBg : 'transparent',
                color: activeTab === tab.id ? COLORS.primary : COLORS.textGray,
                fontWeight: activeTab === tab.id ? 800 : 500,
                fontSize: 14,
                cursor: 'pointer',
                marginBottom: 2,
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>
                {tab.icon}
              </span>
              {tab.label}
              {tab.id === 'notifications' && notifCount > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: COLORS.primary,
                    color: '#fff',
                    borderRadius: 999,
                    padding: '2px 7px',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {notifCount}
                </span>
              )}
            </button>
          ))}
        </div>

       <div
  style={{
    margin: '0 12px 12px',
    background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
    borderRadius: 12,
    padding: '12px 14px',
    color: '#fff',
  }}
>
  <div
    style={{
      fontWeight: 900,
      fontSize: 13,
      marginBottom: 6,
    }}
  >
    🚀 보플랜 PRO
  </div>

  <div
    style={{
      fontSize: 11,
      lineHeight: 1.5,
      opacity: 0.95,
      marginBottom: 10,
    }}
  >
    {profile?.pro_plan ? (
  <>
    현재 상태 : PRO 이용중
  </>
) : profile?.pro_trial_end && new Date(profile.pro_trial_end) > new Date() ? (
  <>
    🎁 PRO 무료체험중
    <br />
    남은기간 : {Math.ceil((new Date(profile.pro_trial_end) - new Date()) / (1000 * 60 * 60 * 24))}일
  </>
) : (
  <>
    현재 상태 : 무료회원
  </>
)}

<br />

잔여 팩스 :
{profile?.fax_credit ?? 0}건
  </div>

  
  <button
  onClick={() => setShowProModal(true)}
  style={{
    background: '#fff',
    color: COLORS.primary,
    border: 'none',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    width: '100%',
  }}
>
  자세히 보기 &gt;
</button>
</div>

        <div
          style={{
            padding: '14px 16px',
            borderTop: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {user?.user_metadata?.photo_url ? (
            <img
              src={`${user.user_metadata.photo_url}?t=${Date.now()}`}
              alt="프로필"
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
                border: '2px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            />
          ) : (
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {(user?.user_metadata?.display_name || user?.email || '?').charAt(0)}
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 13,
                color: COLORS.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.user_metadata?.display_name || user?.email?.split('@')[0]}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textGray }}>
              {user?.user_metadata?.position || '보플랜 지점'}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginLeft: 240,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          minWidth: 0,
        }}
      >
        <div
          style={{
            background: '#fff',
            borderBottom: `1px solid ${COLORS.border}`,
            padding: '0 32px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            boxShadow: '0 2px 12px rgba(124,92,252,0.06)',
          }}
        >
          <div style={{ flexShrink: 0, marginRight: 24 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: COLORS.text }}>
              👋 {user?.user_metadata?.display_name || user?.email?.split('@')[0]}
              {user?.user_metadata?.position ? ` ${user.user_metadata.position}` : ''}님,
              좋은 하루 보내세요!
            </div>
            <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 2 }}>
              {formatDateKorean()}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: 1,
              maxWidth: 360,
              background: COLORS.bg,
              borderRadius: 12,
              padding: '10px 16px',
              border: `1.5px solid ${COLORS.border}`,
            }}
          >
            <span style={{ color: COLORS.textGray }}>🔍</span>
            <input
              placeholder="고객명, 전화번호를 검색"
              value={headerSearch}
              onChange={e => {
                const val = e.target.value;
                setHeaderSearch(val);

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
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: 13,
                flex: 1,
                color: COLORS.text,
                fontFamily: 'inherit',
              }}
            />
            {headerSearch && (
              <button
                onClick={() => {
                  setHeaderSearch('');
                  setCustomersSearch('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: COLORS.textGray,
                  fontSize: 16,
                  padding: 0,
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
                width: 42,
                height: 42,
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                position: 'relative',
              }}
            >
              🔔
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: COLORS.primary,
                }}
              />
            </button>

            <button
              onClick={() => navigate('schedule')}
              style={{
                border: 'none',
                background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)',
                color: '#fff',
                borderRadius: 12,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(124,58,237,0.25)',
                whiteSpace: 'nowrap',
              }}
            >
              + 새 일정 등록
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '10px 7px 44px 20px',
            background: COLORS.bg,
          }}
        >
          {hasStack ? renderStack() : renderTab()}
        </div>
      </div>
      {showProModal && (
  <div
    onClick={() => setShowProModal(false)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15,23,42,0.45)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 360,
        background: '#fff',
        borderRadius: 20,
        padding: 22,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 900, color: COLORS.text }}>
        🚀 보플랜 PRO
      </div>

      <div style={{ marginTop: 10, fontSize: 13, color: COLORS.textGray, lineHeight: 1.6 }}>
        AI 기능과 팩스청구를 더 편하게 사용할 수 있어요.
      </div>

      <div style={{ marginTop: 16, fontSize: 13, lineHeight: 1.8, color: COLORS.text }}>
        ✓ AI 증권분석<br />
        ✓ AI 상담요약<br />
        ✓ AI 병력분석<br />
        ✓ AI 영업코치<br />
        ✓ 상담기록 AI 저장<br />
        ✓ 증권분석 결과 저장
      </div>

      <div style={{ marginTop: 16, padding: 12, borderRadius: 14, background: COLORS.primaryBg, color: COLORS.primary, fontWeight: 900 }}>
        잔여 팩스 : {profile?.fax_credit ?? 0}건
      </div>

      <button
        onClick={() => alert('결제 기능은 준비중입니다.')}
        style={{
          marginTop: 14,
          width: '100%',
          border: 'none',
          background: COLORS.primary,
          color: '#fff',
          borderRadius: 12,
          padding: '12px 0',
          fontWeight: 900,
          cursor: 'pointer',
        }}
      >
        PRO 시작하기
      </button>

      <button
        onClick={() => setShowProModal(false)}
        style={{
          marginTop: 8,
          width: '100%',
          border: 'none',
          background: '#F3F4F6',
          color: COLORS.textGray,
          borderRadius: 12,
          padding: '11px 0',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        닫기
      </button>
    </div>
  </div>
)}
    </WebShell>
  );
}