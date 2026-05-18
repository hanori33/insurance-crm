// src/pages/DashboardPage.jsx
import babyImg from '../assets/baby.png';
import dogImg from '../assets/dog.png';
import carImg from '../assets/car.png';
import cakeImg from '../assets/cake.png';
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import Header from '../components/Header';
import { Card, Divider, LoadingSpinner } from '../components/Common';
import EmptyState from '../components/EmptyState';
import ScheduleForm from '../components/ScheduleForm';
import customerService from '../services/customerService';
import scheduleService from '../services/scheduleService';
import { formatDateKorean, toTimeStr, todayStr } from '../utils';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function MiniStatCard({ icon, title, value, sub, bg = '#fff', color = COLORS.primary, onClick }) {
  const isImageIcon = typeof icon === 'string' && (
    icon.includes('/static/') ||
    icon.includes('/assets/') ||
    icon.includes('data:') ||
    icon.endsWith('.png') ||
    icon.endsWith('.jpg') ||
    icon.endsWith('.jpeg') ||
    icon.endsWith('.webp') ||
    icon.startsWith('blob:')
  );
  const isWideImage = icon === carImg || icon === dogImg;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: bg,
        borderRadius: 22,
        padding: '18px 16px',
        minHeight: 132,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 8px 24px rgba(124,92,252,0.08)',
        border: `1px solid ${COLORS.border}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', zIndex: 2, width: '58%', minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: COLORS.text, marginBottom: 10, lineHeight: 1.25, wordBreak: 'keep-all' }}>
          {title}
        </div>
        <div style={{ fontSize: 30, fontWeight: 950, color: COLORS.text, lineHeight: 1, whiteSpace: 'nowrap' }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 10, lineHeight: 1.35, wordBreak: 'keep-all' }}>
            {sub}
          </div>
        )}
      </div>

      {isImageIcon ? (
        <img
          src={icon}
          alt=""
          style={{
            position: 'absolute',
            right: isWideImage ? 4 : 12,
            bottom: isWideImage ? 10 : 16,
            width: isWideImage ? 112 : 88,
            height: isWideImage ? 112 : 88,
            objectFit: 'contain',
            mixBlendMode: 'multiply',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div style={{
          position: 'absolute', right: 18, bottom: 18,
          width: 70, height: 70, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 34, color, zIndex: 1,
        }}>
          {icon}
        </div>
      )}
    </button>
  );
}

function DashboardSection({ title, icon, right, children }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontWeight: 900, fontSize: 16, color: COLORS.text }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

function ScheduleRow({ item, isLast }) {
  const customerName = item.customers?.name || item.customer_name || '';
  const title = (item.title || '').replace(/^[^\s]+\s/, '');
  const icon = item.schedule_icon || '📌';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
        <div style={{ width: 58, flexShrink: 0, color: COLORS.primary, fontWeight: 900, fontSize: 14 }}>
          {toTimeStr(item.scheduled_at)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: COLORS.text }}>
            {icon} {title}
          </div>
          {customerName && (
            <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>
              {customerName} 고객
            </div>
          )}
        </div>
        {item.reminder_minutes && (
          <span style={{
            background: COLORS.primaryBg, color: COLORS.primary,
            borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800,
          }}>
            알림
          </span>
        )}
      </div>
      {!isLast && <Divider />}
    </>
  );
}

function CustomerMiniRow({ customer, isLast, onClick }) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: '100%', border: 'none', background: 'transparent',
          padding: '8px 0', display: 'flex', alignItems: 'center',
          gap: 12, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 14,
          background: 'linear-gradient(135deg,#C4B5FD,#8B5CF6)',
          color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 900, flexShrink: 0,
        }}>
          {(customer.name || '?').charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 14 }}>{customer.name}</div>
          <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 2 }}>{customer.phone || '-'}</div>
        </div>
        <span style={{
          background: COLORS.primaryBg, color: COLORS.primary,
          borderRadius: 999, padding: '4px 9px', fontSize: 11, fontWeight: 800,
        }}>
          {customer.status || '상담중'}
        </span>
      </button>
      {!isLast && <Divider />}
    </>
  );
}

function QuickButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${COLORS.border}`, background: '#fff',
        borderRadius: 16, padding: '14px 10px', cursor: 'pointer',
        boxShadow: '0 8px 18px rgba(124,92,252,0.06)',
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 7 }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.text }}>{label}</div>
    </button>
  );
}

function getMonthDay(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{6}$/.test(s)) return `${s.slice(2, 4)}-${s.slice(4, 6)}`;
  if (/^\d{8}$/.test(s)) return `${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const match = s.match(/(\d{2})[-./](\d{2})$/);
  if (match) return `${match[1]}-${match[2]}`;
  const iso = s.match(/\d{4}[-./](\d{2})[-./](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  return '';
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

export default function DashboardPage({ user, onNavigate }) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});

  const meta = user?.user_metadata || {};
  const userName = meta.display_name || user?.email?.split('@')[0] || '사용자';
  const position = meta.position || '';

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [todaySched, recent, counts, all] = await Promise.all([
        scheduleService.today().catch(() => []),
        customerService.recent(4).catch(() => []),
        customerService.statusCounts().catch(() => ({})),
        customerService.list({ status: '전체', search: '' }).catch(() => []),
      ]);
      setTodaySchedules(todaySched || []);
      setRecentCustomers(recent || []);
      setStatusCounts(counts || {});
      setAllCustomers(all || []);
    } finally {
      setLoading(false);
    }
  }

  const totalCustomers = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const todayMMDD = getMonthDay(todayStr());
 const birthdayCustomers = allCustomers.filter((c) => {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDate = today.getDate();

  const raw = String(c.ssn || c.birth || '').trim();

  const ssnMatch = raw.match(/^(\d{2})(\d{2})(\d{2})/);
  if (ssnMatch) {
    const month = parseInt(ssnMatch[2], 10);
    const date = parseInt(ssnMatch[3], 10);
    return month === todayMonth && date === todayDate;
  }

  const isoMatch = raw.match(/\d{4}[-./](\d{2})[-./](\d{2})/);
  if (isoMatch) {
    const month = parseInt(isoMatch[1], 10);
    const date = parseInt(isoMatch[2], 10);
    return month === todayMonth && date === todayDate;
  }

  return false;
});
  const carExpiringCustomers = allCustomers.filter((c) => {
    const d = daysUntil(c.car_expiry || c.car_expiry_date || c.car_expiry_at);
    return d !== null && d >= 0 && d <= 30;
  });
  const babyCustomers = allCustomers.filter((c) => c.customer_type === '태아' || c.baby_name);
  const petCustomers = allCustomers.filter((c) => c.customer_type === '펫' || c.pet_name);
  const taskCount = todaySchedules.length + birthdayCustomers.length + carExpiringCustomers.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minHeight: 0 }}>
      {isMobile && (
        <Header
          user={user}
          notifCount={3}
          onNotif={() => onNavigate('notifications')}
          onProfile={() => onNavigate('more')}
        />
      )}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '16px 16px 72px' : '28px 0 44px' }}>
        {isMobile ? (
          <MobileDashboard
            userName={userName} position={position} loading={loading}
            todaySchedules={todaySchedules} recentCustomers={recentCustomers}
            totalCustomers={totalCustomers} taskCount={taskCount}
            birthdayCustomers={birthdayCustomers} carExpiringCustomers={carExpiringCustomers}
            babyCustomers={babyCustomers} petCustomers={petCustomers}
            setShowScheduleForm={setShowScheduleForm} onNavigate={onNavigate}
          />
        ) : (
         <PcDashboard
  userName={userName} position={position} loading={loading}
  todaySchedules={todaySchedules} recentCustomers={recentCustomers}
  totalCustomers={totalCustomers} taskCount={taskCount}
  birthdayCustomers={birthdayCustomers} carExpiringCustomers={carExpiringCustomers}
  babyCustomers={babyCustomers} petCustomers={petCustomers}
  setShowScheduleForm={setShowScheduleForm} onNavigate={onNavigate}
  statusCounts={statusCounts} // ✅ 추가
/>
        )}
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

function MobileDashboard({
  userName, position, loading, todaySchedules, recentCustomers,
  totalCustomers, taskCount, birthdayCustomers, carExpiringCustomers,
  babyCustomers, petCustomers, setShowScheduleForm, onNavigate,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 0 }}>
      <div style={{
        background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
        borderRadius: 24, padding: '24px 20px', color: '#fff',
        boxShadow: '0 14px 34px rgba(124,58,237,0.28)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 23, fontWeight: 600, lineHeight: 1.05 }}>
              👋 {userName}{position ? ` ${position}` : ''}님
            </div>
            <div style={{ fontSize: 15, opacity: 0.92, marginTop: 9 }}>
              오늘도 좋은 하루 보내세요~!
            </div>
          </div>
          <div style={{
            textAlign: 'right', flexShrink: 0, display: 'flex',
            flexDirection: 'column', justifyContent: 'center',
            alignItems: 'flex-end', minWidth: 108,
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.1, opacity: 0.95 }}>
              {new Date().getFullYear()}년 {new Date().getMonth() + 1}월 {new Date().getDate()}일
            </div>
            <div style={{ fontSize: 18, fontWeight: 400, marginTop: 5, letterSpacing: -0.3, lineHeight: 1 }}>
              {['일','월','화','수','목','금','토'][new Date().getDay()]}요일
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
          <div
            onClick={() => onNavigate('schedule')}
            style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 18, padding: 16, color: COLORS.text, cursor: 'pointer' }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.primary }}>오늘 일정</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{todaySchedules.length}건</div>
          </div>
          <div
            onClick={() => onNavigate('notifications')}
            style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 18, padding: 16, color: COLORS.text, cursor: 'pointer' }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.primary }}>할 일</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{taskCount}건</div>
          </div>
        </div>
      </div>

      <DashboardSection
        title="오늘의 주요 일정"
        icon="📅"
        right={
          <button
            onClick={() => setShowScheduleForm(true)}
            style={{
              border: 'none', background: COLORS.primary, color: '#fff',
              borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 800,
            }}
          >
            + 추가
          </button>
        }
      >
        {loading ? (
          <LoadingSpinner />
        ) : todaySchedules.length === 0 ? (
          <EmptyState icon="📅" message="오늘 일정이 없습니다" />
        ) : (
          todaySchedules.slice(0, 4).map((s, i) => (
            <ScheduleRow key={s.id || i} item={s} isLast={i === Math.min(todaySchedules.length, 4) - 1} />
          ))
        )}
      </DashboardSection>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <MiniStatCard
          icon={cakeImg} title="오늘 생일" value={`${birthdayCustomers.length}명`}
          sub="고객 생일 확인" bg="#FFF1F2"
          onClick={() => onNavigate('customers', { filter: '생일' })}
        />
        <MiniStatCard
          icon={carImg} title="자동차 만기" value={`${carExpiringCustomers.length}건`}
          sub="30일 이내" bg="#EFF6FF"
          onClick={() => onNavigate('customers', { filter: '자동차만기' })}
        />
        <MiniStatCard
          icon={babyImg} title="태아 D-day" value={`${babyCustomers.length}명`}
          sub="출산 예정 고객" bg="#FFF7ED"
          onClick={() => onNavigate('customers', { filter: '태아' })}
        />
        <MiniStatCard
          icon={dogImg} title="펫보험 고객" value={`${petCustomers.length}명`}
          sub="반려동물 고객관리" bg="#ECFDF5"
          onClick={() => onNavigate('customers', { filter: '펫' })}
        />
      </div>

      <DashboardSection title="최근 등록 고객" icon="👥">
        {loading ? (
          <LoadingSpinner />
        ) : recentCustomers.length === 0 ? (
          <EmptyState icon="👥" message="고객이 없습니다" />
        ) : (
          recentCustomers.map((c, i) => (
            <CustomerMiniRow
              key={c.id || i} customer={c}
              isLast={i === recentCustomers.length - 1}
              onClick={() => onNavigate('customerDetail', { id: c.db_id || c.id })}
            />
          ))
        )}
      </DashboardSection>

      <div style={{ position: 'fixed', right: 22, bottom: 74, zIndex: 10 }}>
        <button
          onClick={() => setShowScheduleForm(true)}
          style={{
            width: 58, height: 58, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)',
            color: '#fff', fontSize: 30,
            boxShadow: '0 12px 28px rgba(124,58,237,0.38)', cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function PcDashboard({
  userName, position, loading, todaySchedules, recentCustomers,
  totalCustomers, taskCount, birthdayCustomers, carExpiringCustomers,
  babyCustomers, petCustomers, setShowScheduleForm, onNavigate,
  statusCounts, // ✅ 추가
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <MiniStatCard icon="📅" title="오늘 일정" value={`${todaySchedules.length}건`} sub="오늘 예정된 일정" bg="#F5F3FF"
  onClick={() => onNavigate('schedule')}
/>
<MiniStatCard icon="✅" title="할 일" value={`${taskCount}건`} sub="오늘 처리할 업무" bg="#FFF1F2"
  onClick={() => onNavigate('notifications')}
/>
<MiniStatCard icon="👥" title="전체 고객" value={`${totalCustomers}명`} sub="등록 고객 수" bg="#FFFBEB"
  onClick={() => onNavigate('customers', { filter: '전체' })}
/>
<MiniStatCard
  icon="💬"
  title="상담중 고객"
  value={`${statusCounts['상담중'] || 0}명`}
  sub="현재 상담 진행중"
  bg="#ECFDF5"
  onClick={() => onNavigate('customers', { filter: '상담중' })}
/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 18, alignItems: 'start' }}>
        <DashboardSection title="오늘의 일정" icon="📅">
          {loading ? (
            <LoadingSpinner />
          ) : todaySchedules.length === 0 ? (
            <EmptyState icon="📅" message="오늘 일정이 없습니다" />
          ) : (
            todaySchedules.slice(0, 5).map((s, i) => (
              <ScheduleRow key={s.id || i} item={s} isLast={i === Math.min(todaySchedules.length, 5) - 1} />
            ))
          )}
        </DashboardSection>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <MiniStatCard
            icon={cakeImg} title="오늘 생일 고객" value={`${birthdayCustomers.length}명`}
            sub="생일 고객 리스트" bg="#FFF1F2"
            onClick={() => onNavigate('customers', { filter: '생일' })}
          />
          <MiniStatCard
            icon={carImg} title="자동차 만기 고객" value={`${carExpiringCustomers.length}건`}
            sub="30일 이내 만기" bg="#EFF6FF"
            onClick={() => onNavigate('customers', { filter: '자동차만기' })}
          />
          <MiniStatCard
            icon={babyImg} title="태아 D-day" value={`${babyCustomers.length}명`}
            sub="출산 예정 고객" bg="#FFF7ED"
            onClick={() => onNavigate('customers', { filter: '태아' })}
          />
          <MiniStatCard
            icon={dogImg} title="펫보험 고객" value={`${petCustomers.length}명`}
            sub="반려동물 고객 관리" bg="#ECFDF5"
            onClick={() => onNavigate('customers', { filter: '펫' })}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <DashboardSection title="최근 등록 고객" icon="👥">
          {loading ? (
            <LoadingSpinner />
          ) : recentCustomers.length === 0 ? (
            <EmptyState icon="👥" message="고객이 없습니다" />
          ) : (
            recentCustomers.map((c, i) => (
              <CustomerMiniRow
                key={c.id || i} customer={c}
                isLast={i === recentCustomers.length - 1}
                onClick={() => onNavigate('customerDetail', { id: c.db_id || c.id })}
              />
            ))
          )}
        </DashboardSection>

        <DashboardSection title="빠른 메뉴" icon="⚡">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <QuickButton icon="👤" label="고객 등록" onClick={() => onNavigate('customers')} />
            <QuickButton icon="📅" label="일정 등록" onClick={() => setShowScheduleForm(true)} />
            <QuickButton icon="🌳" label="소개트리" onClick={() => onNavigate('tree')} />
            <QuickButton icon="📞" label="보험사 연락처" onClick={() => onNavigate('insuranceContact')} />
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}