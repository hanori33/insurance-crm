// src/pages/InsuranceContactPage.jsx
import React, { useState } from 'react';
import { COLORS } from '../constants';
import { Card } from '../components/Common';

const DAMAGE_INSURANCE = [
  { name: 'AIG손보', phone: '1544-2792', fax: '02-2011-4607', logo: '🔴' },
  { name: 'DB손해보험', phone: '1588-0100', fax: '0505-181-4862', logo: '🔴' },
  { name: 'KB손해보험', phone: '1544-0114', faxNumbers: [{ label: '장기', number: '0505-136-6500' }, { label: '일반', number: '055-136-6600' }], logo: '🟡' },
  { name: 'MG손보', phone: '1588-5959', fax: '0505-088-1646~9', logo: '🟢' },
  { name: '농협손보', phone: '1644-9000', fax: '0505-060-7000', logo: '🟢' },
  { name: '농협손해보험', phone: '1644-9000', fax: '0505-060-7000', logo: '🟢' },
  { name: '롯데손해보험', phone: '1588-3344', fax: '0507-333-9999', logo: '🔴' },
  { name: '메리츠화재', phone: '1566-7711', faxNumbers: [{ label: '질병', number: '0505-021-3400' }, { label: '상해', number: '0505-021-3500' }], logo: '🟣' },
  { name: '삼성화재', phone: '1588-5114', fax: '0505-162-0872', logo: '🔵' },
  { name: '에이스손보', phone: '1566-5800', faxNumbers: [{ label: '일반', number: '02-2127-2300' }, { label: '치아', number: '02-6913-8482' }], logo: '⬛' },
  { name: '한화손해보험', phone: '1566-8000', fax: '0502-779-1004', logo: '🟠' },
  { name: '하나손해보험', phone: '1566-3000', fax: '0505-170-0765', logo: '🔵' },
  { name: 'AXA손보', phone: '1566-2266', faxNotice: '콜센터 가상팩스 부여', logo: '🔵' },
  { name: '현대해상', phone: '1588-5656', fax: '0507-774-6060', logo: '🟡' },
  { name: '흥국화재', phone: '1688-1688', fax: '0504-800-0700', logo: '🔵' },
  { name: '우체국', phone: '1588-1300', fax: '0505-005-1623', faxNote: '부산', logo: '🔴' },
  { name: '신협', phone: '1544-3030', faxNotice: '해당 계약지점마다 다름', logo: '🟢' },
  { name: '수협', phone: '1588-4119', faxNotice: '해당 계약지점마다 다름', logo: '🔵' },
  { name: '새마을금고', phone: '1599-9010', faxNotice: '해당 계약지점마다 다름', logo: '🟢' },
  { name: '캐롯손해보험', phone: '1600-0880', fax: '',              logo: '🟠' },
];

const LIFE_INSURANCE = [
  { name: 'ABL생명', phone: '1588-6500', fax: '02-3299-5544', logo: '🔴' },
  { name: 'AIA생명', phone: '1588-9898', fax: '02-2021-4540', logo: '🔴' },
  { name: 'KB생명', phone: '1599-0882', fax: '02-6220-9912', logo: '🟡' },
  { name: 'KDB생명', phone: '1588-4040', fax: '02-2669-7930', logo: '🔵' },
  { name: '교보생명', phone: '1588-1001', faxNotice: '콜센터 가상팩스 부여', note: '30만원 이하', logo: '🟢' },
  { name: '농협생명', phone: '1833-4100', fax: '02-6971-6040', note: '200만원 이하', logo: '🟢' },
  { name: 'DB생명', phone: '1588-3131', fax: '0505-129-3134', note: '40만원 이하', logo: '🔴' },
  { name: '동양생명', phone: '1577-1004', fax: '02-3289-4517', note: '정액 30 / 실손 100 이하', logo: '🔵' },
  { name: '라이나생명', phone: '1588-0058', faxNumbers: [{ label: '일반', number: '02-6944-1200' }, { label: '치아', number: '02-6944-1283' }], logo: '⬛' },
  { name: '메트라이프', phone: '1588-9600', fax: '02-3469-9428', note: '50만원 이하', logo: '🔵' },
  { name: 'MetLife', phone: '1588-9600', fax: '02-3469-9428', note: '50만원 이하', logo: '🔵' },
  { name: '미래에셋생명', phone: '1588-0220', faxNotice: '콜센터 가상팩스 부여', logo: '🔴' },
  { name: '삼성생명', phone: '1588-3114', faxNotice: '콜센터 가상팩스 부여', note: '500만원 이하', logo: '🔵' },
  { name: '신한생명', phone: '1588-5580', faxNotice: '콜센터 가상팩스 부여', logo: '🔵' },
  { name: '처브라이프', phone: '1599-4600', fax: '02-3480-7801', logo: '⬛' },
  { name: 'CHUBB생명', phone: '1599-4600', fax: '02-3480-7801', logo: '⬛' },
  { name: '푸본현대생명', phone: '1577-3311', fax: '0505-106-0311', logo: '🔵' },
  { name: '한화생명', phone: '1588-6363', faxNotice: '콜센터 가상팩스 부여', note: '100만원 이하', logo: '🟠' },
  { name: '흥국생명', phone: '1588-2288', faxNotice: '콜센터 가상팩스 부여', logo: '🔴' },
  { name: '신한라이프', phone: '1588-5580', faxNotice: '콜센터 가상팩스 부여', logo: '🔵' },
  { name: '푸르덴셜생명', phone: '1588-3374', faxNotice: '해당 계약지점마다 다름', logo: '🟡' },
  { name: 'DGB생명', phone: '1588-4770', fax: '0505-083-5420', logo: '🟢' },
  { name: 'KB라이프', phone: '1588-3374', logo: '🟡' },
  { name: 'IBK연금보험', phone: '1577-4117', logo: '🔵' },
  { name: '하나생명', phone: '1577-1112', logo: '🟢' },
  { name: '카디프생명', phone: '1688-1118', logo: '🔵' },
  { name: 'iM라이프', phone: '1588-4770', logo: '🟢' },
];

function getFaxSearchText(company) {
  return [
    company.fax || '',
    company.faxNotice || '',
    company.faxNote || '',
    ...(company.faxNumbers || []).flatMap((item) => [item.label, item.number]),
  ].join(' ');
}

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
          <span style={{ fontSize: 13, color: COLORS.text }}>{company.faxNote ? `${company.faxNote} ${company.fax}` : company.fax}</span>
        </div>
      )}
      {company.faxNumbers?.length > 0 && (
        <div style={{ padding: '8px 0', borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6 }}>🖨 팩스번호</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {company.faxNumbers.map((item) => (
              <div key={`${company.name}-${item.label}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, color: COLORS.text }}>
                <span style={{ color: COLORS.textGray }}>{item.label}</span>
                <span style={{ fontWeight: 800 }}>{item.number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {company.faxNotice && (
        <div style={{ padding: '8px 0', borderTop: `1px solid ${COLORS.border}` }}>
          <span style={{ fontSize: 13, color: COLORS.textGray }}>🖨 팩스 안내</span>
          <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 800, marginTop: 4 }}>{company.faxNotice}</div>
        </div>
      )}
      {company.note && (
        <div style={{ fontSize: 12, color: COLORS.textGray, lineHeight: 1.5, marginTop: 8 }}>
          ※ {company.note}
        </div>
      )}
    </Card>
  );
}

export default function InsuranceContactPage({ onBack }) {
  const [tab, setTab] = useState('damage');
  const [search, setSearch] = useState('');

  const sourceList = tab === 'damage' ? DAMAGE_INSURANCE : LIFE_INSURANCE;
  const q = search.trim().toLowerCase();
  const list = q
    ? sourceList.filter((company) => {
        const haystack = `${company.name} ${company.phone} ${getFaxSearchText(company)}`.toLowerCase();
        return haystack.includes(q);
      })
    : sourceList;

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

      <div style={{ background: COLORS.white, padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="보험사명, 고객센터, 팩스번호 검색"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 14,
            outline: 'none',
            color: COLORS.text,
            background: '#F8FAFC',
          }}
        />
      </div>

      {/* 리스트 */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 40 }}>
        {list.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.textGray, textAlign: 'center', padding: '32px 0' }}>
            검색된 보험사가 없습니다.
          </div>
        ) : (
          list.map((company) => <InsuranceCard key={company.name} company={company} />)
        )}
      </div>
    </div>
  );
}
