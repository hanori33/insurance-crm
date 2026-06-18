// src/pages/DashboardPage.jsx
import babyImg from '../assets/baby.png';
import dogImg from '../assets/dog.png';
import carImg from '../assets/car.png';
import cakeImg from '../assets/cake.png';
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card, Divider, LoadingSpinner } from '../components/Common';
import EmptyState from '../components/EmptyState';
import ScheduleForm from '../components/ScheduleForm';
import customerService from '../services/customerService';
import scheduleService from '../services/scheduleService';
import { toTimeStr, todayStr } from '../utils';
import noticeService from '../services/noticeService';
import contactRecommendationService from '../services/contactRecommendationService';
import NoticeForm from '../components/NoticeForm';
import Modal from '../components/Modal';

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
        width: '100%',
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
        <div
          style={{
            position: 'absolute',
            right: 18,
            bottom: 18,
            width: 70,
            height: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 34,
            color,
            zIndex: 1,
          }}
        >
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
          <span
            style={{
              background: COLORS.primaryBg,
              color: COLORS.primary,
              borderRadius: 999,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 800,
            }}
          >
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
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            background: 'linear-gradient(135deg,#C4B5FD,#8B5CF6)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          {(customer.name || '?').charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 14 }}>{customer.name}</div>
          <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 2 }}>{customer.phone || '-'}</div>
        </div>
        <span
          style={{
            background: COLORS.primaryBg,
            color: COLORS.primary,
            borderRadius: 999,
            padding: '4px 9px',
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {customer.status || '상담중'}
        </span>
      </button>
      {!isLast && <Divider />}
    </>
  );
}

function AiContactRecommendationSection({ loading, contactRecommendations = [], onNavigate, compact = false }) {
  const visibleRecommendations = contactRecommendations.slice(0, compact ? 3 : 5);

  return (
    <DashboardSection title="AI 연락 추천 고객" icon="🔥">
      {loading ? (
        <LoadingSpinner />
      ) : visibleRecommendations.length === 0 ? (
        <EmptyState icon="🤖" message="오늘 추천할 고객이 없습니다" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 10 }}>
          {visibleRecommendations.map((item, i) => {
            const customer = item.customer || {};
            const customerId = customer.db_id || customer.id || customer.app_customer_id;
            const firstReason = item.reasons?.[0] || '연락 가치가 있는 고객입니다.';

            return (
              <button
                key={customerId || i}
                type="button"
                onClick={() => onNavigate('customerDetail', { id: customerId })}
                style={{
                  width: '100%',
                  border: `1px solid ${COLORS.border}`,
                  background: '#fff',
                  borderRadius: compact ? 14 : 16,
                  padding: compact ? '9px 11px' : '11px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 6px 14px rgba(124,92,252,0.045)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 12 }}>
                  <div
                    style={{
                      width: compact ? 34 : 38,
                      height: compact ? 34 : 38,
                      borderRadius: compact ? 12 : 14,
                      background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 950,
                      fontSize: compact ? 13 : 14,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontWeight: 900, color: COLORS.text, fontSize: compact ? 13 : 14 }}>
                        {customer.name || '이름 없음'}
                      </div>
                      <div style={{ color: COLORS.primary, fontWeight: 950, fontSize: compact ? 12 : 13, whiteSpace: 'nowrap' }}>
                        {item.score}점
                      </div>
                    </div>

                    <div style={{ marginTop: 3, color: COLORS.primary, fontWeight: 850, fontSize: compact ? 11.5 : 12 }}>
                      {item.recommendedAction || '안부 연락'}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        color: COLORS.textGray,
                        fontSize: compact ? 11 : 12,
                        lineHeight: 1.35,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {firstReason}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </DashboardSection>
  );
}

function QuickButton({ icon, label, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${COLORS.border}`,
        background: '#fff',
        borderRadius: compact ? 14 : 16,
        padding: compact ? '10px 4px' : '14px 10px',
        cursor: 'pointer',
        boxShadow: '0 8px 18px rgba(124,92,252,0.06)',
        minHeight: compact ? 70 : 86,
      }}
    >
      <div style={{ fontSize: compact ? 20 : 24, marginBottom: compact ? 5 : 7 }}>{icon}</div>
      <div style={{ fontSize: compact ? 10.5 : 12, fontWeight: 800, color: COLORS.text, wordBreak: 'keep-all' }}>{label}</div>
    </button>
  );
}

const QUICK_MENU_OPTIONS = [
  {
    id: 'customers',
    icon: '👤',
    label: '고객등록',
    action: ({ onNavigate }) => onNavigate('customers'),
  },
  {
    id: 'consulting',
    icon: '💬',
    label: '상담기록',
    action: ({ onNavigate }) => onNavigate('consulting'),
  },
  {
    id: 'fax',
    icon: '📠',
    label: '팩스청구',
    action: ({ onNavigate }) => onNavigate('fax'),
  },
  {
    id: 'insuranceContact',
    icon: '📞',
    label: '보험사',
    action: ({ onNavigate }) => onNavigate('insuranceContact'),
  },
  {
    id: 'scheduleAdd',
    icon: '📅',
    label: '일정등록',
    action: ({ setShowScheduleForm }) => setShowScheduleForm(true),
  },
  {
    id: 'schedule',
    icon: '🗓️',
    label: '일정관리',
    action: ({ onNavigate }) => onNavigate('schedule'),
  },
  {
    id: 'tree',
    icon: '🌳',
    label: '소개트리',
    action: ({ onNavigate }) => onNavigate('tree'),
  },
  {
    id: 'sales',
    icon: '📊',
    label: '통계분석',
    action: ({ onNavigate }) => onNavigate('sales'),
  },
  {
    id: 'notices',
    icon: '📢',
    label: '공지사항',
    action: ({ onNavigate }) => onNavigate('notices'),
  },
  {
    id: 'notifications',
    icon: '🔔',
    label: '알림센터',
    action: ({ onNavigate }) => onNavigate('notifications'),
  },
  {
    id: 'team',
    icon: '👨‍👩‍👧',
    label: '팀관리',
    action: ({ onNavigate }) => onNavigate('team'),
  },
  {
    id: 'aiCenter',
    icon: '🤖',
    label: 'AI센터',
    action: () => window.open('https://chatgpt.com', '_blank', 'noopener,noreferrer'),
  },
  {
    id: 'gemini',
    icon: '✨',
    label: 'Gemini',
    action: () => window.open('https://gemini.google.com', '_blank', 'noopener,noreferrer'),
  },
  {
    id: 'claude',
    icon: '📄',
    label: 'Claude',
    action: () => window.open('https://claude.ai', '_blank', 'noopener,noreferrer'),
  },
];

const quickEditSmallButtonStyle = {
  border: 'none',
  background: '#EEF2FF',
  color: '#4338CA',
  borderRadius: 8,
  padding: '4px 8px',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: 28,
};

const DEFAULT_QUICK_MENU_IDS = [
  'customers',
  'consulting',
  'fax',
  'insuranceContact',
  'scheduleAdd',
  'tree',
  'sales',
  'aiCenter',
];

function QuickMenuSection({ isMobile = false, onNavigate, setShowScheduleForm }) {
  const storageKey = 'boplan_quick_menu_ids_v1';
  const [showEdit, setShowEdit] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch (_e) {}

    return DEFAULT_QUICK_MENU_IDS;
  });

  const visibleMenus = selectedIds
    .map(id => QUICK_MENU_OPTIONS.find(menu => menu.id === id))
    .filter(Boolean);

  function toggleMenu(id) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id);
      return [...prev, id];
    });
  }

  function moveMenu(id, direction) {
    setSelectedIds(prev => {
      const index = prev.indexOf(id);
      if (index < 0) return prev;

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;

      const next = [...prev];
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;
      return next;
    });
  }

  function resetQuickMenus() {
    setSelectedIds(DEFAULT_QUICK_MENU_IDS);
  }

  function saveQuickMenus() {
    if (selectedIds.length === 0) {
      alert('빠른메뉴를 최소 1개 이상 선택해주세요.');
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(selectedIds));
    setShowEdit(false);
  }

  return (
    <>
      <DashboardSection
        title="빠른 메뉴"
        icon="⚡"
        right={
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            style={{
              border: 'none',
              background: COLORS.primaryBg,
              color: COLORS.primary,
              borderRadius: 999,
              padding: '7px 11px',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            ⚙️ 편집
          </button>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? 8 : 12,
          }}
        >
          {visibleMenus.map(menu => (
            <QuickButton
              key={menu.id}
              icon={menu.icon}
              label={menu.label}
              compact={isMobile}
              onClick={() => menu.action({ onNavigate, setShowScheduleForm })}
            />
          ))}
        </div>
      </DashboardSection>

      <Modal
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        title="⚡ 빠른메뉴 편집"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              background: COLORS.primaryBg,
              color: COLORS.primary,
              borderRadius: 12,
              padding: '10px 11px',
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.45,
            }}
          >
            체크한 메뉴만 홈에 보여요. 위/아래 버튼으로 순서도 바꿀 수 있어요.
          </div>

          {QUICK_MENU_OPTIONS.map(menu => {
            const checked = selectedIds.includes(menu.id);
            const order = selectedIds.indexOf(menu.id);

            return (
              <div
                key={menu.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: '10px 11px',
                  background: checked ? '#fff' : '#F8FAFC',
                }}
              >
                <label
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 850,
                    color: COLORS.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMenu(menu.id)}
                  />
                  <span style={{ fontSize: 18 }}>{menu.icon}</span>
                  {menu.label}
                </label>

                {checked && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => moveMenu(menu.id, -1)}
                      disabled={order <= 0}
                      style={{ ...quickEditSmallButtonStyle, opacity: order <= 0 ? 0.35 : 1 }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMenu(menu.id, 1)}
                      disabled={order === selectedIds.length - 1}
                      style={{ ...quickEditSmallButtonStyle, opacity: order === selectedIds.length - 1 ? 0.35 : 1 }}
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={resetQuickMenus}
              style={{
                border: 'none',
                background: COLORS.primaryBg,
                color: COLORS.primary,
                borderRadius: 12,
                padding: '12px 0',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              기본값
            </button>
            <button
              type="button"
              onClick={saveQuickMenus}
              style={{
                border: 'none',
                background: COLORS.primary,
                color: '#fff',
                borderRadius: 12,
                padding: '12px 0',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
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

function getCarExpiry(c) {
  return (
    c.car_expiry ||
    c.carExpiry ||
    c.car_expiry_date ||
    c.carExpiryDate ||
    c.car_expiry_at ||
    ''
  );
}

function isBirthdayToday(c) {
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
}

export default function DashboardPage({ user, onNavigate }) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [notices, setNotices] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [myRole, setMyRole] = useState('agent');
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [contactRecommendations, setContactRecommendations] = useState([]);

  const meta = user?.user_metadata || {};
  const userName = meta.display_name || user?.email?.split('@')[0] || '사용자';
  const position = meta.position || '';

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const [todaySched, recent, counts, all, noticeList, readIdList, role, recommendations] = await Promise.all([
        scheduleService.today().catch(() => []),
        customerService.recent(4).catch(() => []),
        customerService.statusCounts().catch(() => ({})),
        customerService.list({ status: '전체', search: '' }).catch(() => []),
        noticeService.list().catch(() => []),
        noticeService.getReadIds().catch(() => []),
        noticeService.getMyRole().catch(() => 'agent'),
        contactRecommendationService.list(5).catch(() => []),
      ]);

      setTodaySchedules(todaySched || []);
      setRecentCustomers(recent || []);
      setStatusCounts(counts || {});
      setAllCustomers(all || []);
      setNotices(noticeList || []);
      setReadIds(readIdList || []);
      setMyRole(role || 'agent');
      setContactRecommendations(recommendations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const totalCustomers = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const birthdayCustomers = allCustomers.filter(isBirthdayToday);

  const carExpiringCustomers = allCustomers.filter((c) => {
    const d = daysUntil(getCarExpiry(c));
    return d !== null && d >= 0 && d <= 30;
  });

  const babyCustomers = allCustomers.filter((c) => c.customer_type === '태아' || c.baby_name);
  const petCustomers = allCustomers.filter((c) => c.customer_type === '펫' || c.pet_name);
  const taskCount = todaySchedules.length + birthdayCustomers.length + carExpiringCustomers.length;

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        boxSizing: 'border-box',
        background: COLORS.bg,
      }}
    >
      <div
        style={{
          padding: isMobile
            ? '16px 16px calc(116px + env(safe-area-inset-bottom))'
            : '28px 0 44px',
          boxSizing: 'border-box',
        }}
      >
        {isMobile ? (
          <MobileDashboard
            userName={userName}
            position={position}
            loading={loading}
            todaySchedules={todaySchedules}
            recentCustomers={recentCustomers}
            contactRecommendations={contactRecommendations}
            totalCustomers={totalCustomers}
            taskCount={taskCount}
            birthdayCustomers={birthdayCustomers}
            carExpiringCustomers={carExpiringCustomers}
            babyCustomers={babyCustomers}
            petCustomers={petCustomers}
            setShowScheduleForm={setShowScheduleForm}
            onNavigate={onNavigate}
          />
        ) : (
          <PcDashboard
            userName={userName}
            position={position}
            loading={loading}
            todaySchedules={todaySchedules}
            recentCustomers={recentCustomers}
            contactRecommendations={contactRecommendations}
            totalCustomers={totalCustomers}
            taskCount={taskCount}
            birthdayCustomers={birthdayCustomers}
            carExpiringCustomers={carExpiringCustomers}
            babyCustomers={babyCustomers}
            petCustomers={petCustomers}
            setShowScheduleForm={setShowScheduleForm}
            onNavigate={onNavigate}
            statusCounts={statusCounts}
            notices={notices}
            readIds={readIds}
            myRole={myRole}
            setReadIds={setReadIds}
            setShowNoticeForm={setShowNoticeForm}
          />
        )}
      </div>

      <ScheduleForm
        visible={showScheduleForm}
        onClose={() => setShowScheduleForm(false)}
        onSave={() => {
          load();
          setShowScheduleForm(false);
        }}
        dateStr={todayStr()}
        initial={null}
      />

      {showNoticeForm && (
        <NoticeForm
          visible={showNoticeForm}
          onClose={() => setShowNoticeForm(false)}
          myRole={myRole}
          userName={userName}
          onSave={async () => {
            const [noticeList, readIdList] = await Promise.all([
              noticeService.list().catch(() => []),
              noticeService.getReadIds().catch(() => []),
            ]);

            setNotices(noticeList || []);
            setReadIds(readIdList || []);
            setShowNoticeForm(false);
          }}
        />
      )}
    </div>
  );
}

function MobileDashboard({
  userName,
  position,
  loading,
  todaySchedules,
  recentCustomers,
  contactRecommendations,
  totalCustomers,
  taskCount,
  birthdayCustomers,
  carExpiringCustomers,
  babyCustomers,
  petCustomers,
  setShowScheduleForm,
  onNavigate,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
          borderRadius: 24,
          padding: '24px 20px',
          color: '#fff',
          boxShadow: '0 14px 34px rgba(124,58,237,0.28)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 23, fontWeight: 600, lineHeight: 1.05 }}>
              👋 {userName}
              {position ? ` ${position}` : ''}님
            </div>
            <div style={{ fontSize: 15, opacity: 0.92, marginTop: 9 }}>
              오늘도 좋은 하루 보내세요~!
            </div>
          </div>

          <div
            style={{
              textAlign: 'right',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-end',
              minWidth: 108,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.1, opacity: 0.95 }}>
              {new Date().getFullYear()}년 {new Date().getMonth() + 1}월 {new Date().getDate()}일
            </div>
            <div style={{ fontSize: 18, fontWeight: 400, marginTop: 5, letterSpacing: -0.3, lineHeight: 1 }}>
              {['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()]}요일
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
          <div
            onClick={() => onNavigate('schedule')}
            style={{
              background: 'rgba(255,255,255,0.9)',
              borderRadius: 18,
              padding: 16,
              color: COLORS.text,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.primary }}>오늘 일정</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{todaySchedules.length}건</div>
          </div>

          <div
            onClick={() => onNavigate('notifications')}
            style={{
              background: 'rgba(255,255,255,0.9)',
              borderRadius: 18,
              padding: 16,
              color: COLORS.text,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.primary }}>할 일</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{taskCount}건</div>
          </div>
        </div>
      </div>

      <QuickMenuSection
        isMobile
        onNavigate={onNavigate}
        setShowScheduleForm={setShowScheduleForm}
      />

      <AiContactRecommendationSection
        loading={loading}
        contactRecommendations={contactRecommendations}
        onNavigate={onNavigate}
        compact
      />

      <DashboardSection
        title="오늘의 주요 일정"
        icon="📅"
        right={
          <button
            onClick={() => setShowScheduleForm(true)}
            style={{
              border: 'none',
              background: COLORS.primary,
              color: '#fff',
              borderRadius: 999,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 800,
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
            <ScheduleRow
              key={s.id || i}
              item={s}
              isLast={i === Math.min(todaySchedules.length, 4) - 1}
            />
          ))
        )}
      </DashboardSection>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <MiniStatCard
          icon={cakeImg}
          title="오늘 생일"
          value={`${birthdayCustomers.length}명`}
          sub="고객 생일 확인"
          bg="#FFF1F2"
          onClick={() => onNavigate('customers', { filter: '생일' })}
        />

        <MiniStatCard
          icon={carImg}
          title="자동차 만기"
          value={`${carExpiringCustomers.length}건`}
          sub="30일 이내"
          bg="#EFF6FF"
          onClick={() => onNavigate('customers', { filter: '자동차만기' })}
        />

        <MiniStatCard
          icon={babyImg}
          title="태아 D-day"
          value={`${babyCustomers.length}명`}
          sub="출산 예정 고객"
          bg="#FFF7ED"
          onClick={() => onNavigate('customers', { filter: '태아' })}
        />

        <MiniStatCard
          icon={dogImg}
          title="펫보험 고객"
          value={`${petCustomers.length}명`}
          sub="반려동물 고객관리"
          bg="#ECFDF5"
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
              key={c.id || i}
              customer={c}
              isLast={i === recentCustomers.length - 1}
              onClick={() => onNavigate('customerDetail', { id: c.db_id || c.id })}
            />
          ))
        )}
      </DashboardSection>

      <div
        style={{
          position: 'fixed',
          right: 18,
          bottom: 'calc(92px + env(safe-area-inset-bottom))',
          zIndex: 50,
        }}
      >
        <button
          onClick={() => setShowScheduleForm(true)}
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            border: 'none',
            background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)',
            color: '#fff',
            fontSize: 30,
            boxShadow: '0 12px 28px rgba(124,58,237,0.38)',
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function PcDashboard({
  loading,
  todaySchedules,
  recentCustomers,
  contactRecommendations,
  totalCustomers,
  taskCount,
  birthdayCustomers,
  carExpiringCustomers,
  babyCustomers,
  petCustomers,
  setShowScheduleForm,
  onNavigate,
  statusCounts,
  notices,
  readIds,
  myRole,
  setReadIds,
  setShowNoticeForm,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <MiniStatCard
          icon="📅"
          title="오늘 일정"
          value={`${todaySchedules.length}건`}
          sub="오늘 예정된 일정"
          bg="#F5F3FF"
          onClick={() => onNavigate('schedule')}
        />

        <MiniStatCard
          icon="✅"
          title="할 일"
          value={`${taskCount}건`}
          sub="오늘 처리할 업무"
          bg="#FFF1F2"
          onClick={() => onNavigate('notifications')}
        />

        <MiniStatCard
          icon="👥"
          title="전체 고객"
          value={`${totalCustomers}명`}
          sub="등록 고객 수"
          bg="#FFFBEB"
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
              <ScheduleRow
                key={s.id || i}
                item={s}
                isLast={i === Math.min(todaySchedules.length, 5) - 1}
              />
            ))
          )}
        </DashboardSection>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <MiniStatCard
            icon={cakeImg}
            title="오늘 생일 고객"
            value={`${birthdayCustomers.length}명`}
            sub="생일 고객 리스트"
            bg="#FFF1F2"
            onClick={() => onNavigate('customers', { filter: '생일' })}
          />

          <MiniStatCard
            icon={carImg}
            title="자동차 만기 고객"
            value={`${carExpiringCustomers.length}건`}
            sub="30일 이내 만기"
            bg="#EFF6FF"
            onClick={() => onNavigate('customers', { filter: '자동차만기' })}
          />

          <MiniStatCard
            icon={babyImg}
            title="태아 D-day"
            value={`${babyCustomers.length}명`}
            sub="출산 예정 고객"
            bg="#FFF7ED"
            onClick={() => onNavigate('customers', { filter: '태아' })}
          />

          <MiniStatCard
            icon={dogImg}
            title="펫보험 고객"
            value={`${petCustomers.length}명`}
            sub="반려동물 고객 관리"
            bg="#ECFDF5"
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
                key={c.id || i}
                customer={c}
                isLast={i === recentCustomers.length - 1}
                onClick={() => onNavigate('customerDetail', { id: c.db_id || c.id })}
              />
            ))
          )}
        </DashboardSection>

        <QuickMenuSection
          onNavigate={onNavigate}
          setShowScheduleForm={setShowScheduleForm}
        />
      </div>

      <AiContactRecommendationSection
        loading={loading}
        contactRecommendations={contactRecommendations}
        onNavigate={onNavigate}
        compact
      />

      <DashboardSection
        title="공지사항"
        icon="📢"
        right={
          (myRole === 'superadmin' ||
            myRole === 'division_head' ||
            myRole === 'branch_head' ||
            myRole === 'office_head' ||
            myRole === 'team_leader') && (
            <button
              onClick={() => setShowNoticeForm(true)}
              style={{
                border: 'none',
                background: COLORS.primary,
                color: '#fff',
                borderRadius: 999,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              + 공지 작성
            </button>
          )
        }
      >
        {notices.length === 0 ? (
          <EmptyState icon="📢" message="공지사항이 없습니다" />
        ) : (
          notices.map((n, i) => {
            const isRead = readIds.includes(n.id);

            return (
              <React.Fragment key={n.id}>
                <div
                  onClick={async () => {
                    if (!isRead) {
                      await noticeService.markAsRead(n.id);
                      setReadIds(prev => [...prev, n.id]);
                    }
                    onNavigate('notices');
                  }}
                  style={{
                    padding: '12px 0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>
                        {n.title}
                      </span>
                      {!isRead && (
                        <span
                          style={{
                            background: '#EF4444',
                            color: '#fff',
                            borderRadius: 999,
                            padding: '2px 7px',
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          NEW
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 4 }}>
                      {n.content.split('\n')[0].slice(0, 60)}
                      {n.content.split('\n')[0].length > 60 ? '...' : ''}
                    </div>

                    <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
                      {n.author_name} ({n.author_role}) · {new Date(n.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </div>

                {i < notices.length - 1 && <Divider />}
              </React.Fragment>
            );
          })
        )}
      </DashboardSection>
    </div>
  );
}