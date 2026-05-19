import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import customerService from '../services/customerService';
import scheduleService from '../services/scheduleService';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function getMonthDay(value) {
  if (!value) return '';
  const s = String(value).trim();
  const ssnMatch = s.match(/^(\d{2})(\d{2})(\d{2})/);
  if (ssnMatch) return `${ssnMatch[2]}-${ssnMatch[3]}`;
  const iso = s.match(/\d{4}[-./](\d{2})[-./](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  return '';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function NotificationsPage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [schedules, customers] = await Promise.all([
        scheduleService.today().catch(() => []),
        customerService.list({ status: '전체', search: '' }).catch(() => []),
      ]);

      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDate = today.getDate();
      const todayMMDD = `${String(todayMonth).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;

      const notifs = [];

      // ① 오늘 일정
      schedules.forEach(s => {
        const cleanTitle = (s.title || '').replace(/^[^\s]+\s/, '');
        const time = s.scheduled_at ? s.scheduled_at.slice(11, 16) : '';
        notifs.push({
          id: `schedule-${s.id}`,
          icon: '📅',
          title: '오늘 일정',
          body: `${time} ${s.customer_name || ''} ${cleanTitle}`.trim(),
          time: '오늘',
          color: '#EEF2FF',
        });
      });

      // ② 오늘 생일
      customers.forEach(c => {
        const md = getMonthDay(c.ssn || c.birth);
        if (md === todayMMDD) {
          notifs.push({
            id: `birthday-${c.id}`,
            icon: '🎂',
            title: '오늘 생일',
            body: `${c.name} 고객님의 생일입니다!`,
            time: '오늘',
            color: '#FFF1F2',
          });
        }
      });

      // ③ 자동차 만기 30일 이내
      customers.forEach(c => {
        const d = daysUntil(c.car_expiry);
        if (d !== null && d >= 0 && d <= 30) {
          notifs.push({
            id: `car-${c.id}`,
            icon: '🚗',
            title: '자동차 만기 임박',
            body: `${c.name} 고객 자동차 보험 만기 ${d === 0 ? '오늘' : `${d}일 후`}`,
            time: d === 0 ? '오늘' : `${d}일 후`,
            color: '#EFF6FF',
          });
        }
      });

      // ④ 태아 D-day (출산예정일 30일 이내)
      customers.forEach(c => {
        if (c.customer_type === '태아' || c.baby_name) {
          const d = daysUntil(c.due_date || c.age_date);
          if (d !== null && d >= 0 && d <= 30) {
            notifs.push({
              id: `baby-${c.id}`,
              icon: '👶',
              title: '태아 D-day',
              body: `${c.name} 고객 출산예정일 ${d === 0 ? '오늘' : `D-${d}`}`,
              time: d === 0 ? '오늘' : `D-${d}`,
              color: '#FFF7ED',
            });
          }
        }
      });

      // ⑤ 최근 7일 등록 고객
      customers
        .filter(c => {
          if (!c.created_at) return false;
          const d = daysUntil(c.created_at.slice(0, 10));
          return d !== null && d >= -7 && d <= 0;
        })
        .slice(0, 5)
        .forEach(c => {
          notifs.push({
            id: `new-${c.id}`,
            icon: '👤',
            title: '새 고객 등록',
            body: `${c.name} 고객이 등록되었습니다`,
            time: timeAgo(c.created_at),
            color: COLORS.primaryBg,
          });
        });

      setNotifications(notifs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        background: COLORS.white, padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
      }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}>←</button>
        )}
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>알림</span>
        <span style={{ fontSize: 13, color: COLORS.primary, cursor: 'pointer', fontWeight: 600 }}
          onClick={() => setNotifications([])}>
          모두 읽음
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <LoadingSpinner />
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', color: COLORS.textGray, marginTop: 60, fontSize: 14 }}>
            새로운 알림이 없습니다
          </div>
        ) : (
          notifications.map(n => (
            <Card key={n.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: n.color || COLORS.primaryBg,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>
                {n.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{n.title}</div>
                <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>{n.time}</div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}