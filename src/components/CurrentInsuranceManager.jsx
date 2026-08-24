import React, { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../constants';
import { LoadingSpinner } from './Common';
import Modal from './Modal';
import Field from './Field';
import customerInsuranceService from '../services/customerInsuranceService';

const emptyContractForm = {
  insurance_company: '',
  company_mode: '',
  product_name: '',
  joined_at: '',
  monthly_premium: '',
  payment_period: '',
  coverage_period: '',
  renewal_type: '확인필요',
  contract_status: '유지중',
  contractor: '',
  insured: '',
  policy_number: '',
  memo: '',
};

const emptyCoverageForm = {
  standard_coverage_id: '',
  original_name: '',
  coverage_amount_manwon: '',
  coverage_period: '',
  payment_period: '',
  is_renewable: '',
  memo: '',
};

const renewalOptions = ['확인필요', '갱신형', '비갱신형', '혼합'];
const statusOptions = ['유지중', '납입중', '납입완료', '실효', '해지', '만기', '확인필요'];

function formatWon(value) {
  if (value === null || value === undefined || value === '') return '-';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '-';
  return `${numberValue.toLocaleString('ko-KR')}원`;
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

function getRenewableLabel(value) {
  if (value === true) return '갱신';
  if (value === false) return '비갱신';
  return '확인필요';
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

function SelectField({ label, value, onChange, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: COLORS.textGray }}>
      {label}
      <select
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          border: `1.5px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: '12px 14px',
          background: '#FAFAFA',
          color: COLORS.text,
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      >
        {children}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: COLORS.textGray }}>
      {label}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%',
          border: `1.5px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: '12px 14px',
          background: '#FAFAFA',
          color: COLORS.text,
          fontSize: 14,
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />
    </label>
  );
}

function PrimaryButton({ children, onClick, disabled, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 'none',
        background: disabled ? '#C4B5FD' : COLORS.primary,
        color: '#fff',
        borderRadius: 12,
        padding: '11px 14px',
        fontSize: 13,
        fontWeight: 900,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, danger, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: danger ? '#FEE2E2' : COLORS.primaryBg,
        color: danger ? '#DC2626' : COLORS.primary,
        borderRadius: 12,
        padding: '9px 12px',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function makeContractForm(contract, companies) {
  if (!contract) return emptyContractForm;
  const hasCompanyOption = companies.some((company) => company.name === contract.insurance_company);

  return {
    insurance_company: contract.insurance_company || '',
    company_mode: hasCompanyOption ? contract.insurance_company : '__custom__',
    product_name: contract.product_name || '',
    joined_at: contract.joined_at || '',
    monthly_premium: contract.monthly_premium ?? '',
    payment_period: contract.payment_period || '',
    coverage_period: contract.coverage_period || '',
    renewal_type: contract.renewal_type || '확인필요',
    contract_status: contract.contract_status || '유지중',
    contractor: contract.contractor || '',
    insured: contract.insured || '',
    policy_number: contract.policy_number || '',
    memo: contract.memo || '',
  };
}

function makeCoverageForm(coverage, uncategorizedCategory) {
  if (!coverage) {
    return {
      ...emptyCoverageForm,
      standard_coverage_id: uncategorizedCategory?.id || '',
    };
  }

  return {
    standard_coverage_id: coverage.standard_coverage_id || uncategorizedCategory?.id || '',
    original_name: coverage.original_name || '',
    coverage_amount_manwon: toManwon(coverage.coverage_amount),
    coverage_period: coverage.coverage_period || '',
    payment_period: coverage.payment_period || '',
    is_renewable: coverage.is_renewable === true ? 'true' : coverage.is_renewable === false ? 'false' : '',
    memo: coverage.memo || '',
  };
}

export default function CurrentInsuranceManager({ customerId, onOpenAnalysis, onChanged }) {
  const [contracts, setContracts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contractModal, setContractModal] = useState(null);
  const [coverageModal, setCoverageModal] = useState(null);
  const [contractForm, setContractForm] = useState(emptyContractForm);
  const [coverageForm, setCoverageForm] = useState(emptyCoverageForm);
  const [expandedSummaryKey, setExpandedSummaryKey] = useState('');

  const uncategorizedCategory = useMemo(
    () => customerInsuranceService.getUncategorizedCategory(categories),
    [categories],
  );

  const summary = useMemo(
    () => customerInsuranceService.calculateCoverageSummary(contracts),
    [contracts],
  );

  async function load() {
    if (!customerId) return;
    setLoading(true);

    try {
      const [masterData, contractData] = await Promise.all([
        customerInsuranceService.listMasterData(),
        customerInsuranceService.listContracts(customerId),
      ]);

      setCategories(masterData.categories);
      setCompanies(masterData.companies);
      setContracts(contractData);
    } catch (e) {
      alert(e.message || '현재보험 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [customerId]);

  function openContractModal(contract = null) {
    setContractForm(makeContractForm(contract, companies));
    setContractModal(contract || { id: null });
  }

  function openCoverageModal(contract, coverage = null) {
    setCoverageForm(makeCoverageForm(coverage, uncategorizedCategory));
    setCoverageModal({ contract, coverage });
  }

  function setContractValue(key, value) {
    setContractForm((prev) => ({ ...prev, [key]: value }));
  }

  function setCoverageValue(key, value) {
    setCoverageForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveContract() {
    if (!contractForm.insurance_company.trim() && !contractForm.product_name.trim()) {
      alert('보험회사 또는 상품명을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      if (contractModal?.id) {
        await customerInsuranceService.updateContract(contractModal.id, contractForm);
      } else {
        await customerInsuranceService.createContract(customerId, contractForm);
      }

      setContractModal(null);
      await load();
      onChanged?.();
    } catch (e) {
      alert(e.message || '보험 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function removeContract(contract) {
    if (!window.confirm('이 보험계약과 담보를 삭제할까요?')) return;

    setSaving(true);
    try {
      await customerInsuranceService.removeContract(contract.id);
      await load();
      onChanged?.();
    } catch (e) {
      alert(e.message || '보험 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function saveCoverage() {
    const standardCoverageId = coverageForm.standard_coverage_id || uncategorizedCategory?.id || null;

    if (!standardCoverageId && !coverageForm.original_name.trim()) {
      alert('표준담보를 선택하거나 보험사 원문 담보명을 입력해주세요.');
      return;
    }

    const payload = {
      ...coverageForm,
      standard_coverage_id: standardCoverageId,
      coverage_amount: fromManwon(coverageForm.coverage_amount_manwon),
      is_renewable:
        coverageForm.is_renewable === 'true'
          ? true
          : coverageForm.is_renewable === 'false'
            ? false
            : null,
    };

    setSaving(true);
    try {
      if (coverageModal?.coverage?.id) {
        await customerInsuranceService.updateCoverage(coverageModal.coverage.id, payload);
      } else {
        await customerInsuranceService.createCoverage(customerId, coverageModal.contract.id, payload);
      }

      setCoverageModal(null);
      await load();
      onChanged?.();
    } catch (e) {
      alert(e.message || '담보 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function removeCoverage(coverage) {
    if (!window.confirm('이 담보를 삭제할까요?')) return;

    setSaving(true);
    try {
      await customerInsuranceService.removeCoverage(coverage.id);
      await load();
      onChanged?.();
    } catch (e) {
      alert(e.message || '담보 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const companySelectValue = contractForm.company_mode || (
    companies.some((company) => company.name === contractForm.insurance_company)
      ? contractForm.insurance_company
      : contractForm.insurance_company
        ? '__custom__'
        : ''
  );

  return (
    <div
      style={{
        background: COLORS.white,
        borderRadius: 16,
        padding: 16,
        boxShadow: `0 2px 14px rgba(124,92,252,0.10)`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>현재보험 / 보장</div>
            <div style={{ marginTop: 2, fontSize: 12, color: COLORS.textGray }}>
              기존 보험 이력과 별도로 구조화 저장합니다.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {onOpenAnalysis && (
            <GhostButton onClick={onOpenAnalysis}>
              보장분석 열기
            </GhostButton>
          )}
          <PrimaryButton onClick={() => openContractModal()} disabled={saving}>
            + 보험 추가
          </PrimaryButton>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, background: '#F8FAFC' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 14 }}>현재보장 합산</div>
              <div style={{ color: COLORS.textGray, fontSize: 12 }}>{summary.length}개 담보군</div>
            </div>

            {summary.length === 0 ? (
              <div style={{ color: COLORS.textGray, fontSize: 13 }}>
                등록된 담보가 없습니다. 보험계약을 추가한 뒤 담보를 입력해주세요.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {summary.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      background: '#fff',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedSummaryKey((prev) => (prev === item.key ? '' : item.key))}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: '#fff',
                        padding: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(110px, 1.3fr) minmax(90px, 1fr) 70px 76px',
                        gap: 8,
                        alignItems: 'center',
                        color: COLORS.text,
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 900 }}>{item.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>{formatCoverageAmount(item.totalAmount)}</span>
                      <span style={{ fontSize: 12, color: COLORS.textGray }}>{item.contractCount}건</span>
                      <span
                        style={{
                          justifySelf: 'start',
                          background: item.aggregationMode === 'sum' ? COLORS.primaryBg : '#FEF3C7',
                          color: item.aggregationMode === 'sum' ? COLORS.primary : '#92400E',
                          borderRadius: 999,
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        {item.statusLabel}
                      </span>
                    </button>

                    {expandedSummaryKey === item.key && (
                      <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {item.details.map((detail) => (
                          <div key={detail.id} style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.55 }}>
                            <b>{detail.insuranceCompany}</b> · {detail.productName} · {formatCoverageAmount(detail.amount)}
                            <br />
                            <span style={{ color: COLORS.textGray }}>
                              원문: {detail.originalName || '-'} / 보험기간: {detail.coveragePeriod || '-'} / 납입기간: {detail.paymentPeriod || '-'} / {getRenewableLabel(detail.isRenewable)}
                            </span>
                            {detail.memo && <div style={{ color: COLORS.textGray }}>메모: {detail.memo}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {contracts.length === 0 ? (
            <div style={{ color: COLORS.textGray, fontSize: 13, padding: '8px 0' }}>
              등록된 현재보험이 없습니다.
            </div>
          ) : (
            contracts.map((contract) => (
              <div
                key={contract.id}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 14,
                  padding: 14,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: COLORS.text }}>
                      {contract.insurance_company || '보험회사 미입력'}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 13, color: COLORS.text }}>
                      {contract.product_name || '상품명 미입력'}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <span style={chipStyle}>월 {formatWon(contract.monthly_premium)}</span>
                      <span style={chipStyle}>{contract.renewal_type || '확인필요'}</span>
                      <span style={chipStyle}>{contract.contract_status || '상태 미입력'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <GhostButton onClick={() => openContractModal(contract)}>수정</GhostButton>
                    <GhostButton danger onClick={() => removeContract(contract)}>삭제</GhostButton>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: COLORS.textGray, lineHeight: 1.6 }}>
                  가입일: {contract.joined_at || '-'} / 납입기간: {contract.payment_period || '-'} / 보험기간: {contract.coverage_period || '-'}
                  <br />
                  계약자: {contract.contractor || '-'} / 피보험자: {contract.insured || '-'} / 증권번호: {contract.policy_number || '-'}
                  {contract.memo && <div>메모: {contract.memo}</div>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: COLORS.text }}>담보 {contract.coverages?.length || 0}건</div>
                  <GhostButton onClick={() => openCoverageModal(contract)}>+ 담보 추가</GhostButton>
                </div>

                {(contract.coverages || []).length === 0 ? (
                  <div style={{ color: COLORS.textGray, fontSize: 12 }}>등록된 담보가 없습니다.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(contract.coverages || []).map((coverage) => (
                      <div
                        key={coverage.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: 10,
                          borderRadius: 12,
                          background: '#F8FAFC',
                        }}
                      >
                        <div style={{ minWidth: 0, fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
                          <b>{coverage.standard_coverage_categories?.name || '기타/미분류'}</b>
                          <br />
                          원문: {coverage.original_name || '-'} / 가입금액: {formatCoverageAmount(coverage.coverage_amount)}
                          <br />
                          <span style={{ color: COLORS.textGray }}>
                            보험기간: {coverage.coverage_period || '-'} / 납입기간: {coverage.payment_period || '-'} / {getRenewableLabel(coverage.is_renewable)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                          <GhostButton onClick={() => openCoverageModal(contract, coverage)}>수정</GhostButton>
                          <GhostButton danger onClick={() => removeCoverage(coverage)}>삭제</GhostButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {contractModal && (
        <Modal
          visible={true}
          onClose={() => setContractModal(null)}
          title={contractModal.id ? '현재보험 수정' : '현재보험 추가'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SelectField
              label="보험회사"
              value={companySelectValue}
              onChange={(e) => {
                const value = e.target.value;
                setContractForm((prev) => ({
                  ...prev,
                  company_mode: value,
                  insurance_company: value === '__custom__' ? '' : value,
                }));
              }}
            >
              <option value="">보험회사 선택</option>
              {companies.map((company) => (
                <option key={company.id} value={company.name}>{company.name}</option>
              ))}
              <option value="__custom__">기타/직접입력</option>
            </SelectField>

            {companySelectValue === '__custom__' && (
              <Field
                icon="🏢"
                placeholder="보험회사 직접입력"
                value={contractForm.insurance_company}
                onChange={(e) => setContractValue('insurance_company', e.target.value)}
              />
            )}

            <Field icon="📄" placeholder="상품명" value={contractForm.product_name} onChange={(e) => setContractValue('product_name', e.target.value)} />
            <Field icon="📅" placeholder="가입일" type="date" value={contractForm.joined_at} onChange={(e) => setContractValue('joined_at', e.target.value)} />
            <Field icon="💰" placeholder="월보험료(원)" type="number" value={contractForm.monthly_premium} onChange={(e) => setContractValue('monthly_premium', e.target.value)} />
            <Field icon="⏳" placeholder="납입기간 예: 20년납" value={contractForm.payment_period} onChange={(e) => setContractValue('payment_period', e.target.value)} />
            <Field icon="🗓️" placeholder="보험기간/만기 예: 100세만기" value={contractForm.coverage_period} onChange={(e) => setContractValue('coverage_period', e.target.value)} />

            <SelectField label="갱신 여부" value={contractForm.renewal_type} onChange={(e) => setContractValue('renewal_type', e.target.value)}>
              {renewalOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </SelectField>

            <SelectField label="계약상태" value={contractForm.contract_status} onChange={(e) => setContractValue('contract_status', e.target.value)}>
              {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </SelectField>

            <Field icon="👤" placeholder="계약자" value={contractForm.contractor} onChange={(e) => setContractValue('contractor', e.target.value)} />
            <Field icon="👥" placeholder="피보험자" value={contractForm.insured} onChange={(e) => setContractValue('insured', e.target.value)} />
            <Field icon="🔢" placeholder="증권번호(선택)" value={contractForm.policy_number} onChange={(e) => setContractValue('policy_number', e.target.value)} />
            <TextAreaField label="메모" placeholder="계약 관련 메모" value={contractForm.memo} onChange={(e) => setContractValue('memo', e.target.value)} />

            <PrimaryButton onClick={saveContract} disabled={saving} style={{ width: '100%', marginTop: 6 }}>
              {saving ? '저장 중...' : '저장'}
            </PrimaryButton>
          </div>
        </Modal>
      )}

      {coverageModal && (
        <Modal
          visible={true}
          onClose={() => setCoverageModal(null)}
          title={coverageModal.coverage?.id ? '담보 수정' : '담보 추가'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, fontSize: 12, color: COLORS.textGray }}>
              {coverageModal.contract.insurance_company || '보험회사 미입력'} · {coverageModal.contract.product_name || '상품명 미입력'}
            </div>

            <SelectField label="표준담보" value={coverageForm.standard_coverage_id} onChange={(e) => setCoverageValue('standard_coverage_id', e.target.value)}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} {category.aggregation_mode === 'sum' ? '(합산)' : category.aggregation_mode === 'separate' ? '(별도)' : '(확인 필요)'}
                </option>
              ))}
            </SelectField>

            <Field icon="📝" placeholder="보험사 원문 담보명" value={coverageForm.original_name} onChange={(e) => setCoverageValue('original_name', e.target.value)} />
            <Field icon="💰" placeholder="가입금액(만원)" type="number" value={coverageForm.coverage_amount_manwon} onChange={(e) => setCoverageValue('coverage_amount_manwon', e.target.value)} />
            <Field icon="🗓️" placeholder="보험기간 예: 100세만기" value={coverageForm.coverage_period} onChange={(e) => setCoverageValue('coverage_period', e.target.value)} />
            <Field icon="⏳" placeholder="납입기간 예: 20년납" value={coverageForm.payment_period} onChange={(e) => setCoverageValue('payment_period', e.target.value)} />

            <SelectField label="갱신 여부" value={coverageForm.is_renewable} onChange={(e) => setCoverageValue('is_renewable', e.target.value)}>
              <option value="">확인필요</option>
              <option value="true">갱신</option>
              <option value="false">비갱신</option>
            </SelectField>

            <TextAreaField label="지급조건/메모" placeholder="보장범위, 지급조건, 특이사항" value={coverageForm.memo} onChange={(e) => setCoverageValue('memo', e.target.value)} />

            <PrimaryButton onClick={saveCoverage} disabled={saving} style={{ width: '100%', marginTop: 6 }}>
              {saving ? '저장 중...' : '저장'}
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

const chipStyle = {
  background: COLORS.primaryBg,
  color: COLORS.primary,
  borderRadius: 999,
  padding: '4px 9px',
  fontSize: 11,
  fontWeight: 800,
};
