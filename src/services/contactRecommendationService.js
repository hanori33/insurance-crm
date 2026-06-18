import { supabase } from '../supabaseClient';
import customerService from './customerService';
import consultationService from './consultationService';

const REMODELING_KEYWORDS = [
  '부족',
  '공백',
  '미흡',
  '취약',
  '갱신',
  '보험료',
  '암',
  '유사암',
  '뇌',
  '심장',
  '심혈관',
  '뇌혈관',
  '수술비',
  '간병',
  '실손',
];

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from, to = new Date()) {
  if (!from) return null;

  const a = startOfDay(new Date(from));
  const b = startOfDay(to);

  if (Number.isNaN(a.getTime())) return null;

  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateValue) {
  if (!dateValue) return null;

  const target = startOfDay(new Date(dateValue));
  const today = startOfDay();

  if (Number.isNaN(target.getTime())) return null;

  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function getCustomerId(customer) {
  return String(customer.db_id || customer.id || customer.app_customer_id || '');
}

function getBirthDaysUntil(customer) {
  const raw = String(customer.birth || customer.ssn || '').trim();
  if (!raw) return null;

  let month;
  let day;

  const iso = raw.match(/\d{4}[-./](\d{2})[-./](\d{2})/);
  const front6 = raw.match(/^(\d{2})(\d{2})(\d{2})/);

  if (iso) {
    month = Number(iso[1]);
    day = Number(iso[2]);
  } else if (front6) {
    month = Number(front6[2]);
    day = Number(front6[3]);
  } else {
    return null;
  }

  const today = startOfDay();
  let next = new Date(today.getFullYear(), month - 1, day);

  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }

  return daysUntil(next);
}

function latestDate(items, fieldNames) {
  const dates = items
    .flatMap((item) => fieldNames.map((field) => item[field]))
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a);

  return dates[0] || null;
}

function hasUpcomingSchedule(schedules, customer) {
  const customerName = String(customer.name || '');
  const customerId = getCustomerId(customer);

  return schedules.some((schedule) => {
    const scheduleDate = new Date(schedule.scheduled_at);
    if (Number.isNaN(scheduleDate.getTime())) return false;
    if (scheduleDate < new Date()) return false;

    return (
      String(schedule.customer_name || '') === customerName ||
      String(schedule.customer_id || '') === customerId
    );
  });
}

function getCustomerStatus(customer) {
  return String(customer.status || '');
}

function stringifyAnalysisResult(result) {
  if (!result) return '';

  if (typeof result === 'string') return result;

  if (Array.isArray(result)) {
    return result.map(stringifyAnalysisResult).join(' ');
  }

  if (typeof result === 'object') {
    return Object.values(result).map(stringifyAnalysisResult).join(' ');
  }

  return String(result);
}

function getPolicyAnalysisSignal(policyFiles) {
  const analyzedFiles = (policyFiles || []).filter((file) => file.analysis_result);

  if (analyzedFiles.length === 0) {
    return {
      hasAnalysis: false,
      score: 0,
      reasons: [],
      matchedKeywords: [],
    };
  }

  const analysisText = analyzedFiles
    .map((file) => stringifyAnalysisResult(file.analysis_result))
    .join(' ')
    .toLowerCase();

  const matchedKeywords = REMODELING_KEYWORDS.filter((keyword) =>
    analysisText.includes(keyword.toLowerCase())
  );

  if (matchedKeywords.length === 0) {
    return {
      hasAnalysis: true,
      score: 10,
      reasons: ['🛡️ 보장 점검 추천'],
      matchedKeywords: [],
    };
  }

  const hasGapSignal = matchedKeywords.some((keyword) =>
    ['부족', '공백', '미흡', '취약'].includes(keyword)
  );
  const hasPremiumSignal = matchedKeywords.some((keyword) =>
    ['갱신', '보험료'].includes(keyword)
  );
  const hasCoverageSignal = matchedKeywords.some((keyword) =>
    [
      '암',
      '유사암',
      '뇌',
      '심장',
      '심혈관',
      '뇌혈관',
      '수술비',
      '간병',
      '실손',
    ].includes(keyword)
  );

  const reasons = ['💰 리모델링 가능성'];

  if (hasGapSignal) reasons.push('🧩 보장 공백 발견');
  if (hasCoverageSignal) reasons.push('🛡️ 보장 점검 추천');
  if (hasPremiumSignal) reasons.push('💰 보험료/갱신 점검 필요');

  return {
    hasAnalysis: true,
    score: Math.min(45, 20 + matchedKeywords.length * 5),
    reasons,
    matchedKeywords,
  };
}

function scoreCustomer({ customer, consultations, schedules, sales, policyFiles }) {
  let score = 0;
  const reasons = [];

  const customerId = getCustomerId(customer);
  const customerName = String(customer.name || '');

  const customerConsultations = consultations.filter((item) => {
    return (
      String(item.customer_id || '') === customerId ||
      String(item.customer_name || '') === customerName
    );
  });

  const customerSales = sales.filter((item) => {
    return (
      String(item.customer_id || '') === customerId ||
      String(item.customer_name || '') === customerName
    );
  });

  const customerPolicyFiles = policyFiles.filter(
    (file) => String(file.customer_id || '') === customerId
  );

  const policyAnalysisSignal = getPolicyAnalysisSignal(customerPolicyFiles);

  if (policyAnalysisSignal.score > 0) {
    score += policyAnalysisSignal.score;
    reasons.push(...policyAnalysisSignal.reasons);
  }

  const lastConsultedAt = latestDate(customerConsultations, [
    'consulted_at',
    'created_at',
    'updated_at',
  ]);

  const daysSinceConsultation = daysBetween(lastConsultedAt);

  if (daysSinceConsultation === null) {
    score += 15;
    reasons.push('상담 기록 없음');
  } else if (daysSinceConsultation >= 180) {
    score += 50;
    reasons.push(`최근 ${daysSinceConsultation}일간 미접촉`);
  } else if (daysSinceConsultation >= 90) {
    score += 35;
    reasons.push(`최근 ${daysSinceConsultation}일간 미접촉`);
  } else if (daysSinceConsultation >= 60) {
    score += 25;
    reasons.push(`최근 ${daysSinceConsultation}일간 미접촉`);
  } else if (daysSinceConsultation >= 30) {
    score += 15;
    reasons.push(`최근 ${daysSinceConsultation}일간 미접촉`);
  }

  const birthDays = getBirthDaysUntil(customer);
  if (birthDays !== null && birthDays <= 7) {
    score += 15;
    reasons.push(birthDays === 0 ? '오늘 생일' : `생일 ${birthDays}일 남음`);
  }

  const carDays = daysUntil(customer.car_expiry);
  if (carDays !== null && carDays >= 0) {
    if (carDays <= 7) {
      score += 90;
      reasons.push(`자동차보험 만기 ${carDays}일 남음`);
    } else if (carDays <= 15) {
      score += 70;
      reasons.push(`자동차보험 만기 ${carDays}일 남음`);
    } else if (carDays <= 30) {
      score += 50;
      reasons.push(`자동차보험 만기 ${carDays}일 남음`);
    }
  }

  const expiringSale = customerSales.find((sale) => {
    const d = daysUntil(sale.expiry_date);
    return d !== null && d >= 0 && d <= 30;
  });

  if (expiringSale) {
    const d = daysUntil(expiringSale.expiry_date);
    if (d <= 7) {
      score += 95;
    } else if (d <= 15) {
      score += 80;
    } else {
      score += 60;
    }
    reasons.push(`보험 만기 ${d}일 남음`);
  }

  const hasNextAction = customerConsultations.some((item) =>
    String(item.next_action || '').trim()
  );

  if (hasNextAction && daysSinceConsultation !== null && daysSinceConsultation >= 7) {
    score += 20;
    reasons.push('이전 상담의 후속 액션 확인 시점');
  }

  const status = getCustomerStatus(customer);

  if (
    (status.includes('계약') || status.includes('유지') || customerSales.length > 0) &&
    (daysSinceConsultation === null || daysSinceConsultation >= 60)
  ) {
    score += 25;
    reasons.push('보장 점검 추천');
  }

  if (
    (status.includes('가망') || status.includes('상담')) &&
    (daysSinceConsultation === null || daysSinceConsultation >= 14)
  ) {
    score += 20;
    reasons.push('상담 후속 연락 추천');
  }

  if (hasUpcomingSchedule(schedules, customer)) {
    score -= 15;
    reasons.push('이미 예정된 일정 있음');
  }

  const normalizedScore = Math.max(0, Math.min(100, score));

  let recommendedAction = '안부 연락';

  if (policyAnalysisSignal.matchedKeywords.length > 0) {
    recommendedAction = '리모델링 점검';
  } else if (carDays !== null && carDays >= 0 && carDays <= 30) {
    recommendedAction = '자동차보험 만기 안내';
  } else if (expiringSale) {
    recommendedAction = '계약 만기 점검';
  } else if (status.includes('계약') || status.includes('유지') || customerSales.length > 0) {
    recommendedAction = '보장 점검 연락';
  } else if (status.includes('가망') || status.includes('상담')) {
    recommendedAction = '상담 후속 연락';
  } else if (birthDays !== null && birthDays <= 7) {
    recommendedAction = '생일 축하 연락';
  }

  return {
    customer,
    score: normalizedScore,
    reasons: reasons.slice(0, 3),
    recommendedAction,
    nextContactDate: new Date().toISOString().slice(0, 10),
    remodelingKeywords: policyAnalysisSignal.matchedKeywords,
  };
}

const contactRecommendationService = {
  async list(limit = 5) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const [
      customers,
      consultations,
      schedulesResult,
      salesResult,
      policyFilesResult,
    ] = await Promise.all([
      customerService.list({ status: '전체', search: '' }).catch(() =>
        customerService.list({ status: '?꾩껜', search: '' })
      ),
      consultationService.list(),
      supabase
        .from('schedules')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('sales')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('policy_files')
        .select('id, customer_id, file_name, analysis_result, analyzed_at, created_at')
        .not('analysis_result', 'is', null),
    ]);

    if (schedulesResult.error) throw schedulesResult.error;
    if (salesResult.error) throw salesResult.error;
    if (policyFilesResult.error) throw policyFilesResult.error;

    const schedules = schedulesResult.data || [];
    const sales = salesResult.data || [];
    const policyFiles = policyFilesResult.data || [];

    const filteredCustomers = (customers || []).filter((customer) => {
      if (!customer.created_at) return true;

      const createdAt = new Date(customer.created_at);
      const daysFromCreated = daysBetween(createdAt);

      return daysFromCreated === null || daysFromCreated >= 30;
    });

    return filteredCustomers
      .map((customer) =>
        scoreCustomer({
          customer,
          consultations: consultations || [],
          schedules,
          sales,
          policyFiles,
        })
      )
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
};

export default contactRecommendationService;
