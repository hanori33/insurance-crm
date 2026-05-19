// src/pages/SalesPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card, Divider, LoadingSpinner } from '../components/Common';
import SaleForm from '../components/SaleForm';
import salesService from '../services/salesService';
import customerService from '../services/customerService';
import { formatNumber } from '../utils';
import { supabase } from '../supabaseClient';

function DonutChart({ pct = 88, size = 100 }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={COLORS.primaryLighter} strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={COLORS.primary} strokeWidth={10}
        strokeDasharray={`${c * pct / 100} ${c * (1 - pct / 100)}`}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

function LineChart({ data = [], labels = [] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = 280, H = 110;
  const pts = data.map((v, i) => ({ x: i * W / (data.length - 1), y: H - (v / max) * (H - 10) - 5 }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${pts[pts.length-1].x} ${H} L 0 ${H} Z`;
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H + 20} viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%' }}>
        <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.18} /><stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} /></linearGradient></defs>
        <path d={area} fill="url(#ag)" />
        <path d={path} fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === pts.length-1 ? 5.5 : 3.5} fill="#fff" stroke={COLORS.primary} strokeWidth={2} />)}
        {labels.map((l, i) => pts[i] && <text key={i} x={pts[i].x} y={H + 16} textAnchor="middle" fontSize={10} fill={COLORS.textGray}>{l}</text>)}
      </svg>
    </div>
  );
}

export default function SalesPage({ onBack }) {
  const [retention, setRetention] = useState(88);
  const [total, setTotal] = useState(24580);
  const [chartData, setChartData] = useState([10, 18, 16, 28, 25, 32]);
  const [chartLabels, setChartLabels] = useState(['1월','2월','3월','4월','5월']);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [salesList, setSalesList] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [openMonths, setOpenMonths] = useState({}); // ← 들여쓰기 맞추기

  useEffect(() => { load(); }, []);

  async function load() {
  setLoading(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const [monthly, counts, sales] = await Promise.all([
      salesService.monthlySales(5).catch(() => ({})),
      customerService.statusCounts().catch(() => ({})),
      supabase.from('sales').select('*').eq('user_id', user.id).order('sale_date', { ascending: false }).then(r => r.data || []),
    ]);
    const tot = Object.values(counts).reduce((a, b) => a + b, 0);
    const active = (counts['유지중'] || 0) + (counts['계약중'] || 0);
    if (tot > 0) setRetention(Math.round(active / tot * 100));
    const keys = Object.keys(monthly).sort();
    if (keys.length > 0) {
      setChartData(keys.map(k => monthly[k]));
      setChartLabels(keys.map(k => `${parseInt(k.split('-')[1])}월`));
      setTotal(Math.round(monthly[keys[keys.length-1]] || 0));
    }
    setSalesList(sales);

    // ✅ 최신 월만 기본으로 열기
    if (sales.length > 0) {
      const latestMonth = sales[0].sale_date?.slice(0, 7);
      if (latestMonth) setOpenMonths({ [latestMonth]: true });
    }

  } finally { setLoading(false); }
}

  async function handleDelete(id) {
    if (!window.confirm('삭제하시겠습니까?')) return;
    await supabase.from('sales').delete().eq('id', id);
    load();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: COLORS.white, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>통계</span>
        <button onClick={() => { setEditItem(null); setShowForm(true); }} style={{ background: 'none', border: 'none', color: COLORS.primary, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ 매출</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? <LoadingSpinner /> : (
          <>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 14 }}>유지율 현황</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 38, fontWeight: 800, color: COLORS.primary }}>{retention}%</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <span style={{ color: COLORS.green, fontSize: 12, fontWeight: 700 }}>▲ 3%</span>
                    <span style={{ color: COLORS.textGray, fontSize: 12 }}>전월 대비</span>
                  </div>
                </div>
                <DonutChart pct={retention} />
              </div>
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 4 }}>월별 매출 현황 <span style={{ fontSize: 11, color: COLORS.textGray }}>(단위: 천원)</span></div>
              <div style={{ fontSize: 34, fontWeight: 800, color: COLORS.text, margin: '10px 0 4px' }}>{formatNumber(total)}</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                <span style={{ color: COLORS.green, fontSize: 12, fontWeight: 700 }}>▲ 12%</span>
                <span style={{ color: COLORS.textGray, fontSize: 12 }}>전월 대비</span>
              </div>
              <LineChart data={chartData} labels={chartLabels} />
            </Card>

            {/* 매출 내역 목록 */}
<Card>
  <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 14 }}>매출 내역</div>
  {salesList.length === 0 ? (
    <div style={{ fontSize: 13, color: COLORS.textGray, textAlign: 'center', padding: '20px 0' }}>
      등록된 매출이 없습니다
    </div>
  ) : (
    (() => {
      const groups = {};
      salesList.forEach(s => {
        const key = s.sale_date ? s.sale_date.slice(0, 7) : '날짜 없음';
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
      });
      const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

      return sortedKeys.map(month => {
        const isOpen = openMonths[month] !== false; // 기본값 열림
        return (
          <div key={month} style={{ marginBottom: 10 }}>
            {/* 월 헤더 - 클릭하면 토글 */}
            <div
              onClick={() => setOpenMonths(prev => ({ ...prev, [month]: !isOpen }))}
              style={{
                fontSize: 12, fontWeight: 800, color: COLORS.primary,
                background: COLORS.primaryBg, borderRadius: 8,
                padding: '8px 12px', marginBottom: isOpen ? 8 : 0,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span>{month === '날짜 없음' ? '날짜 없음' : `${parseInt(month.split('-')[1])}월 (${month.split('-')[0]})`}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, color: COLORS.textGray, fontSize: 11 }}>
                  {groups[month].length}건 · {formatNumber(groups[month].reduce((sum, s) => sum + (s.monthly_premium || 0), 0))}원
                </span>
                <span style={{ fontSize: 12, color: COLORS.textGray }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* 펼쳐졌을 때만 목록 표시 */}
            {isOpen && groups[month].map((s, i) => (
              <React.Fragment key={s.id}>
                <div style={{ padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>
                        {s.customer_name || '-'}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>
                        {s.insurance_company} {s.product_name}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 2 }}>
                        월 보험료: {s.monthly_premium ? `${formatNumber(s.monthly_premium)}원` : '-'}
                        {s.commission ? ` · 수수료: ${formatNumber(s.commission)}원` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>
                        계약일: {s.sale_date || '-'}
                        {s.expiry_date ? ` · 만기: ${s.expiry_date}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={e => { e.stopPropagation(); setEditItem(s); setShowForm(true); }}
                        style={{
                          border: 'none', background: '#EEF2FF',
                          color: COLORS.primary, borderRadius: 999,
                          padding: '5px 10px', fontSize: 11,
                          fontWeight: 700, cursor: 'pointer',
                        }}
                      >수정</button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                        style={{
                          border: 'none', background: '#FEE2E2',
                          color: '#DC2626', borderRadius: 999,
                          padding: '5px 10px', fontSize: 11,
                          fontWeight: 700, cursor: 'pointer',
                        }}
                      >삭제</button>
                    </div>
                  </div>
                </div>
                {i < groups[month].length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </div>
        );
      });
    })()
  )}
</Card>
          </>
        )}
      </div>

      <SaleForm
        visible={showForm}
        onClose={() => { setShowForm(false); setEditItem(null); }}
        onSave={load}
        initial={editItem}
      />
    </div>
  );
}