import React, { useEffect, useState } from 'react';
import { COLORS } from '../constants';
import { supabase } from '../supabaseClient';

export default function AdminInquiryPage({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [memo, setMemo] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setItems(data || []);
    } catch (e) {
      alert('문의 목록 불러오기 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, status) {
    try {
      const { error } = await supabase
        .from('inquiries')
        .update({
          status,
          admin_memo: memo,
          processed_at:
            status === '처리완료'
              ? new Date().toISOString()
              : null,
        })
        .eq('id', id);

      if (error) throw error;

      alert('저장되었습니다.');

      setSelected(null);
      setMemo('');

      load();
    } catch (e) {
      alert('저장 실패: ' + e.message);
    }
  }

  async function deleteInquiry(id) {
    const ok = window.confirm(
      '정말 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.'
    );

    if (!ok) return;

    try {
      const { error } = await supabase
        .from('inquiries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('삭제되었습니다.');

      if (selected?.id === id) {
        setSelected(null);
        setMemo('');
      }

      load();
    } catch (e) {
      alert('삭제 실패: ' + e.message);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          background: '#fff',
          padding: '14px 20px',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            border: 'none',
            background: 'none',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ←
        </button>

        <b style={{ fontSize: 17 }}>관리자 문의함</b>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading ? (
          <div>불러오는 중...</div>
        ) : items.length === 0 ? (
          <div style={{ color: COLORS.textGray }}>
            접수된 문의가 없습니다.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: 16,
                  boxShadow:
                    '0 2px 14px rgba(124,92,252,0.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      [{item.category}] {item.title}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: COLORS.textGray,
                        marginTop: 8,
                        lineHeight: 1.7,
                      }}
                    >
                      <div>
                        👤 {item.user_name || '이름없음'}
                      </div>

                      <div>
                        📧 {item.user_email || '-'}
                      </div>

                      <div>
                        🕒{' '}
                        {new Date(
                          item.created_at
                        ).toLocaleString('ko-KR')}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      height: 26,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 900,
                      background:
                        item.status === '처리완료'
                          ? '#DCFCE7'
                          : '#FEF3C7',
                      color:
                        item.status === '처리완료'
                          ? '#16A34A'
                          : '#D97706',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.status}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                  }}
                >
                  {item.content}
                </div>

                {selected?.id === item.id ? (
                  <div style={{ marginTop: 12 }}>
                    <textarea
                      value={memo}
                      onChange={(e) =>
                        setMemo(e.target.value)
                      }
                      placeholder="관리자 메모"
                      style={{
                        width: '100%',
                        minHeight: 90,
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${COLORS.border}`,
                        boxSizing: 'border-box',
                      }}
                    />

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <button
                        onClick={() =>
                          updateStatus(
                            item.id,
                            '처리완료'
                          )
                        }
                        style={btn('#16A34A')}
                      >
                        처리완료
                      </button>

                      <button
                        onClick={() =>
                          updateStatus(item.id, '대기')
                        }
                        style={btn('#D97706')}
                      >
                        대기
                      </button>

                      <button
                        onClick={() =>
                          deleteInquiry(item.id)
                        }
                        style={btn('#DC2626')}
                      >
                        삭제
                      </button>

                      <button
                        onClick={() =>
                          setSelected(null)
                        }
                        style={btn('#6B7280')}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    <button
                      onClick={() => {
                        setSelected(item);
                        setMemo(
                          item.admin_memo || ''
                        );
                      }}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRadius: 10,
                        padding: '9px 12px',
                        background:
                          COLORS.primaryBg,
                        color: COLORS.primary,
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      처리하기
                    </button>

                    <button
                      onClick={() =>
                        deleteInquiry(item.id)
                      }
                      style={{
                        border: 'none',
                        borderRadius: 10,
                        padding: '9px 14px',
                        background: '#FEE2E2',
                        color: '#DC2626',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function btn(bg) {
  return {
    flex: 1,
    border: 'none',
    borderRadius: 10,
    padding: '10px 0',
    background: bg,
    color: '#fff',
    fontWeight: 900,
    cursor: 'pointer',
  };
}