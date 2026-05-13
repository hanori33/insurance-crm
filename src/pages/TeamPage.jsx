
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import ReferralTree from '../components/ReferralTree';

const MOCK = {
  id: 'root', name: '나 (김보플)', count: 29,
  children: [
    { id: 'c1', name: '김지훈', count: 6, children: [
      { id: 'c1a', name: '박지영', count: 4, children: [] },
      { id: 'c1b', name: '최영준', count: 3, children: [] },
    ]},
    { id: 'c2', name: '이영희', count: 5, children: [
      { id: 'c2a', name: '정은지', count: 3, children: [] },
      { id: 'c2b', name: '김한수', count: 2, children: [] },
    ]},
  ],
};

export default function TeamPage() {
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    // TODO: Supabase team_members 테이블 연동
    setTimeout(() => { setTreeData(MOCK); setLoading(false); }, 300);
  }, []);

  const stats = [
    { label: '총 인원', value: '23명' },
    { label: '1세대',   value: '2명'  },
    { label: '2세대',   value: '6명'  },
    { label: '3세대',   value: '15명' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: COLORS.white, padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0, textAlign: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>소개트리</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? <LoadingSpinner /> : (
          <>
            <Card><ReferralTree data={treeData} /></Card>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 14 }}>총 조직 현황</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {stats.map((s, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: COLORS.textGray, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}