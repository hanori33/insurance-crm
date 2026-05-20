import React, { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import customerService from '../services/customerService';
import consultationService from '../services/consultationService';
import { useEffect, useRef, useState } from 'react';

const CATEGORY_OPTIONS = ['상담', '계약', '보완', '청구', '관리', '리모델링', '해지방어', '기타'];

const emptyForm = {
  customer_id: '',
  customer_name: '',
  category: '상담',
  content: '',
  next_action: '',
};

export default function ConsultingPage({ initialCustomer, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [consultations, setConsultations] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('전체');

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
  if (!initialCustomer) return;

  setForm(prev => ({
    ...prev,
    customer_id:
      initialCustomer.db_id ||
      initialCustomer.id ||
      '',
    customer_name:
      initialCustomer.name || '',
  }));

  setCustomerSearch(initialCustomer.name || '');
}, [initialCustomer]);

  async function load() {
    setLoading(true);

    try {
      const [customerList, consultationList] = await Promise.all([
        customerService.list({ status: '전체', search: '' }),
        consultationService.list(),
      ]);

      setCustomers(customerList || []);
      setConsultations(consultationList || []);
    } catch (e) {
      console.error(e);
      alert('상담기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const searchedCustomers = useMemo(() => {
    const q = customerSearch.trim();

    if (!q) return customers.slice(0, 8);

    return customers
      .filter(c =>
        String(c.name || '').includes(q) ||
        String(c.phone || '').includes(q)
      )
      .slice(0, 12);
  }, [customers, customerSearch]);

  const filteredConsultations = useMemo(() => {
    const q = search.trim();

    return consultations.filter(item => {
      const categoryOk = categoryFilter === '전체' || item.category === categoryFilter;

      if (!categoryOk) return false;

      if (!q) return true;

      return (
        String(item.customer_name || '').includes(q) ||
        String(item.content || '').includes(q) ||
        String(item.next_action || '').includes(q) ||
        String(item.category || '').includes(q)
      );
    });
  }, [consultations, search, categoryFilter]);

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

const recognitionRef = useRef(null);

function startVoiceRecord() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert('음성입력을 지원하지 않는 브라우저입니다.');
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let finalText = '';

    for (let i = 0; i < event.results.length; i++) {
      finalText += event.results[i][0].transcript;
    }

    setForm(prev => ({
      ...prev,
      content: finalText,
    }));
  };

  recognition.onerror = (event) => {
    console.error(event);
  };

  recognition.start();

  recognitionRef.current = recognition;
}

function stopVoiceRecord() {
  if (recognitionRef.current) {
    recognitionRef.current.stop();
    recognitionRef.current = null;
  }
}

  function selectCustomer(c) {
    setForm(prev => ({
      ...prev,
      customer_id: c.db_id || c.id || '',
      customer_name: c.name || '',
    }));

    setCustomerSearch(c.name || '');
    setShowCustomerList(false);
  }

  function useManualCustomerName() {
    const name = customerSearch.trim();

    if (!name) {
      alert('신규 고객명을 입력해주세요.');
      return;
    }

    setForm(prev => ({
      ...prev,
      customer_id: '',
      customer_name: name,
    }));

    setShowCustomerList(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setCustomerSearch('');
    setEditingId(null);
    setShowCustomerList(false);
  }

  async function handleSave() {
    if (!form.customer_name.trim()) {
      alert('고객명을 선택하거나 직접 입력해주세요.');
      return;
    }

    if (!form.content.trim()) {
      alert('상담내용을 입력해주세요.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        customer_id: form.customer_id || null,
        customer_name: form.customer_name.trim(),
        category: form.category || '상담',
        content: form.content.trim(),
        next_action: form.next_action.trim(),
      };

      if (editingId) {
        await consultationService.update(editingId, payload);
      } else {
        await consultationService.create(payload);
      }

      resetForm();
      await load();
    } catch (e) {
      console.error(e);
      alert(
  (editingId ? '상담기록 수정 실패: ' : '상담기록 저장 실패: ') +
  (e.message || JSON.stringify(e))
);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);

    setForm({
      customer_id: item.customer_id || '',
      customer_name: item.customer_name || '',
      category: item.category || '상담',
      content: item.content || '',
      next_action: item.next_action || '',
    });

    setCustomerSearch(item.customer_name || '');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!window.confirm('상담기록을 삭제할까요?')) return;

    try {
      await consultationService.remove(id);
      await load();
    } catch (e) {
      console.error(e);
      alert('삭제에 실패했습니다.');
    }
  }

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: COLORS.bg,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          background: COLORS.white,
          padding: '14px 20px',
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 17, color: COLORS.text }}>
          상담 기록
        </div>
        <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>
          고객별 상담내용, 다음 액션, 처리 이력을 관리하세요
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '16px 16px calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        <Card>
          <div style={{ fontWeight: 900, fontSize: 15, color: COLORS.text, marginBottom: 12 }}>
            {editingId ? '상담기록 수정' : '새 상담기록'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <input
                value={customerSearch}
                onChange={e => {
                  const value = e.target.value;
                  setCustomerSearch(value);
                  setShowCustomerList(true);
                  setForm(prev => ({
                    ...prev,
                    customer_id: '',
                    customer_name: value,
                  }));
                }}
                onFocus={() => setShowCustomerList(true)}
                onBlur={() => {
  setTimeout(() => setShowCustomerList(false), 150);
}}
                placeholder="고객명 또는 전화번호 검색 / 신규 고객명 직접 입력"
                style={inputStyle}
              />

              {showCustomerList && customerSearch.trim() && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 50,
                    zIndex: 50,
                    background: '#fff',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                  }}
                >
                  {searchedCustomers.length > 0 && searchedCustomers.map(c => (
                    <button
                      key={c.db_id || c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      style={customerOptionStyle}
                    >
                      <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 13 }}>
                        {c.name}
                      </div>
                      <div style={{ color: COLORS.textGray, fontSize: 11, marginTop: 2 }}>
                        {c.phone || '전화번호 없음'} · {c.status || '상태 없음'}
                      </div>
                    </button>
                  ))}

                  {customerSearch.trim() && (
                    <button
                      type="button"
                      onClick={useManualCustomerName}
                      style={{
                        ...customerOptionStyle,
                        background: COLORS.primaryBg,
                      }}
                    >
                      <div style={{ fontWeight: 900, color: COLORS.primary, fontSize: 13 }}>
                        + “{customerSearch.trim()}” 신규/미등록 고객으로 상담기록 작성
                      </div>
                    </button>
                  )}

                  {!customerSearch.trim() && searchedCustomers.length === 0 && (
                    <div style={{ padding: 12, color: COLORS.textGray, fontSize: 12 }}>
                      고객을 검색하거나 신규 고객명을 입력하세요
                    </div>
                  )}
                </div>
              )}
            </div>

            <select
              value={form.category}
              onChange={e => setField('category', e.target.value)}
              style={inputStyle}
            >
              {CATEGORY_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

<div
  style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 6,
  }}
>
  <button
    type="button"
    onMouseDown={startVoiceRecord}
    onMouseUp={stopVoiceRecord}
    onMouseLeave={stopVoiceRecord}
    onTouchStart={startVoiceRecord}
    onTouchEnd={stopVoiceRecord}
    style={{
      border: 'none',
      background: COLORS.primary,
      color: '#fff',
      borderRadius: 999,
      padding: '10px 14px',
      fontSize: 12,
      fontWeight: 900,
      cursor: 'pointer',
    }}
  >
    🎤 음성 입력
  </button>

  <span
    style={{
      display: 'block',
      fontSize: 11,
      color: COLORS.textGray,
      textAlign: 'right',
    }}
  >
    길게 누르고 말하면 자동 입력돼요
  </span>
</div>

            <textarea
              value={form.content}
              onChange={e => setField('content', e.target.value)}
              placeholder="상담내용을 입력하세요&#10;예: 기존 보험료 부담으로 리모델링 상담, 암/뇌/심장 보장 비교 필요"
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />

            <input
              value={form.next_action}
              onChange={e => setField('next_action', e.target.value)}
              placeholder="다음 액션 예: 다음주 재통화, 설계안 발송, 보완서류 요청"
              style={inputStyle}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              {editingId && (
                <button
                  onClick={resetForm}
                  style={{
                    flex: 1,
                    border: `1px solid ${COLORS.border}`,
                    background: '#fff',
                    color: COLORS.textGray,
                    borderRadius: 12,
                    padding: '13px 0',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 2,
                  border: 'none',
                  background: COLORS.primary,
                  color: '#fff',
                  borderRadius: 12,
                  padding: '13px 0',
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? '저장 중...' : editingId ? '수정 저장' : '+ 상담기록 저장'}
              </button>
            </div>
          </div>
        </Card>

        <div style={{ height: 14 }} />

        <Card>
          <div style={{ fontWeight: 900, fontSize: 15, color: COLORS.text, marginBottom: 10 }}>
            상담기록 검색
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="고객명, 상담내용, 다음 액션 검색"
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {['전체', ...CATEGORY_OPTIONS].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(c)}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '7px 11px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: categoryFilter === c ? COLORS.primary : COLORS.primaryBg,
                  color: categoryFilter === c ? '#fff' : COLORS.primary,
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </Card>

        <div style={{ height: 14 }} />

        {loading ? (
          <LoadingSpinner />
        ) : filteredConsultations.length === 0 ? (
          <div style={{ textAlign: 'center', color: COLORS.textGray, marginTop: 40 }}>
            상담기록이 없습니다
          </div>
        ) : (
          filteredConsultations.map(item => (
            <Card
  key={item.id}
  style={{
    marginBottom: 10,
    transition: '0.15s',
    cursor: 'pointer',
  }}
>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 14 }}>
                    {item.customer_name || '고객 미지정'}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textGray, marginTop: 3 }}>
                    {item.category || '상담'} · {new Date(item.consulted_at || item.created_at).toLocaleString('ko-KR')}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  
                  <button
  onClick={() => {
    const today = new Date().toISOString().slice(0, 10);

    onNavigate?.('schedule', {
      initialSchedule: {
        dateStr: today,
        title: item.next_action || '상담 후속 일정',
        customer_name: item.customer_name || '',
        memo: item.content || '',
        next_action: item.next_action || '',
        schedule_icon: '📞',
      },
    });
  }}
  style={{
    ...smallButtonStyle,
    background: COLORS.primary,
    color: '#fff',
  }}
>
  📅 일정등록
</button>
                  
                  <button
                    onClick={() => handleEdit(item)}
                    style={smallButtonStyle}
                  >
                    수정
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      ...smallButtonStyle,
                      background: '#FEE2E2',
                      color: '#DC2626',
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                  color: COLORS.text,
                  lineHeight: 1.55,
                  marginTop: 10,
                }}
              >
                {item.content}
              </div>

              {item.next_action && (
                <div
                  style={{
                    marginTop: 10,
                    background: COLORS.primaryBg,
                    color: COLORS.primary,
                    borderRadius: 10,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  다음 액션: {item.next_action}
                </div>
              )}
              
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  border: `1.5px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: '12px 13px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
  color: COLORS.text,
  fontFamily: 'inherit',
};

const customerOptionStyle = {
  width: '100%',
  border: 'none',
  borderBottom: `1px solid ${COLORS.border}`,
  background: '#fff',
  padding: '11px 12px',
  textAlign: 'left',
  cursor: 'pointer',
};

const smallButtonStyle = {
  border: 'none',
  background: COLORS.primaryBg,
  color: COLORS.primary,
  borderRadius: 999,
  padding: '5px 9px',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
  height: 28,
};