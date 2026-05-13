
import React, { useState, useEffect, useCallback } from 'react';
import { COLORS, CUSTOMER_FILTERS } from '../constants';
import { Card, LoadingSpinner, FilterChip } from '../components/Common';
import EmptyState from '../components/EmptyState';
import CustomerCard from '../components/CustomerCard';
import CustomerForm from '../components/CustomerForm';
import customerService from '../services/customerService';

export default function CustomersPage({ onNavigate }) {
  const [filter, setFilter]     = useState('전체');
  const [search, setSearch]     = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCustomers(await customerService.list({ status: filter, search })); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ background: COLORS.white, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>고객 관리</span>
        <span style={{ fontSize: 12, color: COLORS.textGray }}>{customers.length}명</span>
      </div>

      {/* 검색 + 추가 */}
      <div style={{ padding: '12px 16px 0', background: COLORS.bg, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: COLORS.white, borderRadius: 12, padding: '10px 14px', border: `1.5px solid ${COLORS.border}` }}>
            <span style={{ color: COLORS.textGray }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="고객명, 전화번호 검색"
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, flex: 1, color: COLORS.text, fontFamily: 'inherit' }} />
          </div>
          <button onClick={() => setShowForm(true)} style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: COLORS.primary, color: '#fff', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
          {CUSTOMER_FILTERS.map(f => <FilterChip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />)}
        </div>
      </div>

      {/* 리스트 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
        {loading ? <LoadingSpinner /> :
         customers.length === 0
           ? <EmptyState icon="👥" message="고객이 없습니다" sub="+ 버튼으로 추가하세요" action={() => setShowForm(true)} actionLabel="고객 추가" />
           : <Card style={{ padding: 0, marginTop: 4 }}>
               {customers.map((c, i) => (
                 <CustomerCard key={c.id || i} customer={c} isLast={i === customers.length - 1}
                   onClick={() => onNavigate('customerDetail', { id: c.id })} />
               ))}
             </Card>
        }
      </div>

      <CustomerForm visible={showForm} onClose={() => setShowForm(false)} onSave={load} />
    </div>
  );
}