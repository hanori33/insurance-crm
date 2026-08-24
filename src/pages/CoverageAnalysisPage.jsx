import React, { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import CurrentInsuranceManager from '../components/CurrentInsuranceManager';
import customerService from '../services/customerService';
import customerInsuranceService from '../services/customerInsuranceService';
import coverageCriteriaService from '../services/coverageCriteriaService';
import { formatDate } from '../utils';

function getCustomerId(customer) {
  return customer?.db_id || customer?.id || customer?.app_customer_id;
}

function getStatus(overview) {
  if (!overview?.contractCount) return '보험 미등록';
  if (!overview?.coverageCount) return '보험 등록됨';
  return '보장 데이터 있음';
}

function toManwon(value) {
  if (value === null || value === undefined || value === '') return '';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '';
  if (numberValue % 10000 === 0) return String(numberValue / 10000);
  return String(numberValue);
}

function fromManwon(value) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(numberValue)) return null;
  return numberValue * 10000;
}

function formatCoverageAmount(value) {
  if (value === null || value === undefined || value === '') return '-';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '-';
  if (numberValue >= 10000 && numberValue % 10000 === 0) {
    return `${(numberValue / 10000).toLocaleString('ko-KR')}만원`;
  }
  return `${numberValue.toLocaleString('ko-KR')}원`;
}

function formatDifference(value) {
  if (value === null || value === undefined) return '-';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '-';
  if (numberValue > 0) return `+${formatCoverageAmount(numberValue)}`;
  if (numberValue < 0) return `-${formatCoverageAmount(Math.abs(numberValue))}`;
  return '0';
}

function getRenewableLabel(value) {
  if (value === true) return '갱신';
  if (value === false) return '비갱신';
  return '확인필요';
}

function getAnalysisStatusStyle(status) {
  if (status === '부족' || status === '미가입') return { bg: COLORS.redBg, color: COLORS.red };
  if (status === '충족') return { bg: COLORS.greenBg, color: '#16A34A' };
  if (status === '기준 초과') return { bg: COLORS.blueBg, color: COLORS.blue };
  if (status === '별도') return { bg: '#FEF3C7', color: '#92400E' };
  return { bg: '#F3F4F6', color: COLORS.textGray };
}

function makeCriteriaDraft(categories, criteriaSet) {
  const existingByCategory = new Map(
    (criteriaSet?.items || []).map((item) => [item.standard_coverage_id, item]),
  );

  return (categories || []).map((category) => {
    const existing = existingByCategory.get(category.id);
    const isComparable = category.aggregation_mode === 'sum';

    return {
      standard_coverage_id: category.id,
      category,
      is_enabled: existing ? Boolean(existing.is_enabled) : isComparable,
      target_amount_manwon: isComparable ? toManwon(existing?.target_amount) : '',
      display_order: existing?.display_order ?? category.sort_order ?? 1000,
      memo: existing?.memo || '',
    };
  });
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

function AnalysisStatusPill({ status }) {
  const style = getAnalysisStatusStyle(status);
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
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
  const [categories, setCategories] = useState([]);
  const [criteriaSet, setCriteriaSet] = useState(null);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [criteriaSaving, setCriteriaSaving] = useState(false);
  const [criteriaModalOpen, setCriteriaModalOpen] = useState(false);
  const [criteriaName, setCriteriaName] = useState('내 분석기준');
  const [criteriaDraft, setCriteriaDraft] = useState([]);
  const [analysisFilter, setAnalysisFilter] = useState('all');
  const [insuranceRefreshKey, setInsuranceRefreshKey] = useState(0);

  useEffect(() => {
    load();
    loadCriteria();
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

  async function loadCriteria() {
    setCriteriaLoading(true);

    try {
      const [masterData, defaultSet] = await Promise.all([
        customerInsuranceService.listMasterData(),
        coverageCriteriaService.getDefaultCriteriaSet(),
      ]);

      setCategories(masterData.categories || []);
      setCriteriaSet(defaultSet);
    } catch (error) {
      alert(error.message || '분석기준을 불러오지 못했습니다.');
    } finally {
      setCriteriaLoading(false);
    }
  }

  function openCriteriaModal() {
    setCriteriaName(criteriaSet?.name || '내 분석기준');
    setCriteriaDraft(makeCriteriaDraft(categories, criteriaSet));
    setCriteriaModalOpen(true);
  }

  function setCriteriaDraftValue(index, key, value) {
    setCriteriaDraft((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  }

  async function saveCriteria() {
    setCriteriaSaving(true);

    try {
      const saved = await coverageCriteriaService.saveDefaultCriteriaSet({
        id: criteriaSet?.id,
        name: criteriaName,
        items: criteriaDraft.map((item) => ({
          standard_coverage_id: item.standard_coverage_id,
          target_amount: item.category?.aggregation_mode === 'sum' ? fromManwon(item.target_amount_manwon) : null,
          is_enabled: item.is_enabled,
          display_order: item.display_order,
          memo: item.memo,
        })),
      });

      setCriteriaSet(saved);
      setCriteriaModalOpen(false);
    } catch (error) {
      alert(error.message || '분석기준 저장에 실패했습니다.');
    } finally {
      setCriteriaSaving(false);
    }
  }

  function handleInsuranceChanged() {
    setInsuranceRefreshKey((prev) => prev + 1);
    load();
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={openCriteriaModal}
            disabled={criteriaLoading}
            style={{
              border: 'none',
              background: COLORS.primaryBg,
              color: COLORS.primary,
              borderRadius: 999,
              padding: '8px 11px',
              fontSize: 12,
              fontWeight: 900,
              cursor: criteriaLoading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            내 분석기준 설정
          </button>
          <button
            onClick={load}
            style={{ background: 'none', border: 'none', color: COLORS.primary, fontWeight: 800, cursor: 'pointer', fontSize: 13 }}
          >
            새로고침
          </button>
        </div>
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

          {!criteriaSet && !criteriaLoading && (
            <div style={{ background: COLORS.primaryBg, color: COLORS.primary, borderRadius: 14, padding: 12, fontSize: 12, fontWeight: 800, marginBottom: 12, lineHeight: 1.5 }}>
              내 분석기준을 설정해주세요. 보플랜은 기본 적정보장금액을 자동 추천하지 않습니다.
            </div>
          )}

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

            <CoverageAnalysisResult
              customerId={selectedCustomerId}
              criteriaSet={criteriaSet}
              filter={analysisFilter}
              onFilterChange={setAnalysisFilter}
              onOpenCriteria={openCriteriaModal}
              refreshKey={insuranceRefreshKey}
              isNarrow={isNarrow}
            />

            <CurrentInsuranceManager customerId={selectedCustomerId} onChanged={handleInsuranceChanged} />
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

      <CriteriaModal
        visible={criteriaModalOpen}
        name={criteriaName}
        items={criteriaDraft}
        saving={criteriaSaving}
        onNameChange={setCriteriaName}
        onChangeItem={setCriteriaDraftValue}
        onSave={saveCriteria}
        onClose={() => setCriteriaModalOpen(false)}
      />
    </div>
  );
}

function CoverageAnalysisResult({ customerId, criteriaSet, filter, onFilterChange, onOpenCriteria, refreshKey, isNarrow }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState('');

  useEffect(() => {
    load();
  }, [customerId, refreshKey]);

  async function load() {
    if (!customerId) return;
    setLoading(true);

    try {
      const contractData = await customerInsuranceService.listContracts(customerId);
      setContracts(contractData);
    } catch (error) {
      alert(error.message || '고객 보장분석 정보를 불러오지 못했습니다.');
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(
    () => customerInsuranceService.calculateCoverageSummary(contracts),
    [contracts],
  );

  const analysisRows = useMemo(
    () => customerInsuranceService.calculateCoverageAnalysis(summary, criteriaSet?.items || []),
    [summary, criteriaSet],
  );

  const filteredRows = useMemo(() => {
    if (filter === 'shortage') {
      return analysisRows.filter((row) => row.status === '부족' || row.status === '미가입');
    }
    if (filter === 'review') {
      return analysisRows.filter((row) => row.status === '확인 필요' || row.status === '별도');
    }
    return analysisRows;
  }, [analysisRows, filter]);

  if (!criteriaSet) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 16 }}>내 분석기준을 설정해주세요</div>
            <div style={{ color: COLORS.textGray, fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
              기준금액은 설계사가 직접 입력합니다. 보플랜은 적정 가입금액을 자동으로 정하지 않습니다.
            </div>
          </div>
          <button type="button" onClick={onOpenCriteria} style={primarySmallButtonStyle}>
            기준 설정
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 16 }}>현재 / 기준 비교</div>
          <div style={{ color: COLORS.textGray, fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
            이 분석은 내가 설정한 보장기준과 현재 등록된 보험정보를 비교한 결과입니다.
            보험 가입 필요성, 적정 가입금액 또는 가입 가능 여부를 의미하지 않습니다.
          </div>
        </div>
        <button type="button" onClick={onOpenCriteria} style={ghostSmallButtonStyle}>
          기준 수정
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <FilterButton label="전체 보기" active={filter === 'all'} onClick={() => onFilterChange('all')} />
        <FilterButton label="부족한 보장만 보기" active={filter === 'shortage'} onClick={() => onFilterChange('shortage')} />
        <FilterButton label="확인 필요 보기" active={filter === 'review'} onClick={() => onFilterChange('review')} />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filteredRows.length === 0 ? (
        <div style={{ color: COLORS.textGray, fontSize: 13, padding: '12px 0' }}>
          표시할 분석 항목이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredRows.map((row) => (
            <div key={row.key} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
              <button
                type="button"
                onClick={() => setExpandedKey((prev) => (prev === row.key ? '' : row.key))}
                style={{
                  width: '100%',
                  border: 'none',
                  background: '#fff',
                  padding: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'grid',
                  gridTemplateColumns: isNarrow ? '1fr 1fr' : 'minmax(110px, 1.1fr) repeat(3, minmax(70px, 0.8fr)) 86px',
                  gap: 8,
                  alignItems: 'center',
                  color: COLORS.text,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 900 }}>{row.name}</span>
                <MetricText label="현재" value={formatCoverageAmount(row.currentAmount)} />
                <MetricText label="내 기준" value={formatCoverageAmount(row.targetAmount)} />
                <MetricText label="차이" value={formatDifference(row.difference)} />
                <AnalysisStatusPill status={row.status} />
              </button>

              {expandedKey === row.key && (
                <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {row.memo && <div style={{ color: COLORS.textGray, fontSize: 12 }}>메모: {row.memo}</div>}
                  {row.status === '기준 초과' && (
                    <div style={{ color: COLORS.textGray, fontSize: 12 }}>
                      기준 초과는 내가 설정한 기준보다 현재 등록금액이 많다는 뜻이며, 중복 또는 불필요한 보험이라는 판단이 아닙니다.
                    </div>
                  )}
                  {row.details.length === 0 ? (
                    <div style={{ color: COLORS.textGray, fontSize: 12 }}>등록된 현재보험 담보가 없습니다.</div>
                  ) : (
                    row.details.map((detail) => (
                      <div key={detail.id} style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.55 }}>
                        <b>{detail.insuranceCompany}</b> · {detail.productName} · {formatCoverageAmount(detail.amount)}
                        <br />
                        <span style={{ color: COLORS.textGray }}>
                          원문: {detail.originalName || '-'} / 보험기간: {detail.coveragePeriod || '-'} / 납입기간: {detail.paymentPeriod || '-'} / {getRenewableLabel(detail.isRenewable)}
                        </span>
                        {detail.memo && <div style={{ color: COLORS.textGray }}>담보 메모: {detail.memo}</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CriteriaModal({ visible, name, items, saving, onNameChange, onChangeItem, onSave, onClose }) {
  return (
    <Modal visible={visible} onClose={onClose} title="내 분석기준 설정">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={labelStyle}>
          기준 이름
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="내 분석기준"
            style={inputStyle}
          />
        </label>

        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 12, color: COLORS.textGray, fontSize: 12, lineHeight: 1.55 }}>
          목표금액은 설계사가 직접 입력합니다. 합산 가능한 담보만 금액 비교에 사용하며, 별도/확인 필요 담보는 단순 비교하지 않습니다.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '52vh', overflowY: 'auto', paddingRight: 2 }}>
          {items.map((item, index) => {
            const category = item.category || {};
            const comparable = category.aggregation_mode === 'sum';

            return (
              <div key={item.standard_coverage_id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 900, color: COLORS.text }}>
                    <input
                      type="checkbox"
                      checked={item.is_enabled}
                      onChange={(event) => onChangeItem(index, 'is_enabled', event.target.checked)}
                    />
                    {category.name}
                  </label>
                  <span style={{ color: comparable ? COLORS.primary : '#92400E', background: comparable ? COLORS.primaryBg : '#FEF3C7', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 900 }}>
                    {comparable ? '금액 비교' : category.aggregation_mode === 'separate' ? '별도' : '확인 필요'}
                  </span>
                </div>

                <div style={{ color: COLORS.textGray, fontSize: 11, marginTop: 6 }}>
                  {category.group_name || '기타'} · {comparable ? '목표금액을 입력하면 현재보장과 비교합니다.' : '금액 비교 대상이 아닙니다.'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: comparable ? '1fr 92px' : '92px', gap: 8, marginTop: 10 }}>
                  {comparable && (
                    <label style={labelStyle}>
                      목표금액(만원)
                      <input
                        type="number"
                        min="0"
                        value={item.target_amount_manwon}
                        onChange={(event) => onChangeItem(index, 'target_amount_manwon', event.target.value)}
                        placeholder="직접 입력"
                        style={inputStyle}
                      />
                    </label>
                  )}
                  <label style={labelStyle}>
                    표시순서
                    <input
                      type="number"
                      value={item.display_order}
                      onChange={(event) => onChangeItem(index, 'display_order', event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>

                <label style={{ ...labelStyle, marginTop: 8 }}>
                  메모
                  <input
                    value={item.memo}
                    onChange={(event) => onChangeItem(index, 'memo', event.target.value)}
                    placeholder="기준 관련 메모"
                    style={inputStyle}
                  />
                </label>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={onSave} disabled={saving} style={{ ...primarySmallButtonStyle, width: '100%', justifyContent: 'center', padding: '12px 14px' }}>
          {saving ? '저장 중...' : '분석기준 저장'}
        </button>
      </div>
    </Modal>
  );
}

function FilterButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: active ? COLORS.primary : '#fff',
        color: active ? '#fff' : COLORS.textGray,
        boxShadow: active ? 'none' : `inset 0 0 0 1px ${COLORS.border}`,
        borderRadius: 999,
        padding: '7px 11px',
        fontSize: 12,
        fontWeight: 900,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function MetricText({ label, value }) {
  return (
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'block', color: COLORS.textGray, fontSize: 10, fontWeight: 800 }}>{label}</span>
      <span style={{ display: 'block', color: COLORS.text, fontSize: 12, fontWeight: 900, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </span>
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

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: COLORS.textGray,
  fontSize: 12,
  fontWeight: 800,
};

const inputStyle = {
  border: `1.5px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: '10px 11px',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  color: COLORS.text,
  boxSizing: 'border-box',
  width: '100%',
};

const primarySmallButtonStyle = {
  border: 'none',
  background: COLORS.primary,
  color: '#fff',
  borderRadius: 999,
  padding: '9px 12px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const ghostSmallButtonStyle = {
  border: 'none',
  background: COLORS.primaryBg,
  color: COLORS.primary,
  borderRadius: 999,
  padding: '9px 12px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
