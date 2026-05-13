// src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import CustomerCard from '../components/CustomerCard';
import { Card, SectionHeader, Divider, LoadingSpinner } from '../components/Common';
import EmptyState from '../components/EmptyState';
import customerService from '../services/customerService';
import scheduleService from '../services/scheduleService';
import { formatDateKorean, toTimeStr } from '../utils';

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
  const isMobile = window.innerWidth <= 768;

  // 유저 이름 / 직급
  const meta      = user?.user_metadata || {};
  const userName  = meta.display_name || user?.email?.split('@')[0] || '사용자';
  const position  = meta.position || '';
  const greeting  = position
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
          <div style={{ fontSize: 13, color: COLORS.textGray, marginTop: 4 }}>
            {formatDateKorean()}
          </div>
        </div>

        {/* 통계 카드 4개 - PC에서는 한 줄로 크게 */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 15 : 17, color: COLORS.text }}>오늘의 한눈에 보기</div>
            <button onClick={() => onNavigate('schedule')} style={{
              background: COLORS.primary, color: '#fff', border: 'none',
              borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>📅 일정 등록</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: isMobile ? 8 : 16 }}>
            {statItems.map((s, i) => <StatCard key={i} {...s} />)}
          </div>
        </Card>

        {/* PC: 2컬럼 / 모바일: 1컬럼 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
          alignItems: 'start',
        }}>
          {/* 오늘 일정 */}
          <Card>
            <SectionHeader title="오늘의 일정" onViewAll={() => onNavigate('schedule')} />
            {loading ? <LoadingSpinner /> :
             schedules.length === 0
               ? <EmptyState icon="📅" message="오늘 일정이 없습니다" />
               : schedules.map((s, i) => (
                   <ScheduleRow key={s.id || i} item={s} isLast={i === schedules.length - 1} />
                 ))
            }
          </Card>

          {/* 최근 고객 */}
          <Card style={{ padding: 0 }}>
            <div style={{ padding: '16px 16px 0' }}>
              <SectionHeader title="최근 고객" onViewAll={() => onNavigate('customers')} />
            </div>
            {loading ? <LoadingSpinner /> :
             customers.length === 0
               ? <EmptyState icon="👥" message="고객이 없습니다" />
               : customers.map((c, i) => (
                   <CustomerCard
                     key={c.id || i} customer={c} showDate={false}
                     isLast={i === customers.length - 1}
                     onClick={() => onNavigate('customerDetail', { id: c.id })}
                   />
                 ))
            }
            <div style={{ height: 8 }} />
          </Card>
        </div>

      </div>
    </div>
  );
}