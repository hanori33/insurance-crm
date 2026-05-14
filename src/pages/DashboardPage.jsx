// src/pages/DashboardPage.jsx
// src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import CustomerCard from '../components/CustomerCard';
import { Card, SectionHeader, Divider, LoadingSpinner } from '../components/Common';
import EmptyState from '../components/EmptyState';
import ScheduleForm from '../components/ScheduleForm';
import customerService from '../services/customerService';
import scheduleService from '../services/scheduleService';
import { formatDateKorean, toTimeStr, todayStr } from '../utils';

// ── 손해보험사 목록 ──────────────────────────
const DAMAGE_INSURANCE = [
  { name: 'DB손해보험',   phone: '1588-0100', fax: '0505-181-4862', emoji: '🔴' },
  { name: '삼성화재',     phone: '1588-5114', fax: '0505-162-0872', emoji: '🔵' },
  { name: '한화손해보험', phone: '1566-8000', fax: '0505-779-1004', emoji: '🟠' },
  { name: '현대해상',     phone: '1588-5656', fax: '0507-162-0872', emoji: '🟡' },
  { name: '메리츠화재',   phone: '1566-7711', fax: '0505-021-3400', emoji: '🟣' },
  { name: '롯데손해보험', phone: '1588-3344', fax: '0504-800-0700', emoji: '🔴' },
  { name: 'KB손해보험',   phone: '1544-0114', fax: '0505-100-0114', emoji: '🟡' },
  { name: '농협손해보험', phone: '1544-2000', fax: '0505-100-2000', emoji: '🟢' },
];

const LIFE_INSURANCE = [
  { name: '교보생명',     phone: '1588-1001', fax: '', emoji: '🟢' },
  { name: '신한라이프',   phone: '1588-5580', fax: '', emoji: '🔵' },
  { name: '삼성생명',     phone: '1588-3114', fax: '', emoji: '🔵' },
  { name: 'KB라이프',     phone: '1588-3374', fax: '', emoji: '🟡' },
  { name: '한화생명',     phone: '1588-6363', fax: '', emoji: '🟠' },
  { name: '흥국생명',     phone: '1588-2288', fax: '', emoji: '🔴' },
  { name: 'DB생명',       phone: '1588-3131', fax: '', emoji: '🔴' },
  { name: '동양생명',     phone: '1577-1004', fax: '', emoji: '🔵' },
  { name: 'AIA생명',      phone: '1588-9898', fax: '', emoji: '🔴' },
  { name: '농협생명',     phone: '1544-4000', fax: '', emoji: '🟢' },
  { name: '하나생명',     phone: '1577-1112', fax: '', emoji: '🔵' },
  { name: 'MetLife',      phone: '1588-9600', fax: '', emoji: '🔵' },
];

// ── 보험사 카드 ──────────────────────────────
function InsuranceCard({ company }) {
  function handleCall() {
    window.location.href = `tel:${company.phone.replace(/-/g, '')}`;
  }
  return (
    <div style={{
      background: COLORS.white, borderRadius: 14,
      padding: '14px 16px',
      boxShadow: `0 2px 10px ${COLORS.shadow}`,
      minWidth: 200, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>{company.emoji}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.text }}>{company.name}</span>
      </div>
      <div style={{ fontSize: 11, color: COLORS.textGray, marginBottom: 4 }}>고객센터</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.primary, marginBottom: 10 }}>{company.phone}</div>
      {company.fax && (
        <div style={{ fontSize: 11, color: COLORS.textGray, marginBottom: 10 }}>
          📠 {company.fax}
        </div>
      )}
      <button onClick={handleCall} style={{
        width: '100%', padding: '8px 0', borderRadius: 8, border: 'none',
        background: COLORS.primary, color: '#fff',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>📞 전화걸기</button>
    </div>
  );
}

function ScheduleRow({ item, isLast }) {
  const customerName = item.customers?.name || item.customer_name || '';
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: COLORS.primary, fontSize: 13, width: 44, flexShrink: 0 }}>
            {toTimeStr(item.scheduled_at)}
          </span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.primary, display: 'inline-block', margin: '0 8px', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 500, fontSize: 14, color: COLORS.text }}>{item.title}</div>
            {customerName && <div style={{ fontSize: 11, color: COLORS.textGray, marginTop: 1 }}>{customerName} 고객</div>}
          </div>
        </div>
        <span style={{ color: COLORS.textLight, fontSize: 14 }}>›</span>
      </div>
      {!isLast && <Divider />}
    </>
  );
}

export default function DashboardPage({ user, onNavigate }) {
  const [stats, setStats]         = useState({ scheduleCount: 0, customerCount: 0 });
  const [schedules, setSchedules] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [insuranceTab, setInsuranceTab] = useState('damage');

  const isMobile = window.innerWidth <= 768;
  const meta     = user?.user_metadata || {};
  const userName = meta.display_name || user?.email?.split('@')[0] || '사용자';
  const position = meta.position || '';
  const greeting = position
    ? `${userName} ${position}님 안녕하세요! 👋`
    : `${userName}님 안녕하세요! 👋`;

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [todaySched, recent, statusCounts] = await Promise.all([
        scheduleService.today().catch(() => []),
        customerService.recent(3).catch(() => []),
        customerService.statusCounts().catch(() => ({})),
      ]);
      const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
      setStats({ scheduleCount: todaySched.length, customerCount: total });
      setSchedules(todaySched.slice(0, 3));
      setCustomers(recent);
    } finally { setLoading(false); }
  }

  const statItems = [
    { icon: '📅', label: '오늘 일정', value: `${stats.scheduleCount}건` },
    { icon: '👥', label: '고객 수',   value: `${stats.customerCount}명` },
    { icon: '📊', label: '유지율',    value: '88%' },
    { icon: '💰', label: '월 매출',   value: '24,580천원' },
  ];

  const insuranceList = insuranceTab === 'damage' ? DAMAGE_INSURANCE : LIFE_INSURANCE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {isMobile && (
        <Header
          user={user}
          notifCount={3}
          onNotif={() => onNavigate('notifications')}
          onProfile={() => onNavigate('more')}
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '16px 16px 24px' : '24px 0 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 인사말 */}
        <div style={{ paddingLeft: 2 }}>
          <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 800, color: COLORS.text, letterSpacing: -0.3 }}>
            {greeting}
          </div>
          <div style={{ fontSize: 13, color: COLORS.textGray, marginTop: 4 }}>{formatDateKorean()}</div>
        </div>

        {/* 한눈에 보기 */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 15 : 17, color: COLORS.text }}>오늘의 한눈에 보기</div>
            <button onClick={() => setShowScheduleForm(true)} style={{
              background: COLORS.primary, color: '#fff', border: 'none',
              borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>📅 일정 등록</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: isMobile ? 8 : 16 }}>
            {statItems.map((s, i) => <StatCard key={i} {...s} />)}
          </div>
        </Card>

        {/* 오늘일정 + 최근고객 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <Card>
            <SectionHeader title="오늘의 일정" onViewAll={() => onNavigate('schedule')} />
            {loading ? <LoadingSpinner /> :
             schedules.length === 0
               ? <EmptyState icon="📅" message="오늘 일정이 없습니다" />
               : schedules.map((s, i) => <ScheduleRow key={s.id||i} item={s} isLast={i===schedules.length-1} />)
            }
          </Card>
          <Card style={{ padding: 0 }}>
            <div style={{ padding: '16px 16px 0' }}>
              <SectionHeader title="최근 고객" onViewAll={() => onNavigate('customers')} />
            </div>
            {loading ? <LoadingSpinner /> :
             customers.length === 0
               ? <EmptyState icon="👥" message="고객이 없습니다" />
               : customers.map((c, i) => (
                   <CustomerCard key={c.id||i} customer={c} showDate={false} isLast={i===customers.length-1}
                     onClick={() => onNavigate('customerDetail', { id: c.db_id || c.id })} />
                 ))
            }
            <div style={{ height: 8 }} />
          </Card>
        </div>

        {/* 보험사 고객센터 */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {/* 탭 */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}` }}>
            {[
              { id: 'damage', label: '손해보험' },
              { id: 'life',   label: '생명보험' },
            ].map(t => (
              <button key={t.id} onClick={() => setInsuranceTab(t.id)} style={{
                flex: 1, padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer',
                fontWeight: insuranceTab === t.id ? 700 : 400, fontSize: 14,
                color: insuranceTab === t.id ? COLORS.primary : COLORS.textGray,
                borderBottom: insuranceTab === t.id ? `2px solid ${COLORS.primary}` : '2px solid transparent',
              }}>{t.label}</button>
            ))}
          </div>

          {/* 가로 스크롤 카드 */}
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch', paddingBottom: 16 }}>
            {insuranceList.map((company, i) => (
              <InsuranceCard key={i} company={company} />
            ))}
          </div>
        </Card>

      </div>

      <ScheduleForm
        visible={showScheduleForm}
        onClose={() => setShowScheduleForm(false)}
        onSave={() => { load(); setShowScheduleForm(false); }}
        dateStr={todayStr()}
        initial={null}
      />
    </div>
  );
}