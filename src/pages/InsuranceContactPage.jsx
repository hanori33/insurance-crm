// src/pages/InsuranceContactPage.jsx
import React, { useState } from 'react';
import { COLORS } from '../constants';
import { Card } from '../components/Common';

const DAMAGE_INSURANCE = [
  { name: 'DB손해보험',   phone: '1588-0100', fax: '0505-181-4862', logo: '🔴' },
  { name: '삼성화재',     phone: '1588-5114', fax: '0505-162-0872', logo: '🔵' },
  { name: '한화손해보험', phone: '1566-8000', fax: '0505-779-1004', logo: '🟠' },
  { name: '현대해상',     phone: '1588-5656', fax: '0507-162-0872', logo: '🟡' },
  { name: '메리츠화재',   phone: '1566-7711', fax: '0505-021-3400', logo: '🟣' },
  { name: '롯데손해보험', phone: '1588-3344', fax: '0504-800-0700', logo: '🔴' },
  { name: 'KB손해보험',   phone: '1544-0114', fax: '0505-100-0114', logo: '🟡' },
  { name: '흥국화재',     phone: '1688-1688', fax: '0505-008-0800', logo: '🔵' },
  { name: 'MG손해보험',   phone: '1588-5959', fax: '0505-100-5959', logo: '🟢' },
  { name: '농협손해보험', phone: '1544-2000', fax: '0505-100-2000', logo: '🟢' },
  { name: '캐롯손해보험', phone: '1600-0880', fax: '',              logo: '🟠' },
  { name: '하나손해보험', phone: '1566-3000', fax: '',              logo: '🔵' },
];

const LIFE_INSURANCE = [
  { name: '교보생명',       phone: '1588-1001', logo: '🟢' },
  { name: '신한라이프',     phone: '1588-5580', logo: '🔵' },
  { name: 'MetLife',        phone: '1588-9600', logo: '🔵' },
  { name: '삼성생명',       phone: '1588-3114', logo: '🔵' },
  { name: 'KDB생명',        phone: '1588-4040', logo: '🔵' },
  { name: 'KB라이프',       phone: '1588-3374', logo: '🟡' },
  { name: '흥국생명',       phone: '1588-2288', logo: '🔴' },
  { name: 'DB생명',         phone: '1588-3131', logo: '🔴' },
  { name: '동양생명',       phone: '1577-1004', logo: '🔵' },
  { name: 'ABL생명',        phone: '1588-6500', logo: '🔴' },
  { name: 'IBK연금보험',    phone: '1577-4117', logo: '🔵' },
  { name: '라이나생명',     phone: '1588-0058', logo: '⬛' },
  { name: '한화생명',       phone: '1588-6363', logo: '🟠' },
  { name: '하나생명',       phone: '1577-1112', logo: '🟢' },
  { name: '미래에셋생명',   phone: '1588-0220', logo: '🔴' },
  { name: '농협생명',       phone: '1544-4000', logo: '🟢' },
  { name: 'AIA생명',        phone: '1588-9898', logo: '🔴' },
  { name: 'CHUBB생명',      phone: '1599-4600', logo: '⬛' },
  { name: '카디프생명',     phone: '1688-1118', logo: '🔵' },
  { name: '푸본현대생명',   phone: '1577-3311', logo: '🔵' },
  { name: 'iM라이프',       phone: '1588-4770', logo: '🟢' },
];

function InsuranceCard({ company }) {
  function handleCall() {
    const clean = company.phone.replace(/-/g, '');
    window.location.href = `tel:${clean}`;
  }

  return (
    <Card style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24 }}>{company.logo}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{company.name}</span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: COLORS.textGray, marginBottom: 4 }}>고객센터</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 20, color: COLORS.primary, letterSpacing: -0.5 }}>{company.phone}</span>
          <button onClick={handleCall} style={{
            background: COLORS.primary, color: '#fff',
            border: 'none', borderRadius: 10,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>📞 전화걸기</button>
        </div>
      </div>

      {company.fax && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: `1px solid ${COLORS.border}` }}>
          <span style={{ fontSize: 13, color: COLORS.textGray }}>🖨 팩스번호</span>
          <span style={{ fontSize: 13, color: COLORS.text }}>{company.fax}</span>
        </div>
      )}
    </Card>
  );
}

export default function InsuranceContactPage({ onBack }) {
  const [tab, setTab] = useState('damage');

  const list = tab === 'damage' ? DAMAGE_INSURANCE : LIFE_INSURANCE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ background: COLORS.white, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>보험사 고객센터</span>
        <div style={{ width: 32 }} />
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', background: COLORS.white, borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        {[
          { id: 'damage', label: '손해보험' },
          { id: 'life',   label: '생명보험' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '14px 0',
            background: 'none', border: 'none', cursor: 'pointer',
            fontWeight: tab === t.id ? 700 : 400,
            fontSize: 15,
            color: tab === t.id ? COLORS.primary : COLORS.textGray,
            borderBottom: tab === t.id ? `2px solid ${COLORS.primary}` : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* 리스트 */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 40 }}>
        {list.map((company, i) => (
          <InsuranceCard key={i} company={company} />
        ))}
      </div>
    </div>
  );
}