// src/components/CustomerForm.jsx
import React, { useState, useEffect } from 'react';
import { COLORS, CUSTOMER_STATUSES } from '../constants';
import Modal from './Modal';
import Field from './Field';
import customerService from '../services/customerService';

const RELATION_OPTIONS = [
  '가족',
  '지인',
  '친구',
  '동료',
  '고객',
  '고객소개',
  '기타',
];

const EMPTY_FORM = {
  name: '',
  phone: '',
  status: '상담중',
  memo: '',

  birth: '',
  email: '',
  job: '',
  address: '',

  customer_type: '일반',

  pet_name: '',
  baby_name: '',
  due_date: '',

  car_number: '',
  car_expiry: '',

  relation_type: '',
  referrer_app_id: '',
};

export default function CustomerForm({
  visible,
  onClose,
  onSave,
  initial = null,
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState(initial || { ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [referrerSearch, setReferrerSearch] = useState('');
  const [referrerOptions, setReferrerOptions] = useState([]);

  const set = (k, v) =>
    setForm((p) => ({
      ...p,
      [k]: v,
    }));

  useEffect(() => {
    if (!visible) return;

    if (initial) {
      setForm({
        ...EMPTY_FORM,
        ...initial,
        due_date: initial.due_date || '',
        car_expiry: initial.car_expiry || '',
        referrer_app_id: initial.referrer_app_id || '',
      });

      setReferrerSearch(initial.referrer_name || '');
    } else {
      setForm({ ...EMPTY_FORM });
      setReferrerSearch('');
    }

    setError('');
    setLoading(false);
  }, [visible, initial]);

  useEffect(() => {
    async function loadReferrers() {
      try {
        const data = await customerService.list({
          status: '전체',
          search: '',
        });

        const currentId =
          initial?.app_customer_id ||
          initial?.id ||
          initial?.db_id;

        const filtered = (data || []).filter((c) => {
          return (
            String(
              c.app_customer_id ||
                c.id ||
                c.db_id
            ) !== String(currentId)
          );
        });

        setReferrerOptions(filtered);
      } catch (e) {
        console.error(e);
        setReferrerOptions([]);
      }
    }

    if (visible) {
      loadReferrers();
    }
  }, [visible, initial]);

  async function handleSave() {
    if (!form.name.trim()) {
      setError('이름을 입력하세요');
      return;
    }

    if (!form.phone.trim()) {
      setError('전화번호를 입력하세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isEdit) {
        await customerService.update(
          initial.db_id || initial.id,
          form
        );
      } else {
        await customerService.create(form);
      }

      if (!isEdit) {
        setForm({ ...EMPTY_FORM });
        setReferrerSearch('');
      }

      onSave();
      onClose();
    } catch (e) {
      setError(e.message || '저장 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={isEdit ? '고객 수정' : '고객 등록'}
    >
      <Field
        icon="👤"
        placeholder="이름 *"
        value={form.name}
        onChange={(e) =>
          set('name', e.target.value)
        }
      />

      <Field
        icon="📞"
        placeholder="전화번호 *"
        value={form.phone}
        onChange={(e) =>
          set('phone', e.target.value)
        }
        type="tel"
      />

      {/* 상태 */}
      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontSize: 13,
            color: COLORS.textGray,
            marginBottom: 6,
            display: 'block',
          }}
        >
          상태
        </span>

        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {CUSTOMER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set('status', s)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,

                background:
                  form.status === s
                    ? COLORS.primary
                    : COLORS.primaryBg,

                color:
                  form.status === s
                    ? '#fff'
                    : COLORS.primary,

                fontWeight:
                  form.status === s
                    ? 700
                    : 400,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Field
        icon="🎂"
        placeholder="생년월일 (예: 1990-01-01)"
        value={form.birth}
        onChange={(e) =>
          set('birth', e.target.value)
        }
      />

      <Field
        icon="✉️"
        placeholder="이메일"
        value={form.email}
        onChange={(e) =>
          set('email', e.target.value)
        }
        type="email"
      />

      <Field
        icon="💼"
        placeholder="직업"
        value={form.job}
        onChange={(e) =>
          set('job', e.target.value)
        }
      />

      <Field
        icon="📍"
        placeholder="주소"
        value={form.address}
        onChange={(e) =>
          set('address', e.target.value)
        }
      />

      <Field
        icon="🚗"
        placeholder="차량번호"
        value={form.car_number}
        onChange={(e) =>
          set('car_number', e.target.value)
        }
      />

      <Field
        icon="📅"
        placeholder="자동차 만기일 (예: 2026-05-15)"
        value={form.car_expiry}
        onChange={(e) => set('car_expiry', e.target.value)}
      />

      <Field
        icon="🐾"
        placeholder="반려동물명"
        value={form.pet_name}
        onChange={(e) =>
          set('pet_name', e.target.value)
        }
      />

      <Field
        icon="👶"
        placeholder="태아/자녀명"
        value={form.baby_name}
        onChange={(e) => {
          const babyName = e.target.value;

          setForm((prev) => ({
            ...prev,
            baby_name: babyName,
            customer_type: babyName.trim() ? '태아' : prev.customer_type,
            due_date: babyName.trim() ? prev.due_date : '',
          }));
        }}
      />

      {(form.customer_type === '태아' || form.baby_name) && (
        <Field
          icon="📅"
          placeholder="출산예정일 (예: 2026-08-15)"
          value={form.due_date || ''}
          onChange={(e) => set('due_date', e.target.value)}
        />
      )}

      {/* 관계 */}
      <div style={{ marginBottom: 14 }}>
        <span
          style={{
            fontSize: 13,
            color: COLORS.textGray,
            marginBottom: 6,
            display: 'block',
          }}
        >
          관계
        </span>

        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {RELATION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() =>
                set('relation_type', option)
              }
              style={{
                padding: '7px 12px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,

                background:
                  form.relation_type === option
                    ? COLORS.primary
                    : COLORS.primaryBg,

                color:
                  form.relation_type === option
                    ? '#fff'
                    : COLORS.primary,

                fontWeight:
                  form.relation_type === option
                    ? 800
                    : 600,
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* 소개자 */}
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            fontSize: 13,
            color: COLORS.textGray,
            marginBottom: 6,
            display: 'block',
          }}
        >
          누구 소개인가요?
        </span>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#FAFAFA',
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '10px 12px',
          }}
        >
          <span>🔍</span>

          <input
            value={referrerSearch}
            onChange={(e) =>
              setReferrerSearch(
                e.target.value
              )
            }
            placeholder="소개자 고객명 검색"
            style={{
              border: 'none',
              background: 'none',
              outline: 'none',
              flex: 1,
              fontSize: 13,
              color: COLORS.text,
              fontFamily: 'inherit',
            }}
          />
        </div>

        {form.referrer_app_id && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: COLORS.primary,
              fontWeight: 700,
            }}
          >
            소개자 연결 완료

            <button
              type="button"
              onClick={() => {
                set(
                  'referrer_app_id',
                  ''
                );

                setReferrerSearch('');
              }}
              style={{
                marginLeft: 8,
                border: 'none',
                background: '#FEE2E2',
                color: '#DC2626',
                borderRadius: 999,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              해제
            </button>
          </div>
        )}

        {referrerSearch.trim() && (
          <div
            style={{
              marginTop: 8,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              overflow: 'hidden',
              background: '#fff',
              maxHeight: 180,
              overflowY: 'auto',
            }}
          >
            {referrerOptions
              .filter(
                (c) =>
                  c.name?.includes(
                    referrerSearch.trim()
                  ) ||
                  c.phone?.includes(
                    referrerSearch.trim()
                  )
              )
              .slice(0, 10)
              .map((c) => (
                <button
                  key={
                    c.app_customer_id ||
                    c.id
                  }
                  type="button"
                  onClick={() => {
                    set(
                      'referrer_app_id',
                      c.app_customer_id ||
                        c.id
                    );

                    setReferrerSearch(
                      c.name
                    );
                  }}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: '#fff',
                    padding: '10px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: COLORS.text,
                    }}
                  >
                    {c.name}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: COLORS.textGray,
                      marginTop: 2,
                    }}
                  >
                    {c.phone || '-'}
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* 메모 */}
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            fontSize: 13,
            color: COLORS.textGray,
            marginBottom: 6,
            display: 'block',
          }}
        >
          메모
        </span>

        <textarea
          value={form.memo}
          onChange={(e) =>
            set('memo', e.target.value)
          }
          rows={3}
          placeholder="상담 메모"
          style={{
            width: '100%',
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 14,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            color: COLORS.text,
            background: '#FAFAFA',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {error && (
        <div
          style={{
            color: '#DC2626',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
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
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading
          ? '저장 중...'
          : isEdit
          ? '수정 완료'
          : '고객 등록'}
      </button>
    </Modal>
  );
}
