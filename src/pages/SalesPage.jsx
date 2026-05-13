
// src/pages/SalesPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import SaleForm from '../components/SaleForm';
import salesService from '../services/salesService';
import customerService from '../services/customerService';
import { formatNumber } from '../utils';

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
  const [retention, setRetention]   = useState(88);
  const [total, setTotal]           = useState(24580);
  const [chartData, setChartData]   = useState([10, 18, 16, 28, 25, 32]);
  const [chartLabels, setChartLabels] = useState(['1월','2월','3월','4월','5월']);
  const [loading, setLoading]       = useState(false);
  const [showForm, setShowForm]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [monthly, counts] = await Promise.all([
        salesService.monthlySales(5).catch(() => ({})),
        customerService.statusCounts().catch(() => ({})),
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
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: COLORS.white, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>통계</span>
        <button onClick={() => setShowForm(true)} style={{ background: 'none', border: 'none', color: COLORS.primary, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ 매출</button>
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
          </>
        )}
      </div>
      <SaleForm visible={showForm} onClose={() => setShowForm(false)} onSave={load} />
    </div>
  );
}