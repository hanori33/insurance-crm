import React, { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import diseaseDictionaryService from '../services/diseaseDictionaryService';
import getFunctionErrorMessage from '../services/functionErrorService';

const emptyForm = {
  disease_name: '',
  disease_code: '',
  category: '일반',
  keywordsText: '',
  summary: '',
  checkQuestionsText: '',
  disclosurePointsText: '',
  underwritingNotesText: '',
  customer_script: '',
  companyNotesText: '',
};

function textToList(text) {
  return String(text || '')
    .split('\n')
    .map(v => v.trim())
    .filter(Boolean);
}

function listToText(list) {
  return Array.isArray(list) ? list.join('\n') : '';
}

export default function DiseaseDictionaryPage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await diseaseDictionaryService.list({ search: '' });
      setItems(data || []);
    } catch (e) {
      console.error(e);
      alert('병력사전을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter(item => {
      return (
        String(item.disease_name || '').toLowerCase().includes(q) ||
        String(item.disease_code || '').toLowerCase().includes(q) ||
        String(item.category || '').toLowerCase().includes(q) ||
        String(item.summary || '').toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

async function generateAiDraft() {
  if (!form.disease_name.trim()) {
    alert('병명을 먼저 입력해주세요.');
    return;
  }

  setAiLoading(true);

  try {
    const { supabase } = await import('../supabaseClient');

    const { data, error } = await supabase.functions.invoke(
      'boplan-disease-draft',
      {
        body: {
          diseaseName: form.disease_name,
        },
      }
    );

    if (error) throw error;

   setForm(prev => ({
  ...prev,
  disease_code: data.diseaseCode || data.disease_code || prev.disease_code || '',
  category: data.category || prev.category || '일반',
  keywordsText: (data.keywords || []).join('\n'),
  summary: data.summary || '',
  checkQuestionsText: (data.checkQuestions || []).join('\n'),
  disclosurePointsText: (data.disclosurePoints || []).join('\n'),
  underwritingNotesText: (data.underwritingNotes || []).join('\n'),
  customer_script: data.customerScript || '',
}));

    alert('AI 초안 생성 완료');
  } catch (e) {
    console.error(e);
    alert(await getFunctionErrorMessage(e));
  } finally {
    setAiLoading(false);
  }
}

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.disease_name.trim()) {
      alert('병명을 입력해주세요.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        disease_name: form.disease_name.trim(),
        disease_code: form.disease_code.trim(),
        category: form.category.trim() || '일반',
        keywords: textToList(form.keywordsText),
        summary: form.summary.trim(),
        check_questions: textToList(form.checkQuestionsText),
        disclosure_points: textToList(form.disclosurePointsText),
        underwriting_notes: textToList(form.underwritingNotesText),
        customer_script: form.customer_script.trim(),
        company_notes: {
          memo: form.companyNotesText.trim(),
        },
      };

      if (editingId) {
        await diseaseDictionaryService.update(editingId, payload);
      } else {
        await diseaseDictionaryService.create(payload);
      }

      resetForm();
      await load();
    } catch (e) {
      console.error(e);
      alert('저장 실패: ' + (e.message || JSON.stringify(e)));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      disease_name: item.disease_name || '',
      disease_code: item.disease_code || '',
      category: item.category || '일반',
      keywordsText: listToText(item.keywords),
      summary: item.summary || '',
      checkQuestionsText: listToText(item.check_questions),
      disclosurePointsText: listToText(item.disclosure_points),
      underwritingNotesText: listToText(item.underwriting_notes),
      customer_script: item.customer_script || '',
      companyNotesText: item.company_notes?.memo || '',
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!window.confirm('이 병력사전 항목을 삭제할까요?')) return;

    try {
      await diseaseDictionaryService.remove(id);
      await load();
    } catch (e) {
      console.error(e);
      alert('삭제 실패: ' + (e.message || JSON.stringify(e)));
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
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {onBack && (
          <button type="button" onClick={onBack} style={backButtonStyle}>
            ←
          </button>
        )}

        <div>
          <div style={{ fontWeight: 900, fontSize: 17, color: COLORS.text }}>
            📚 병력사전
          </div>
          <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>
            병력별 추가 질문, 알릴의무 체크, 심사 참고사항을 관리하세요
          </div>
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
          <div style={sectionTitleStyle}>
            {editingId ? '병력사전 수정' : '새 병력 등록'}
          </div>

          <div style={noticeStyle}>
            ※ 병력사전은 상담 보조용입니다. 실제 인수심사 결과는 보험사별 기준과 약관에 따라 달라질 수 있어요.
          </div>

          <div style={formGridStyle}>
            <input
              value={form.disease_name}
              onChange={e => setField('disease_name', e.target.value)}
              placeholder="병명 예: 고혈압, 당뇨, 디스크"
              style={inputStyle}
            />

            <input
              value={form.disease_code}
              onChange={e => setField('disease_code', e.target.value)}
              placeholder="질병코드 예: I10, E11, M51"
              style={inputStyle}
            />

            <input
              value={form.category}
              onChange={e => setField('category', e.target.value)}
              placeholder="분류 예: 순환기, 내분비, 근골격"
              style={inputStyle}
            />

            <textarea
              value={form.keywordsText}
              onChange={e => setField('keywordsText', e.target.value)}
              placeholder={'검색 키워드 / 유사어\n예:\n혈압\n고혈압약\n혈압약'}
              rows={3}
              style={textareaStyle}
            />

            <textarea
              value={form.summary}
              onChange={e => setField('summary', e.target.value)}
              placeholder="병력 요약 예: 고혈압은 진단시기, 약 복용 여부, 최근 혈압수치, 합병증 여부 확인 필요"
              rows={3}
              style={textareaStyle}
            />

            <textarea
              value={form.checkQuestionsText}
              onChange={e => setField('checkQuestionsText', e.target.value)}
              placeholder={'추가 확인 질문 / 줄바꿈으로 입력\n예:\n진단받은 시점은 언제인가요?\n현재 약을 복용 중인가요?\n최근 혈압 수치는 어느 정도인가요?'}
              rows={5}
              style={textareaStyle}
            />

            <textarea
              value={form.disclosurePointsText}
              onChange={e => setField('disclosurePointsText', e.target.value)}
              placeholder={'알릴의무 체크 포인트 / 줄바꿈으로 입력\n예:\n최근 3개월 내 진찰·검사·투약 여부\n최근 5년 내 입원·수술·7일 이상 치료·30일 이상 투약 여부'}
              rows={5}
              style={textareaStyle}
            />

            <textarea
              value={form.underwritingNotesText}
              onChange={e => setField('underwritingNotesText', e.target.value)}
              placeholder={'심사 참고사항 / 줄바꿈으로 입력\n예:\n약 복용 중이면 최근 검사결과 확인 필요\n합병증 여부에 따라 심사 방향 달라질 수 있음'}
              rows={5}
              style={textareaStyle}
            />

            <textarea
              value={form.customer_script}
              onChange={e => setField('customer_script', e.target.value)}
              placeholder="고객 상담 멘트 예: 정확한 고지를 위해 진단시기와 약 복용 여부를 먼저 확인해볼게요."
              rows={4}
              style={textareaStyle}
            />

            <textarea
              value={form.companyNotesText}
              onChange={e => setField('companyNotesText', e.target.value)}
              placeholder="보험사 참고 메모 예: A사 유리, B사 추가서류 가능성 등"
              rows={4}
              style={textareaStyle}
            />
          </div>

          <div style={buttonRowStyle}>
            {editingId && (
              <button type="button" onClick={resetForm} style={cancelButtonStyle}>
                취소
              </button>
            )}

<button
  type="button"
  onClick={generateAiDraft}
  disabled={aiLoading}
  style={{
    flex: 1,
    border: 'none',
    background: '#7C3AED',
    color: '#fff',
    borderRadius: 12,
    padding: '13px 0',
    fontWeight: 900,
    fontSize: 14,
    cursor: 'pointer',
  }}
>
  {aiLoading ? 'AI 생성중...' : '✨ AI 초안 생성'}
</button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                ...primaryButtonStyle,
                opacity: saving ? 0.6 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '저장 중...' : editingId ? '수정 저장' : '+ 병력 등록'}
            </button>
          </div>
        </Card>

        <div style={{ height: 14 }} />

        <Card>
          <div style={sectionTitleStyle}>병력사전 검색</div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="병명, 코드, 분류, 요약 검색"
            style={inputStyle}
          />
        </Card>

        <div style={{ height: 14 }} />

        {loading ? (
          <LoadingSpinner />
        ) : filteredItems.length === 0 ? (
          <div style={emptyTextStyle}>등록된 병력사전이 없습니다.</div>
        ) : (
          filteredItems.map(item => (
            <Card key={item.id} style={{ marginBottom: 10 }}>
              <div style={itemHeaderStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={itemTitleStyle}>
                    {item.disease_name}
                    {item.disease_code && (
                      <span style={codeBadgeStyle}>{item.disease_code}</span>
                    )}
                  </div>
                  <div style={itemMetaStyle}>
                    {item.category || '일반'} · {item.is_public ? '공용' : '내 사전'}
                  </div>
                </div>

                {!item.is_public && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      style={smallButtonStyle}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      style={dangerButtonStyle}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>

              {item.summary && (
                <div style={summaryStyle}>{item.summary}</div>
              )}

              <MiniList title="추가 질문" list={item.check_questions} />
              <MiniList title="알릴의무" list={item.disclosure_points} />
              <MiniList title="심사 참고" list={item.underwriting_notes} />

              {item.customer_script && (
                <div style={scriptBoxStyle}>
                  <b>고객 멘트</b>
                  <div style={{ marginTop: 5 }}>{item.customer_script}</div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function MiniList({ title, list }) {
  if (!Array.isArray(list) || list.length === 0) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={miniListTitleStyle}>{title}</div>
      <ul style={miniListStyle}>
        {list.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

const backButtonStyle = {
  border: 'none',
  background: COLORS.primaryBg,
  color: COLORS.primary,
  borderRadius: 10,
  width: 34,
  height: 34,
  fontWeight: 900,
  cursor: 'pointer',
  flexShrink: 0,
};

const sectionTitleStyle = {
  fontWeight: 900,
  fontSize: 15,
  color: COLORS.text,
  marginBottom: 12,
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

const formGridStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

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

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
  lineHeight: 1.5,
};

const buttonRowStyle = {
  display: 'flex',
  gap: 8,
  marginTop: 12,
};

const primaryButtonStyle = {
  flex: 2,
  border: 'none',
  background: COLORS.primary,
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

const emptyTextStyle = {
  textAlign: 'center',
  color: COLORS.textGray,
  marginTop: 40,
  fontSize: 13,
};

const itemHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
};

const itemTitleStyle = {
  fontWeight: 900,
  color: COLORS.text,
  fontSize: 15,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
};

const codeBadgeStyle = {
  background: COLORS.primaryBg,
  color: COLORS.primary,
  borderRadius: 999,
  padding: '3px 7px',
  fontSize: 11,
  fontWeight: 900,
};

const itemMetaStyle = {
  fontSize: 11,
  color: COLORS.textGray,
  marginTop: 3,
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

const dangerButtonStyle = {
  ...smallButtonStyle,
  background: '#FEE2E2',
  color: '#DC2626',
};

const summaryStyle = {
  whiteSpace: 'pre-wrap',
  fontSize: 13,
  color: COLORS.text,
  lineHeight: 1.55,
  marginTop: 10,
};

const miniListTitleStyle = {
  fontSize: 12,
  fontWeight: 900,
  color: COLORS.primary,
  marginBottom: 4,
};

const miniListStyle = {
  margin: 0,
  paddingLeft: 18,
  color: COLORS.text,
  fontSize: 12,
  lineHeight: 1.6,
};

const scriptBoxStyle = {
  marginTop: 10,
  background: COLORS.primaryBg,
  color: COLORS.primary,
  borderRadius: 12,
  padding: '9px 10px',
  fontSize: 12,
  lineHeight: 1.55,
};
