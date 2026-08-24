import { supabase } from '../supabaseClient';

const UNCATEGORIZED_CODE = 'uncategorized';

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeText(value) {
  return String(value || '').trim();
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error('로그인이 만료되었습니다. 다시 로그인 후 이용해주세요.');
  return data.user.id;
}

function normalizeContractPayload(payload) {
  return {
    insurance_company: normalizeText(payload.insurance_company),
    product_name: normalizeText(payload.product_name),
    joined_at: payload.joined_at || null,
    monthly_premium: toNumberOrNull(payload.monthly_premium),
    payment_period: normalizeText(payload.payment_period),
    coverage_period: normalizeText(payload.coverage_period),
    renewal_type: normalizeText(payload.renewal_type) || '확인필요',
    contract_status: normalizeText(payload.contract_status) || '유지중',
    contractor: normalizeText(payload.contractor),
    insured: normalizeText(payload.insured),
    policy_number: normalizeText(payload.policy_number) || null,
    memo: normalizeText(payload.memo) || null,
  };
}

function normalizeCoveragePayload(payload) {
  return {
    standard_coverage_id: payload.standard_coverage_id || null,
    original_name: normalizeText(payload.original_name),
    coverage_amount: toNumberOrNull(payload.coverage_amount),
    coverage_period: normalizeText(payload.coverage_period),
    payment_period: normalizeText(payload.payment_period),
    is_renewable: typeof payload.is_renewable === 'boolean' ? payload.is_renewable : null,
    memo: normalizeText(payload.memo) || null,
  };
}

function getCoverageCategory(coverage) {
  return coverage.standard_coverage_categories || coverage.category || null;
}

function getCoverageGroupKey(coverage) {
  const category = getCoverageCategory(coverage);
  if (category?.id) return `standard:${category.id}`;
  return `uncategorized:${normalizeText(coverage.original_name) || coverage.id}`;
}

function getCoverageLabel(coverage) {
  const category = getCoverageCategory(coverage);
  if (category?.name) return category.name;
  return normalizeText(coverage.original_name) || '기타/미분류';
}

function getAggregationMode(coverage) {
  const category = getCoverageCategory(coverage);
  return category?.aggregation_mode || 'review_required';
}

function getStatusLabel(mode) {
  if (mode === 'sum') return '합산';
  if (mode === 'separate') return '별도';
  return '확인 필요';
}

const customerInsuranceService = {
  async listMasterData() {
    const [categoriesResult, companiesResult] = await Promise.all([
      supabase
        .from('standard_coverage_categories')
        .select('id, code, name, group_name, aggregation_mode, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('insurance_company_options')
        .select('id, name, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (companiesResult.error) throw companiesResult.error;

    return {
      categories: categoriesResult.data || [],
      companies: companiesResult.data || [],
    };
  },

  async listContracts(customerId) {
    if (!customerId) return [];

    const { data, error } = await supabase
      .from('customer_insurance_contracts')
      .select(`
        *,
        coverages:customer_insurance_coverages (
          *,
          standard_coverage_categories (
            id,
            code,
            name,
            group_name,
            aggregation_mode
          )
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((contract) => ({
      ...contract,
      coverages: [...(contract.coverages || [])].sort(
        (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
      ),
    }));
  },

  async createContract(customerId, payload) {
    const userId = await getCurrentUserId();
    const nextPayload = normalizeContractPayload(payload);

    const { data, error } = await supabase
      .from('customer_insurance_contracts')
      .insert({
        ...nextPayload,
        user_id: userId,
        customer_id: customerId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateContract(contractId, payload) {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('customer_insurance_contracts')
      .update(normalizeContractPayload(payload))
      .eq('id', contractId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeContract(contractId) {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('customer_insurance_contracts')
      .delete()
      .eq('id', contractId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async createCoverage(customerId, contractId, payload) {
    const userId = await getCurrentUserId();
    const nextPayload = normalizeCoveragePayload(payload);

    const { data, error } = await supabase
      .from('customer_insurance_coverages')
      .insert({
        ...nextPayload,
        user_id: userId,
        customer_id: customerId,
        contract_id: contractId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCoverage(coverageId, payload) {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('customer_insurance_coverages')
      .update(normalizeCoveragePayload(payload))
      .eq('id', coverageId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeCoverage(coverageId) {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('customer_insurance_coverages')
      .delete()
      .eq('id', coverageId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  calculateCoverageSummary(contracts) {
    const grouped = new Map();

    (contracts || []).forEach((contract) => {
      (contract.coverages || []).forEach((coverage) => {
        const key = getCoverageGroupKey(coverage);
        const category = getCoverageCategory(coverage);
        const mode = getAggregationMode(coverage);

        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            name: getCoverageLabel(coverage),
            groupName: category?.group_name || '기타',
            aggregationMode: mode,
            statusLabel: getStatusLabel(mode),
            totalAmount: 0,
            contractIds: new Set(),
            details: [],
          });
        }

        const item = grouped.get(key);
        item.contractIds.add(contract.id);

        if (Number.isFinite(Number(coverage.coverage_amount))) {
          item.totalAmount += Number(coverage.coverage_amount);
        }

        item.details.push({
          id: coverage.id,
          insuranceCompany: contract.insurance_company || '보험사 미입력',
          productName: contract.product_name || '상품명 미입력',
          originalName: coverage.original_name || item.name,
          amount: coverage.coverage_amount,
          coveragePeriod: coverage.coverage_period,
          paymentPeriod: coverage.payment_period,
          isRenewable: coverage.is_renewable,
          memo: coverage.memo,
        });
      });
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        contractCount: item.contractIds.size,
        contractIds: undefined,
      }))
      .sort((a, b) => {
        if (a.statusLabel !== b.statusLabel) return a.statusLabel.localeCompare(b.statusLabel, 'ko');
        return a.name.localeCompare(b.name, 'ko');
      });
  },

  getUncategorizedCategory(categories) {
    return (categories || []).find((category) => category.code === UNCATEGORIZED_CODE) || null;
  },
};

export default customerInsuranceService;
