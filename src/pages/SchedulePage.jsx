// src/pages/SchedulePage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card, Divider, LoadingSpinner } from '../components/Common';
import EmptyState from '../components/EmptyState';
import ScheduleForm from '../components/ScheduleForm';
import scheduleService from '../services/scheduleService';
import { buildCalendarMatrix, toTimeStr } from '../utils';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ── 달력 컴포넌트 ─────────────────────────────
function Calendar({
  year,
  month,
  selDay,
  today,
  matrix,
  monthSchedules = [],
  onPrev,
  onNext,
  onSelect
}) {
  return (
    <Card style={{ padding: 20 }}>
      {/* 월 네비 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18
      }}>
        <button
          onClick={onPrev}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            color: COLORS.textGray,
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ‹
        </button>

        <span style={{
          fontWeight: 700,
          fontSize: 17,
          color: COLORS.text
        }}>
          {year}년 {month + 1}월
        </span>

        <button
          onClick={onNext}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            color: COLORS.textGray,
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7,1fr)',
        marginBottom: 8
      }}>
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 600,
              padding: '6px 0',
              color:
                i === 0
                  ? '#EF4444'
                  : i === 6
                  ? '#3B82F6'
                  : COLORS.textGray,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 */}
      {matrix.map((week, wi) => (
        <div
          key={wi}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7,1fr)',
            gap: 2,
            marginBottom: 2
          }}
        >
          {week.map((day, di) => {
            const isSel = day === selDay;

            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();

            const isSun = di === 0;
            const isSat = di === 6;

            const dateKey = day
              ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              : null;

            const daySchedules = dateKey
              ? monthSchedules.filter(
                  s => (s.scheduled_at || '').slice(0, 10) === dateKey
                )
              : [];

            return (
              <button
                key={di}
                disabled={!day}
                onClick={() => day && onSelect(day)}
                style={{
                  minHeight: 82,
                  padding: '6px 4px',
                  borderRadius: 12,
                  border: isSel
                    ? `2px solid ${COLORS.primary}`
                    : '1px solid transparent',
                  cursor: day ? 'pointer' : 'default',
                  background: isSel
                    ? COLORS.primaryBg
                    : isToday
                    ? '#F7F3FF'
                    : '#fff',
                  color: !day
                    ? 'transparent'
                    : isToday
                    ? COLORS.primary
                    : isSun
                    ? '#EF4444'
                    : isSat
                    ? '#3B82F6'
                    : COLORS.text,
                  fontWeight: (isSel || isToday) ? 700 : 400,
                  fontSize: 13,
                  lineHeight: 1.2,
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  overflow: 'hidden',
                }}
              >
                {/* 날짜 숫자 */}
                <div style={{
                  marginBottom: 4,
                  textAlign: 'center'
                }}>
                  {day || ''}
                </div>

                {/* 일정 */}
                {daySchedules.slice(0, 2).map((s, idx) => (
                  <div
                    key={s.id || idx}
                    style={{
                      background: s.color || '#E5D4FF',
                      color: '#333',
                      borderRadius: 6,
                      padding: '2px 4px',
                      fontSize: 10,
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.title}
                  </div>
                ))}

                {/* +더보기 */}
                {daySchedules.length > 2 && (
                  <div style={{
                    fontSize: 10,
                    color: COLORS.textGray,
                    marginTop: 2
                  }}>
                    +{daySchedules.length - 2}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </Card>
  );
}

// ── 일정 목록 컴포넌트 ────────────────────────
function ScheduleList({ schedules, loading, dayLabel, onAdd, onEdit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>{dayLabel} 일정</span>
        <button onClick={onAdd} style={{
          background: COLORS.primary, color: '#fff', border: 'none',
          borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>+ 일정 추가</button>
      </div>

      <Card style={{ padding: 0 }}>
        {loading ? <LoadingSpinner /> :
         schedules.length === 0
           ? <EmptyState icon="📅" message="일정이 없습니다" sub="+ 일정 추가 버튼을 눌러보세요" />
           : schedules.map((s, i) => {
               const customerName = s.customers?.name || s.customer_name || '';
               return (
                 <React.Fragment key={s.id || i}>
                   <div onClick={() => onEdit(s)} style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                     {/* 시간 */}
                     <div style={{
                       background: COLORS.primaryBg, borderRadius: 10,
                       padding: '8px 12px', flexShrink: 0,
                       textAlign: 'center', minWidth: 56,
                     }}>
                       <div style={{ fontWeight: 700, color: COLORS.primary, fontSize: 14 }}>{toTimeStr(s.scheduled_at)}</div>
                     </div>
                     {/* 내용 */}
                     <div style={{ flex: 1 }}>
                       <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.text }}>{s.title}</div>
                       {customerName && <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>{customerName} 고객</div>}
                     </div>
                     <span style={{ color: COLORS.textLight }}>›</span>
                   </div>
                   {i < schedules.length - 1 && <Divider style={{ margin: '0 20px' }} />}
                 </React.Fragment>
               );
             })
        }
      </Card>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────
export default function SchedulePage() {
  const isMobile = useIsMobile();
  const today    = new Date();
  const [year, setYear]     = useState(today.getFullYear());
  const [month, setMonth]   = useState(today.getMonth());
  const [selDay, setSelDay] = useState(today.getDate());
  const [schedules, setSchedules] = useState([]);
  const [monthSchedules, setMonthSchedules] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [editItem, setEditItem]   = useState(null);

  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;
  const matrix  = buildCalendarMatrix(year, month);
  const DAY_KR  = ['일', '월', '화', '수', '목', '금', '토'];
  const dayLabel = `${month + 1}월 ${selDay}일 (${DAY_KR[new Date(year, month, selDay).getDay()]})`;

  useEffect(() => {
  loadDay();
  loadMonth();
}, [dateStr, month, year]);

async function loadMonth() {
  try {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const endDate = new Date(year, month + 1, 0).getDate();

    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;

    const { data, error } = await scheduleService.getMonthSchedules(start, end);

    if (error) throw error;

    setMonthSchedules(data || []);
  } catch (e) {
    console.error(e);
  }
}
  
async function loadDay() {
    setLoading(true);
    try { setSchedules(await scheduleService.listByDate(dateStr)); }
    catch(e) { setSchedules([]); }
    finally { setLoading(false); }
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelDay(1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelDay(1);
  }

  // ── 모바일 레이아웃 ───────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ background: COLORS.white, padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0, textAlign: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>일정 관리</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Calendar year={year} month={month} selDay={selDay} today={today} matrix={matrix} onPrev={prevMonth} onNext={nextMonth} onSelect={setSelDay} monthSchedules={monthSchedules}/>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{dayLabel} 일정</span>
            </div>
            <Card style={{ padding: 0 }}>
              {loading ? <LoadingSpinner /> :
               schedules.length === 0
                 ? <EmptyState icon="📅" message="일정이 없습니다" sub="+ 버튼으로 추가하세요" />
                 : schedules.map((s, i) => {
                     const customerName = s.customers?.name || s.customer_name || '';
                     return (
                       <React.Fragment key={s.id || i}>
                         <div onClick={() => { setEditItem(s); setShowForm(true); }} style={{ padding: '13px 16px', cursor: 'pointer' }}>
                           <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                             <span style={{ fontWeight: 700, color: COLORS.primary, fontSize: 13, width: 44, flexShrink: 0 }}>{toTimeStr(s.scheduled_at)}</span>
                             <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.primary, display: 'inline-block', margin: '5px 4px 0', flexShrink: 0 }} />
                             <div style={{ flex: 1 }}>
                               <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{s.title}</div>
                               {s.memo && (
  <div style={{
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 4,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
  }}>
    {s.memo}
  </div>
)}

{s.next_action && (
  <div style={{
    marginTop: 6,
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: 600,
  }}>
    다음 액션: {s.next_action}
  </div>
)}
                               {customerName && <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 2 }}>{customerName} 고객</div>}
                             </div>
                             <span style={{ color: COLORS.textLight }}>›</span>
                           </div>
                         </div>
                         {i < schedules.length - 1 && <Divider style={{ margin: '0 16px' }} />}
                       </React.Fragment>
                     );
                   })
              }
              {/* FAB */}
              <button onClick={() => { setEditItem(null); setShowForm(true); }} style={{
                position: 'absolute', bottom: -26, right: 0,
                width: 52, height: 52, borderRadius: '50%',
                background: COLORS.primary, color: '#fff', border: 'none',
                fontSize: 28, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 18px rgba(124,92,252,0.45)',
              }}>+</button>
            </Card>
          </div>
          <div style={{ height: 40 }} />
        </div>

        <ScheduleForm visible={showForm} onClose={() => { setShowForm(false); setEditItem(null); }} onSave={loadDay} dateStr={dateStr} initial={editItem} />
      </div>
    );
  }


  // ── PC 레이아웃 ───────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0 40px' }}>

        {/* PC: 좌우 2컬럼 */}
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 24, alignItems: 'start' }}>
          {/* 왼쪽: 달력 */}
          <Calendar
            year={year} month={month} selDay={selDay} today={today} matrix={matrix} monthSchedules={monthSchedules}
            onPrev={prevMonth} onNext={nextMonth} onSelect={setSelDay}
          />

          {/* 오른쪽: 일정 목록 */}
          <ScheduleList
            schedules={schedules} loading={loading} dayLabel={dayLabel}
            onAdd={() => { setEditItem(null); setShowForm(true); }}
            onEdit={(s) => { setEditItem(s); setShowForm(true); }}
          />
        </div>
      </div>

      <ScheduleForm visible={showForm} onClose={() => { setShowForm(false); setEditItem(null); }} onSave={loadDay} dateStr={dateStr} initial={editItem} />
    </div>
  );
}