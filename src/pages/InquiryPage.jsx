import React, { useEffect, useState } from 'react';
import { COLORS } from '../constants';
import { supabase } from '../supabaseClient';
import Field from '../components/Field';

export default function InquiryPage({ user, onBack }) {
  const [category, setCategory] = useState('문의');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [myInquiries, setMyInquiries] = useState([]);

  useEffect(() => {
    loadMyInquiries();
  }, []);

  async function loadMyInquiries() {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setMyInquiries(data || []);
  }

  async function submit() {
    if (!title.trim()) return alert('제목을 입력해주세요.');
    if (!content.trim()) return alert('내용을 입력해주세요.');

    setSaving(true);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user?.id)
        .single();

      const { error } = await supabase.from('inquiries').insert({
        user_id: user?.id,
        user_email: user?.email || '',
        user_name: profile?.name || user?.user_metadata?.display_name || user?.email || '',
        category,
        title: title.trim(),
        content: content.trim(),
        status: '대기',
      });

      if (error) throw error;

      alert('문의가 접수되었습니다.');
      setTitle('');
      setContent('');
      setCategory('문의');
      await loadMyInquiries();
    } catch (e) {
      alert('문의 접수 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#fff', padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }}>←</button>
        <b style={{ fontSize: 17 }}>문의하기 / 오류 제보</b>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 2px 14px rgba(124,92,252,0.08)', marginBottom: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: COLORS.textGray }}>문의 종류</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {['문의', '오류', '개선요청'].map(v => (
                <button
                  key={v}
                  onClick={() => setCategory(v)}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    padding: '8px 14px',
                    background: category === v ? COLORS.primary : COLORS.primaryBg,
                    color: category === v ? '#fff' : COLORS.primary,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <span style={{ fontSize: 13, color: COLORS.textGray }}>제목</span>
          <Field icon="📝" placeholder="제목을 입력하세요" value={title} onChange={e => setTitle(e.target.value)} />

          <span style={{ fontSize: 13, color: COLORS.textGray }}>내용</span>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="오류 상황이나 문의 내용을 자세히 적어주세요."
            style={{
              width: '100%',
              minHeight: 150,
              padding: 14,
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              boxSizing: 'border-box',
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />

          <button
            onClick={submit}
            disabled={saving}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '14px 0',
              borderRadius: 12,
              border: 'none',
              background: COLORS.primary,
              color: '#fff',
              fontWeight: 900,
              fontSize: 15,
              cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '접수 중...' : '문의 접수'}
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 2px 14px rgba(124,92,252,0.08)' }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>내 문의 내역</h3>

          {myInquiries.length === 0 ? (
            <div style={{ color: COLORS.textGray, fontSize: 13 }}>
              접수된 문의가 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myInquiries.map(item => (
                <div key={item.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <b>[{item.category}] {item.title}</b>
                    <span style={{
                      padding: '3px 9px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 900,
                      background: item.status === '처리완료' ? '#DCFCE7' : '#FEF3C7',
                      color: item.status === '처리완료' ? '#16A34A' : '#D97706',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.status}
                    </span>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, color: COLORS.textGray }}>
                    {new Date(item.created_at).toLocaleString('ko-KR')}
                  </div>

                  <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {item.content}
                  </div>

                  {item.admin_memo && (
                    <div style={{
                      marginTop: 12,
                      background: COLORS.primaryBg,
                      color: COLORS.primary,
                      borderRadius: 12,
                      padding: 12,
                      lineHeight: 1.6,
                      fontWeight: 700,
                    }}>
                      <div style={{ marginBottom: 4 }}>💬 관리자 답변</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{item.admin_memo}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}