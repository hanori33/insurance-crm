import React, { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import EmptyState from '../components/EmptyState';
import CurrentInsuranceManager from '../components/CurrentInsuranceManager';
import customerService from '../services/customerService';
import customerInsuranceService from '../services/customerInsuranceService';
import { formatDate } from '../utils';

function getCustomerId(customer) {
  return customer?.db_id || customer?.id || customer?.app_customer_id;
}

function getStatus(overview) {
  if (!overview?.contractCount) return '보험 미등록';
  if (!overview?.coverageCount) return '보험 등록됨';
  return '보장 데이터 있음';
}

function StatusPill({ status }) {
  const isReady = status === '보장 데이터 있음';
  const isContractOnly = status === '보험 등록됨';

  return (
    <span
      style={{
        background: isReady ? COLORS.primaryBg : isContractOnly ? '#FEF3C7' : '#F3F4F6',
        color: isReady ? COLORS.primary : isContractOnly ? '#92400E' : COLORS.textGray,
        borderRadius: 999,
        padding: '4px 9px',
        fontSize: 11,
        fontWeight: 900,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

export default function CoverageAnalysisPage({ onBack, onNavigate }) {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth <= 900);
  const [customers, setCustomers] = useState([]);
  const [overviewMap, setOverviewMap] = useState({});
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = () => setIsNarrow(window.innerWidth <= 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  async function load() {
    setLoading(true);

    try {
      const customerData = await customerService.list({ status: '전체', search: '' });
      const nextOverviewMap = await customerInsuranceService.listCustomerInsuranceOverview(
        (customerData || []).map(getCustomerId),
      );

      setCustomers(customerData || []);
      setOverviewMap(nextOverviewMap || {});

      if (selectedCustomer) {
        const nextSelected = (customerData || []).find(
          (customer) => String(getCustomerId(customer)) === String(getCustomerId(selectedCustomer)),
        );
        setSelectedCustomer(nextSelected || null);
      }
    } catch (error) {
      alert(error.message || '보장분석 정보를 불러오지 못했습니다.');
      setCustomers([]);
      setOverviewMap({});
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return customers;

    return customers.filter((customer) => {
      return (
        String(customer.name || '').toLowerCase().includes(keyword) ||
        String(customer.phone || '').toLowerCase().includes(keyword)
      );
    });
  }, [customers, search]);

  const selectedCustomerId = getCustomerId(selectedCustomer);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          background: COLORS.white,
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}
        >
          ←
        </button>
        <span style={{ fontWeight: 800, fontSize: 17, color: COLORS.text }}>보장분석</span>
        <button
          onClick={load}
          style={{ background: 'none', border: 'none', color: COLORS.primary, fontWeight: 800, cursor: 'pointer', fontSize: 13 }}
        >
          새로고침
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px 24px',
          display: 'grid',
          gridTemplateColumns: selectedCustomer && !isNarrow ? 'minmax(280px, 0.85fr) minmax(320px, 1.15fr)' : '1fr',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: COLORS.text }}>고객별 현재보장</div>
              <div style={{ marginTop: 3, color: COLORS.textGray, fontSize: 12 }}>
                고객상세의 현재보험 / 보장 데이터와 같은 자료를 사용합니다.
              </div>
            </div>
            <div style={{ color: COLORS.textGray, fontSize: 12, fontWeight: 800 }}>{filteredCustomers.length}명</div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: `1.5px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: '10px 12px',
              background: '#FAFAFA',
              marginBottom: 12,
            }}
          >
            <span>🔍</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="고객명, 연락처 검색"
              style={{
                border: 'none',
                background: 'none',
                outline: 'none',
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                color: COLORS.text,
                fontFamily: 'inherit',
              }}
            />
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : filteredCustomers.length === 0 ? (
            <EmptyState icon="🛡️" message="조회할 고객이 없습니다" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredCustomers.map((customer) => {
                const customerId = getCustomerId(customer);
                const overview = overviewMap[customerId] || {};
                const status = getStatus(overview);
                const active = selectedCustomerId && String(selectedCustomerId) === String(customerId);

                return (
                  <button
                    key={customerId}
                    type="button"
                    onClick={() => setSelectedCustomer(customer)}
                    style={{
                      width: '100%',
                      border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                      background: active ? COLORS.primaryBg : '#fff',
                      borderRadius: 14,
                      padding: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 14 }}>{customer.name || '이름 없음'}</div>
                        <div style={{ color: COLORS.textGray, fontSize: 12, marginTop: 3 }}>{customer.phone || '-'}</div>
                      </div>
                      <StatusPill status={status} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                      <SmallMetric label="현재보험" value={`${overview.contractCount || 0}건`} />
                      <SmallMetric label="담보" value={`${overview.coverageCount || 0}건`} />
                      <SmallMetric label="최근 수정" value={overview.latestUpdatedAt ? formatDate(overview.latestUpdatedAt) : '-'} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {selectedCustomer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 16 }}>{selectedCustomer.name}</div>
                  <div style={{ marginTop: 3, color: COLORS.textGray, fontSize: 12 }}>
                    {selectedCustomer.phone || '-'} · 고객상세와 동일한 현재보험 데이터를 표시합니다.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate?.('customerDetail', { id: selectedCustomerId })}
                  style={{
                    border: 'none',
                    background: COLORS.primary,
                    color: '#fff',
                    borderRadius: 999,
                    padding: '9px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  고객 상세 보기
                </button>
              </div>
            </Card>

            <CurrentInsuranceManager customerId={selectedCustomerId} />
          </div>
        ) : (
          <Card>
            <EmptyState
              icon="🛡️"
              message="고객을 선택해주세요"
              sub="현재보험 목록과 현재보장 합산을 여기서 확인할 수 있습니다."
            />
          </Card>
        )}
      </div>
    </div>
  );
}

function SmallMetric({ label, value }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '8px 9px', minWidth: 0 }}>
      <div style={{ color: COLORS.textGray, fontSize: 10, fontWeight: 800 }}>{label}</div>
      <div style={{ color: COLORS.text, fontSize: 12, fontWeight: 900, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  );
}
