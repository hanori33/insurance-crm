import { supabase } from '../supabaseClient';

function mapOrganizationError(error, fallbackMessage) {
  if (!error) return null;

  const message = String(error.message || '');

  if (message.includes('AUTH_REQUIRED')) {
    return new Error('로그인이 필요합니다. 다시 로그인 후 이용해주세요.');
  }
  if (message.includes('SUPERADMIN_REQUIRED')) {
    return new Error('최고관리자 권한이 필요합니다.');
  }
  if (message.includes('SUPERADMIN_REQUIRED_FOR_ROOT_ORG')) {
    return new Error('최상위 회사 조직은 최고관리자만 생성할 수 있습니다.');
  }
  if (message.includes('ORGANIZATION_ALREADY_EXISTS')) {
    return new Error('이미 등록된 회사가 있습니다. 기존 회사를 선택해주세요.');
  }
  if (message.includes('ORGANIZATION_NAME_REQUIRED')) {
    return new Error('회사명을 입력해주세요.');
  }
  if (message.includes('ORG_UNIT_MANAGE_REQUIRED')) {
    return new Error('해당 조직을 관리할 권한이 필요합니다.');
  }
  if (message.includes('ORGANIZATION_REQUEST_ALREADY_REVIEWED')) {
    return new Error('이미 처리된 회사 등록 요청입니다.');
  }
  if (message.includes('ORGANIZATION_REQUEST_NOT_FOUND')) {
    return new Error('회사 등록 요청을 찾을 수 없습니다.');
  }

  return new Error(error.message || fallbackMessage);
}

async function callRpc(name, params, fallbackMessage) {
  const { data, error } = await supabase.rpc(name, params);
  const mappedError = mapOrganizationError(error, fallbackMessage);
  if (mappedError) throw mappedError;
  return data;
}

const organizationService = {
  searchCompanies: async (query) => {
    return (
      (await callRpc(
        'search_company_roots',
        { p_query: query || '' },
        '회사를 검색하지 못했습니다.'
      )) || []
    );
  },

  listCompanyOrganizations: async (rootOrgUnitId, query = '') => {
    if (!rootOrgUnitId) return [];

    return (
      (await callRpc(
        'list_company_organization_units',
        {
          p_root_org_unit_id: rootOrgUnitId,
          p_query: query || '',
        },
        '회사 조직을 불러오지 못했습니다.'
      )) || []
    );
  },

  requestRegistration: async ({
    requestedName,
    businessRegistrationNumber = '',
    representativeName = '',
    contactEmail = '',
  }) => {
    return callRpc(
      'request_organization_registration',
      {
        p_requested_name: requestedName,
        p_business_registration_number: businessRegistrationNumber,
        p_representative_name: representativeName,
        p_contact_email: contactEmail,
      },
      '회사 등록 요청에 실패했습니다.'
    );
  },

  listMyRegistrationRequests: async () => {
    return (
      (await callRpc(
        'list_my_organization_registration_requests',
        {},
        '내 회사 등록 요청을 불러오지 못했습니다.'
      )) || []
    );
  },

  listRegistrationRequests: async (status = 'pending') => {
    return (
      (await callRpc(
        'list_organization_registration_requests',
        { p_status: status },
        '회사 등록 요청 목록을 불러오지 못했습니다.'
      )) || []
    );
  },

  approveRegistrationRequest: async (requestId) => {
    const result = await callRpc(
      'approve_organization_registration_request',
      { p_request_id: requestId },
      '회사 등록 요청 승인에 실패했습니다.'
    );

    return Array.isArray(result) ? result[0] : result;
  },

  rejectRegistrationRequest: async (requestId, rejectionReason = '') => {
    return callRpc(
      'reject_organization_registration_request',
      {
        p_request_id: requestId,
        p_rejection_reason: rejectionReason,
      },
      '회사 등록 요청 거절에 실패했습니다.'
    );
  },
};

export default organizationService;
