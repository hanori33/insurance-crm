import React, { useEffect, useMemo, useRef, useState } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import customerService from '../services/customerService';
import consultationService from '../services/consultationService';
import Modal from '../components/Modal';
import { supabase } from '../supabaseClient';

const CATEGORY_OPTIONS = ['상담', '계약', '보완', '청구', '관리', '리모델링', '해지방어', '기타'];

const createEmptyForm = () => ({
  customer_id: '',
  customer_name: '',
  category: '상담',
  content: '',
  next_action: '',
  disclosure_info: {
    checked: false,
    recent3m: {
      treatment: false,
      test: false,
      medication: false,
    },
    recent1y: {
      additional_test: false,
      recheck: false,
    },
    recent5y: {
      hospitalization: false,
      surgery: false,
      long_treatment: false,
      long_medication: false,
    },
    risk_job: false,
    risk_hobby: false,
    driving: false,
    pregnancy: false,
    memo: '',
  },
  medical_history: [],
  exclusions: [],
});

const emptyMedical = {
  disease: '',
  diagnosed_at: '',
  treatment_period: '',
  current_treatment: '',
  medication: '',
  hospitalization: '',
  surgery: '',
  memo: '',
};

const emptyExclusion = {
  insurance_company: '',
  product_name: '',
  body_part: '',
  disease: '',
  start_date: '',
  end_date: '',
  period: '',
  result: '부담보승인',
  memo: '',
};

export default function ConsultingPage({ initialCustomer, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [consultations, setConsultations] = useState([]);

  const [form, setForm] = useState(createEmptyForm());
  const [editingId, setEditingId] = useState(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('전체');

  const [showDisclosureModal, setShowDisclosureModal] = useState(false);
  const [showMedicalModal, setShowMedicalModal] = useState(false);
  const [showExclusionModal, setShowExclusionModal] = useState(false);

  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const recognitionRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!initialCustomer) return;

    setForm(prev => ({
      ...prev,
      customer_id: initialCustomer.db_id || initialCustomer.id || '',
      customer_name: initialCustomer.name || '',
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

    recognition.onresult = event => {
      let finalText = '';

      for (let i = 0; i < event.results.length; i++) {
        finalText += event.results[i][0].transcript;
      }

      setForm(prev => ({
        ...prev,
        content: finalText,
      }));
    };

    recognition.onerror = event => {
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
    setForm(createEmptyForm());
    setCustomerSearch('');
    setEditingId(null);
    setShowCustomerList(false);
  }

  function updateDisclosure(path, value) {
    setForm(prev => {
      const current = prev.disclosure_info || createEmptyForm().disclosure_info;

      if (path.length === 1) {
        return {
          ...prev,
          disclosure_info: {
            ...current,
            [path[0]]: value,
          },
        };
      }

      return {
        ...prev,
        disclosure_info: {
          ...current,
          [path[0]]: {
            ...(current[path[0]] || {}),
            [path[1]]: value,
          },
        },
      };
    });
  }

  function addMedicalHistory() {
    setForm(prev => ({
      ...prev,
      medical_history: [...(prev.medical_history || []), { ...emptyMedical }],
    }));
  }

  function updateMedicalHistory(index, key, value) {
    setForm(prev => ({
      ...prev,
      medical_history: (prev.medical_history || []).map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  function removeMedicalHistory(index) {
    setForm(prev => ({
      ...prev,
      medical_history: (prev.medical_history || []).filter((_, i) => i !== index),
    }));
  }

  function addExclusion() {
    setForm(prev => ({
      ...prev,
      exclusions: [...(prev.exclusions || []), { ...emptyExclusion }],
    }));
  }

  function updateExclusion(index, key, value) {
    setForm(prev => ({
      ...prev,
      exclusions: (prev.exclusions || []).map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  function removeExclusion(index) {
    setForm(prev => ({
      ...prev,
      exclusions: (prev.exclusions || []).filter((_, i) => i !== index),
    }));
  }

  function getDisclosureSummary(item) {
    const info = item?.disclosure_info || {};
    return info.checked ? '확인완료' : '';
  }

  function getMedicalSummary(item) {
    const list = item?.medical_history || [];
    return list
      .map(m => m.disease)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
  }

  function getExclusionSummary(item) {
    const list = item?.exclusions || [];
    return list
      .map(e => e.body_part || e.disease)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
  }

  function hasAiAnalysisInput() {
    const disclosureMemo = form.disclosure_info?.memo || '';
    const medicalList = form.medical_history || [];
    const exclusionList = form.exclusions || [];

    const hasDisclosure =
      !!form.disclosure_info?.checked ||
      !!disclosureMemo.trim() ||
      !!form.disclosure_info?.recent3m?.treatment ||
      !!form.disclosure_info?.recent3m?.test ||
      !!form.disclosure_info?.recent3m?.medication ||
      !!form.disclosure_info?.recent1y?.additional_test ||
      !!form.disclosure_info?.recent1y?.recheck ||
      !!form.disclosure_info?.recent5y?.hospitalization ||
      !!form.disclosure_info?.recent5y?.surgery ||
      !!form.disclosure_info?.recent5y?.long_treatment ||
      !!form.disclosure_info?.recent5y?.long_medication ||
      !!form.disclosure_info?.risk_job ||
      !!form.disclosure_info?.risk_hobby ||
      !!form.disclosure_info?.driving ||
      !!form.disclosure_info?.pregnancy;

    const hasMedical = medicalList.some(item =>
      Object.values(item || {}).some(value => String(value || '').trim())
    );

    const hasExclusion = exclusionList.some(item =>
      Object.values(item || {}).some(value => String(value || '').trim())
    );

    return hasDisclosure || hasMedical || hasExclusion;
  }

  function normalizeAiResult(data) {
    const result = data?.result || data || {};

    return {
      medicalSummary: result.medicalSummary || result.medical_summary || result['병력 요약'] || '',
      additionalQuestions: result.additionalQuestions || result.additional_questions || result['추가 확인 질문'] || '',
      disclosureCheckPoints: result.disclosureCheckPoints || result.disclosure_check_points || result['알릴의무 체크 포인트'] || '',
      underwritingNotes: result.underwritingNotes || result.underwriting_notes || result['심사 참고사항'] || '',
      customerScript: result.customerScript || result.customer_script || result['고객 상담 멘트'] || '',
    };
  }

  async function handleAiAnalyze() {
    if (!hasAiAnalysisInput()) {
      alert('AI 분석할 알릴의무, 병력고지 또는 부담보 내용을 먼저 입력해주세요.');
      return;
    }

    setAiAnalyzing(true);

    try {
      const payload = {
        customer_name: form.customer_name || '',
        category: form.category || '상담',
        consultation_content: form.content || '',
        next_action: form.next_action || '',
        disclosure_info: form.disclosure_info || {},
        medical_history: form.medical_history || [],
        exclusions: form.exclusions || [],
      };

      const { data, error } = await supabase.functions.invoke('boplan-ai-analysis', {
        body: payload,
      });

      if (error) throw error;

      setAiResult(normalizeAiResult(data));
      setShowAiModal(true);
    } catch (e) {
      console.error(e);
      alert(
        'AI 분석에 실패했습니다. Supabase Edge Function(boplan-ai-analysis) 설정을 확인해주세요.\n' +
        (e.message || JSON.stringify(e))
      );
    } finally {
      setAiAnalyzing(false);
    }
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
    disclosure_info: form.disclosure_info || {},
    medical_history: form.medical_history || [],
    exclusions: form.exclusions || [],
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
      disclosure_info: item.disclosure_info || createEmptyForm().disclosure_info,
      medical_history: item.medical_history || [],
      exclusions: item.exclusions || [],
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
    <>
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

            <div style={noticeStyle}>
              ※ 주민등록번호 / 계좌번호 / 카드번호 등 민감정보는 입력하지 마세요.
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

              <div style={voiceWrapStyle}>
                <button
                  type="button"
                  onMouseDown={startVoiceRecord}
                  onMouseUp={stopVoiceRecord}
                  onMouseLeave={stopVoiceRecord}
                  onTouchStart={startVoiceRecord}
                  onTouchEnd={stopVoiceRecord}
                  style={voiceButtonStyle}
                >
                  🎤 음성 입력
                </button>

                <span style={voiceHelpStyle}>
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

              <div style={modalButtonWrapStyle}>
                <button
                  type="button"
                  onClick={() => setShowDisclosureModal(true)}
                  style={{ ...modalOpenButtonStyle, background: '#E8D9FF', color: '#6D28D9' }}
                >
                  📋 알릴의무
                </button>

                <button
                  type="button"
                  onClick={() => setShowMedicalModal(true)}
                  style={{ ...modalOpenButtonStyle, background: '#DFF4FF', color: '#0369A1' }}
                >
                  🏥 병력고지
                </button>

                <button
                  type="button"
                  onClick={() => setShowExclusionModal(true)}
                  style={{ ...modalOpenButtonStyle, background: '#FFE6E6', color: '#B91C1C' }}
                >
                  🚫 부담보
                </button>
              </div>

              <SummaryPreview
                disclosure={getDisclosureSummary(form)}
                medical={getMedicalSummary(form)}
                exclusion={getExclusionSummary(form)}
              />

              <input
                value={form.next_action}
                onChange={e => setField('next_action', e.target.value)}
                placeholder="다음 액션 예: 다음주 재통화, 설계안 발송, 보완서류 요청"
                style={inputStyle}
              />

              <div style={saveButtonWrapStyle}>
                {editingId && (
                  <button onClick={resetForm} style={cancelButtonStyle}>
                    취소
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAiAnalyze}
                  disabled={aiAnalyzing}
                  style={{
                    ...aiAnalyzeButtonStyle,
                    opacity: aiAnalyzing ? 0.6 : 1,
                    cursor: aiAnalyzing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {aiAnalyzing ? '분석 중...' : '🧠 AI 분석'}
                </button>

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

                    <button onClick={() => handleEdit(item)} style={smallButtonStyle}>
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

                <SummaryPreview
                  disclosure={getDisclosureSummary(item)}
                  medical={getMedicalSummary(item)}
                  exclusion={getExclusionSummary(item)}
                />

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

      <Modal
        visible={showDisclosureModal}
        onClose={() => setShowDisclosureModal(false)}
        title="📋 알릴의무"
      >
        <div style={modalBodyStyle}>
          <div style={noticeStyle}>
            ※ 고지사항은 고객 진술 기준으로 기록하고, 민감정보는 최소한으로만 입력하세요.
          </div>

          <label style={checkLineStyle}>
            <input
              type="checkbox"
              checked={!!form.disclosure_info?.checked}
              onChange={e => updateDisclosure(['checked'], e.target.checked)}
            />
            알릴의무 확인완료
          </label>

          <SectionTitle title="최근 3개월" />
          <CheckItem
            label="진찰"
            checked={!!form.disclosure_info?.recent3m?.treatment}
            onChange={v => updateDisclosure(['recent3m', 'treatment'], v)}
          />
          <CheckItem
            label="검사"
            checked={!!form.disclosure_info?.recent3m?.test}
            onChange={v => updateDisclosure(['recent3m', 'test'], v)}
          />
          <CheckItem
            label="투약"
            checked={!!form.disclosure_info?.recent3m?.medication}
            onChange={v => updateDisclosure(['recent3m', 'medication'], v)}
          />

          <SectionTitle title="최근 1년" />
          <CheckItem
            label="추가검사"
            checked={!!form.disclosure_info?.recent1y?.additional_test}
            onChange={v => updateDisclosure(['recent1y', 'additional_test'], v)}
          />
          <CheckItem
            label="재검사"
            checked={!!form.disclosure_info?.recent1y?.recheck}
            onChange={v => updateDisclosure(['recent1y', 'recheck'], v)}
          />

          <SectionTitle title="최근 5년" />
          <CheckItem
            label="입원"
            checked={!!form.disclosure_info?.recent5y?.hospitalization}
            onChange={v => updateDisclosure(['recent5y', 'hospitalization'], v)}
          />
          <CheckItem
            label="수술"
            checked={!!form.disclosure_info?.recent5y?.surgery}
            onChange={v => updateDisclosure(['recent5y', 'surgery'], v)}
          />
          <CheckItem
            label="7일 이상 치료"
            checked={!!form.disclosure_info?.recent5y?.long_treatment}
            onChange={v => updateDisclosure(['recent5y', 'long_treatment'], v)}
          />
          <CheckItem
            label="30일 이상 투약"
            checked={!!form.disclosure_info?.recent5y?.long_medication}
            onChange={v => updateDisclosure(['recent5y', 'long_medication'], v)}
          />

          <SectionTitle title="기타" />
          <CheckItem
            label="위험직업"
            checked={!!form.disclosure_info?.risk_job}
            onChange={v => updateDisclosure(['risk_job'], v)}
          />
          <CheckItem
            label="위험취미"
            checked={!!form.disclosure_info?.risk_hobby}
            onChange={v => updateDisclosure(['risk_hobby'], v)}
          />
          <CheckItem
            label="운전 여부"
            checked={!!form.disclosure_info?.driving}
            onChange={v => updateDisclosure(['driving'], v)}
          />
          <CheckItem
            label="임신/여성질환 관련 확인"
            checked={!!form.disclosure_info?.pregnancy}
            onChange={v => updateDisclosure(['pregnancy'], v)}
          />

          <textarea
            value={form.disclosure_info?.memo || ''}
            onChange={e => updateDisclosure(['memo'], e.target.value)}
            placeholder="알릴의무 관련 메모"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />

          <button
            type="button"
            onClick={() => setShowDisclosureModal(false)}
            style={primaryFullButtonStyle}
          >
            입력 완료
          </button>
        </div>
      </Modal>

      <Modal
        visible={showMedicalModal}
        onClose={() => setShowMedicalModal(false)}
        title="🏥 병력고지"
      >
        <div style={modalBodyStyle}>
          <div style={noticeStyle}>
            ※ 병력은 고객이 말한 내용 기준으로 기록하고, 주민번호/계좌번호 등은 입력 금지.
          </div>

          {(form.medical_history || []).length === 0 && (
            <div style={emptyBoxStyle}>등록된 병력이 없습니다.</div>
          )}

          {(form.medical_history || []).map((item, index) => (
            <div key={index} style={miniCardStyle}>
              <div style={miniCardHeaderStyle}>
                <b>병력 {index + 1}</b>
                <button
                  type="button"
                  onClick={() => removeMedicalHistory(index)}
                  style={dangerMiniButtonStyle}
                >
                  삭제
                </button>
              </div>

              <input
                value={item.disease || ''}
                onChange={e => updateMedicalHistory(index, 'disease', e.target.value)}
                placeholder="질병명 예: 고혈압, 갑상선결절"
                style={inputStyle}
              />
              <input
                value={item.diagnosed_at || ''}
                onChange={e => updateMedicalHistory(index, 'diagnosed_at', e.target.value)}
                placeholder="진단일 예: 2024-03"
                style={inputStyle}
              />
              <input
                value={item.treatment_period || ''}
                onChange={e => updateMedicalHistory(index, 'treatment_period', e.target.value)}
                placeholder="치료기간"
                style={inputStyle}
              />
              <input
                value={item.current_treatment || ''}
                onChange={e => updateMedicalHistory(index, 'current_treatment', e.target.value)}
                placeholder="현재 치료 여부"
                style={inputStyle}
              />
              <input
                value={item.medication || ''}
                onChange={e => updateMedicalHistory(index, 'medication', e.target.value)}
                placeholder="복용약"
                style={inputStyle}
              />
              <input
                value={item.hospitalization || ''}
                onChange={e => updateMedicalHistory(index, 'hospitalization', e.target.value)}
                placeholder="입원 여부"
                style={inputStyle}
              />
              <input
                value={item.surgery || ''}
                onChange={e => updateMedicalHistory(index, 'surgery', e.target.value)}
                placeholder="수술 여부"
                style={inputStyle}
              />
              <textarea
                value={item.memo || ''}
                onChange={e => updateMedicalHistory(index, 'memo', e.target.value)}
                placeholder="고지 필요 메모"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
          ))}

          <button type="button" onClick={addMedicalHistory} style={secondaryFullButtonStyle}>
            + 병력 추가
          </button>

<div
  style={{
    fontSize: 12,
    color: COLORS.textGray,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  }}
>
  ※ 입력 후 아래 "상담기록 저장" 버튼을 눌러야 최종 저장됩니다.
</div>

          <button
            type="button"
            onClick={() => setShowMedicalModal(false)}
            style={primaryFullButtonStyle}
          >
            입력 완료
          </button>
        </div>
      </Modal>

      <Modal
        visible={showExclusionModal}
        onClose={() => setShowExclusionModal(false)}
        title="🚫 부담보"
      >
        <div style={modalBodyStyle}>
          <div style={noticeStyle}>
            ※ 부담보/할증/인수거절 등 심사결과를 기록해두면 다음 상담 때 바로 확인 가능해요.
          </div>

          {(form.exclusions || []).length === 0 && (
            <div style={emptyBoxStyle}>등록된 부담보가 없습니다.</div>
          )}

          {(form.exclusions || []).map((item, index) => (
            <div key={index} style={miniCardStyle}>
              <div style={miniCardHeaderStyle}>
                <b>부담보 {index + 1}</b>
                <button
                  type="button"
                  onClick={() => removeExclusion(index)}
                  style={dangerMiniButtonStyle}
                >
                  삭제
                </button>
              </div>

              <input
                value={item.insurance_company || ''}
                onChange={e => updateExclusion(index, 'insurance_company', e.target.value)}
                placeholder="보험사"
                style={inputStyle}
              />
              <input
                value={item.product_name || ''}
                onChange={e => updateExclusion(index, 'product_name', e.target.value)}
                placeholder="상품명"
                style={inputStyle}
              />
              <input
                value={item.body_part || ''}
                onChange={e => updateExclusion(index, 'body_part', e.target.value)}
                placeholder="부담보 부위 예: 우측 무릎"
                style={inputStyle}
              />
              <input
                value={item.disease || ''}
                onChange={e => updateExclusion(index, 'disease', e.target.value)}
                placeholder="부담보 질환"
                style={inputStyle}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  value={item.start_date || ''}
                  onChange={e => updateExclusion(index, 'start_date', e.target.value)}
                  placeholder="시작일"
                  style={inputStyle}
                />
                <input
                  value={item.end_date || ''}
                  onChange={e => updateExclusion(index, 'end_date', e.target.value)}
                  placeholder="종료일"
                  style={inputStyle}
                />
              </div>

              <input
                value={item.period || ''}
                onChange={e => updateExclusion(index, 'period', e.target.value)}
                placeholder="기간 예: 5년"
                style={inputStyle}
              />

              <select
                value={item.result || '부담보승인'}
                onChange={e => updateExclusion(index, 'result', e.target.value)}
                style={inputStyle}
              >
                <option value="표준승인">표준승인</option>
                <option value="할증승인">할증승인</option>
                <option value="부담보승인">부담보승인</option>
                <option value="인수거절">인수거절</option>
              </select>

              <textarea
                value={item.memo || ''}
                onChange={e => updateExclusion(index, 'memo', e.target.value)}
                placeholder="부담보 메모"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
          ))}
<button
  type="button"
  onClick={addExclusion}
  style={secondaryFullButtonStyle}
>
  + 부담보 추가
</button>
          <div
  style={{
    fontSize: 12,
    color: COLORS.textGray,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  }}
>
  ※ 입력 후 아래 "상담기록 저장" 버튼을 눌러야 최종 저장됩니다.
</div>

<button
  type="button"
  onClick={() => setShowExclusionModal(false)}
  style={primaryFullButtonStyle}
>
  입력 완료
</button>
        </div>
      </Modal>

      <Modal
        visible={showAiModal}
        onClose={() => setShowAiModal(false)}
        title="🧠 AI 상담 분석"
      >
        <div style={modalBodyStyle}>
          <div style={aiNoticeStyle}>
            ※ AI 분석은 상담 보조용입니다. 실제 고지의무 판단, 인수심사 결과, 보험금 지급 여부는 각 보험사 기준과 약관에 따라 달라질 수 있어요.
          </div>

          <AiResultSection
            number="1"
            title="병력 요약"
            content={aiResult?.medicalSummary}
          />
          <AiResultSection
            number="2"
            title="추가 확인 질문"
            content={aiResult?.additionalQuestions}
          />
          <AiResultSection
            number="3"
            title="알릴의무 체크 포인트"
            content={aiResult?.disclosureCheckPoints}
          />
          <AiResultSection
            number="4"
            title="심사 참고사항"
            content={aiResult?.underwritingNotes}
          />
          <AiResultSection
            number="5"
            title="고객 상담 멘트"
            content={aiResult?.customerScript}
          />

          <button
            type="button"
            onClick={() => setShowAiModal(false)}
            style={primaryFullButtonStyle}
          >
            닫기
          </button>
        </div>
      </Modal>
    </>
  );
}

function SummaryPreview({ disclosure, medical, exclusion }) {
  if (!disclosure && !medical && !exclusion) return null;

  return (
    <div style={summaryBoxStyle}>
      {disclosure && <span style={summaryChipStyle}>📋 알릴의무: {disclosure}</span>}
      {medical && <span style={summaryChipStyle}>🏥 병력: {medical}</span>}
      {exclusion && <span style={summaryChipStyle}>🚫 부담보: {exclusion}</span>}
    </div>
  );
}

function SectionTitle({ title }) {
  return (
    <div style={{ fontWeight: 900, fontSize: 13, color: COLORS.text, marginTop: 8 }}>
      {title}
    </div>
  );
}

function CheckItem({ label, checked, onChange }) {
  return (
    <label style={checkLineStyle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function AiResultSection({ number, title, content }) {
  return (
    <div style={aiSectionStyle}>
      <div style={aiSectionTitleStyle}>
        {number}. {title}
      </div>
      <div style={aiSectionContentStyle}>
        {content ? String(content) : '분석 결과가 없습니다.'}
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

const noticeStyle = {
  background: '#FFF7ED',
  color: '#9A3412',
  border: '1px solid #FED7AA',
  borderRadius: 12,
  padding: '9px 11px',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.45,
  marginBottom: 10,
};

const voiceWrapStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 0,
  flexWrap: 'wrap',
};

const voiceButtonStyle = {
  border: 'none',
  background: COLORS.primary,
  color: '#fff',
  borderRadius: 999,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  WebkitUserSelect: 'none',
  touchAction: 'manipulation',
};

const voiceHelpStyle = {
  display: 'block',
  fontSize: 11,
  color: COLORS.textGray,
  whiteSpace: 'nowrap',
  flex: 1,
};

const modalButtonWrapStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 0,
};

const modalOpenButtonStyle = {
  padding: '8px 12px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 12,
};

const saveButtonWrapStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'stretch',
  flexWrap: 'wrap',
};

const aiAnalyzeButtonStyle = {
  flex: 1,
  minWidth: 120,
  border: 'none',
  background: '#111827',
  color: '#fff',
  borderRadius: 12,
  padding: '13px 0',
  fontWeight: 900,
  fontSize: 14,
};

const cancelButtonStyle = {
  flex: 1,
  border: `1px solid ${COLORS.border}`,
  background: '#fff',
  color: COLORS.textGray,
  borderRadius: 12,
  padding: '13px 0',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
};

const modalBodyStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const checkLineStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: COLORS.text,
};

const miniCardStyle = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  background: '#FAFAFF',
};

const miniCardHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: COLORS.text,
  fontSize: 13,
};

const dangerMiniButtonStyle = {
  border: 'none',
  borderRadius: 999,
  background: '#FEE2E2',
  color: '#DC2626',
  fontSize: 11,
  fontWeight: 800,
  padding: '5px 9px',
  cursor: 'pointer',
};

const primaryFullButtonStyle = {
  width: '100%',
  border: 'none',
  background: COLORS.primary,
  color: '#fff',
  borderRadius: 12,
  padding: '12px 0',
  fontWeight: 900,
  fontSize: 14,
  cursor: 'pointer',
  marginTop: 4,
};

const secondaryFullButtonStyle = {
  width: '100%',
  border: 'none',
  background: COLORS.primaryBg,
  color: COLORS.primary,
  borderRadius: 12,
  padding: '12px 0',
  fontWeight: 900,
  fontSize: 14,
  cursor: 'pointer',
};

const emptyBoxStyle = {
  background: '#F8FAFC',
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.textGray,
  borderRadius: 14,
  padding: 14,
  fontSize: 13,
  textAlign: 'center',
};

const summaryBoxStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 10,
};

const summaryChipStyle = {
  background: COLORS.primaryBg,
  color: COLORS.primary,
  borderRadius: 999,
  padding: '6px 9px',
  fontSize: 11,
  fontWeight: 800,
};

const aiNoticeStyle = {
  background: '#EEF2FF',
  color: '#3730A3',
  border: '1px solid #C7D2FE',
  borderRadius: 12,
  padding: '10px 11px',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.5,
};

const aiSectionStyle = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 14,
  padding: 12,
  background: '#fff',
};

const aiSectionTitleStyle = {
  fontSize: 13,
  fontWeight: 900,
  color: COLORS.text,
  marginBottom: 7,
};

const aiSectionContentStyle = {
  whiteSpace: 'pre-wrap',
  fontSize: 13,
  color: COLORS.text,
  lineHeight: 1.6,
};
