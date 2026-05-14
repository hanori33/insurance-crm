import React, { useState } from 'react';
import { COLORS } from '../constants';
import Modal from './Modal';
import Field from './Field';
import scheduleService from '../services/scheduleService';

const SCHEDULE_TYPES = [
  { value: 'phone', label: '전화상담', icon: '📞' },
  { value: 'message', label: '카톡/문자', icon: '💬' },
  { value: 'visit', label: '방문상담', icon: '🏠' },
  { value: 'document', label: '청약/서류', icon: '📄' },
  { value: 'payment', label: '보험료 관리', icon: '💰' },
  { value: 'contract', label: '계약관리', icon: '🔄' },
  { value: 'car', label: '자동차 만기', icon: '🚗' },
  { value: 'birthday', label: '생일', icon: '🎂' },
  { value: 'etc', label: '기타', icon: '🔔' },
];

const REMINDER_OPTIONS = [
  { value: 'none', label: '알림 없음' },
  { value: '10', label: '10분 전' },
  { value: '30', label: '30분 전' },
  { value: '60', label: '1시간 전' },
  { value: '1440', label: '하루 전' },
];

const EMOJI_OPTIONS = [
  '📞','💬','🏠','📄','💰','🚗','🎂','💍',
  '🏋️','✈️','☕','🍺','🛍️','🏥','❤️','📚',
  '🐶','👶','🎮','🧾','🎵','🧘','💻','🛒'
];

const COLOR_OPTIONS = [
  { value: '#F8D7DA', label: '핑크' },
  { value: '#FCE1C6', label: '피치' },
  { value: '#FFF3BF', label: '옐로우' },
  { value: '#D8F3DC', label: '민트' },
  { value: '#D6EAF8', label: '하늘' },
  { value: '#E5D4FF', label: '라벤더' },
  { value: '#ECECEC', label: '그레이' },
];

export default function ScheduleForm({ visible, onClose, onSave, dateStr, initial = null }) {
  const isEdit = !!initial;

  const defaultTime = initial?.scheduled_at
    ? new Date(initial.scheduled_at).toTimeString().slice(0, 5)
    : '09:00';

  const [title, setTitle] = useState(initial?.title || '');
  const [customer, setCustomer] = useState(initial?.customer_name || '');
  const [time, setTime] = useState(defaultTime);

  const [scheduleType, setScheduleType] = useState(initial?.schedule_type || 'phone');
  const [selectedEmoji, setSelectedEmoji] = useState(
  initial?.schedule_icon || '📞'
);

const [selectedColor, setSelectedColor] = useState(
  initial?.color || '#E5D4FF'
);
  const [memo, setMemo] = useState(initial?.memo || '');
  const [nextAction, setNextAction] = useState(initial?.next_action || '');
  const [reminderMinutes, setReminderMinutes] = useState(
    initial?.reminder_minutes ? String(initial.reminder_minutes) : 'none'
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedType = SCHEDULE_TYPES.find(t => t.value === scheduleType) || SCHEDULE_TYPES[0];

  async function handleSave() {
    if (!title.trim()) {
      setError('일정 제목을 입력하세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        title: `${selectedEmoji} ${title.trim()}`,
        color: selectedColor,
        customer_name: customer.trim(),
        scheduled_at: `${dateStr}T${time}:00`,

        schedule_type: scheduleType,
        schedule_icon: selectedEmoji,
        memo: memo.trim(),
        next_action: nextAction.trim(),
        reminder_minutes: reminderMinutes === 'none' ? null : Number(reminderMinutes),
      };

      if (isEdit) await scheduleService.update(initial.id, payload);
      else await scheduleService.create(payload);

      onSave();
      onClose();
    } catch (e) {
      setError(e.message || '일정 저장 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} title={isEdit ? '일정 수정' : '일정 등록'}>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 8, display: 'block' }}>
          일정 종류
        </span>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}>
          {SCHEDULE_TYPES.map(type => {
            const active = scheduleType === type.value;

            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setScheduleType(type.value)}
                style={{
                  border: active ? `1.5px solid ${COLORS.primary}` : `1.5px solid ${COLORS.border}`,
                  background: active ? COLORS.primaryBg : '#FAFAFA',
                  color: active ? COLORS.primary : COLORS.text,
                  borderRadius: 12,
                  padding: '10px 6px',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{type.icon}</div>
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      <Field
        icon="📝"
        placeholder="일정 제목"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <Field
        icon="👤"
        placeholder="고객명 (선택)"
        value={customer}
        onChange={e => setCustomer(e.target.value)}
      />

      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
          시간
        </span>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          style={{
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            color: COLORS.text,
            background: '#FAFAFA',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
          상담 내용
        </span>
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="상담한 내용이나 확인할 내용을 적어주세요"
          rows={4}
          style={{
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            color: COLORS.text,
            background: '#FAFAFA',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
          다음 액션
        </span>
        <textarea
          value={nextAction}
          onChange={e => setNextAction(e.target.value)}
          placeholder="예: 비교안 보내기, 서류 요청, 다음 통화 예약"
          rows={2}
          style={{
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            color: COLORS.text,
            background: '#FAFAFA',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
          알림
        </span>
        <select
          value={reminderMinutes}
          onChange={e => setReminderMinutes(e.target.value)}
          style={{
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            color: COLORS.text,
            background: '#FAFAFA',
            fontFamily: 'inherit',
          }}
        >
          {REMINDER_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 12,
          border: 'none',
          background: COLORS.primary,
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '저장 중...' : isEdit ? '수정 완료' : '일정 등록'}
      </button>
    </Modal>
  );
}