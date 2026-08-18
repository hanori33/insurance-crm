import { supabase } from '../supabaseClient';

function unwrapRpcError(error, fallbackMessage) {
  if (!error) return null;

  const message = String(error.message || '');

  if (message.includes('AUTH_REQUIRED')) {
    return new Error('로그인이 필요합니다. 다시 로그인 후 이용해주세요.');
  }
  if (message.includes('INVITE_CODE_REQUIRED')) {
    return new Error('초대코드를 입력해주세요.');
  }
  if (message.includes('INVITE_CODE_NOT_FOUND')) {
    return new Error('유효하지 않은 초대코드입니다.');
  }
  if (message.includes('INVITE_CODE_EXPIRED')) {
    return new Error('만료된 초대코드입니다.');
  }
  if (message.includes('INVITE_CODE_MAX_USES_REACHED')) {
    return new Error('사용 가능 횟수를 초과한 초대코드입니다.');
  }
  if (message.includes('ORG_UNIT_INACTIVE')) {
    return new Error('현재 사용할 수 없는 조직 초대코드입니다.');
  }
  if (message.includes('ORG_UNIT_MANAGE_REQUIRED')) {
    return new Error('해당 조직을 관리할 권한이 필요합니다.');
  }
  if (message.includes('TARGET_ORG_UNIT_MANAGE_REQUIRED')) {
    return new Error('이동할 대상 조직을 관리할 권한이 필요합니다.');
  }
  if (message.includes('MANAGER_ROLE_REQUIRES_APPROVAL')) {
    return new Error('관리자급 권한은 초대코드만으로 부여할 수 없습니다.');
  }

  return new Error(error.message || fallbackMessage);
}

const inviteService = {
  listManagedOrganizationUnits: async () => {
    const { data, error } = await supabase.rpc('list_managed_organization_units');

    const mappedError = unwrapRpcError(error, '관리 가능한 조직을 불러오지 못했습니다.');
    if (mappedError) throw mappedError;

    return data || [];
  },

  listInviteCodes: async (orgUnitId = null) => {
    const { data, error } = await supabase.rpc('list_invite_codes', {
      p_org_unit_id: orgUnitId,
    });

    const mappedError = unwrapRpcError(error, '초대코드 목록을 불러오지 못했습니다.');
    if (mappedError) throw mappedError;

    return data || [];
  },

  createOrganizationUnit: async ({ parentId = null, name, displayType = null }) => {
    const { data, error } = await supabase.rpc('create_organization_unit', {
      p_parent_id: parentId,
      p_name: name,
      p_display_type: displayType,
    });

    const mappedError = unwrapRpcError(error, '조직을 생성하지 못했습니다.');
    if (mappedError) throw mappedError;

    return data;
  },

  updateOrganizationUnit: async ({ orgUnitId, name, displayType, isActive }) => {
    const { data, error } = await supabase.rpc('update_organization_unit', {
      p_org_unit_id: orgUnitId,
      p_name: name,
      p_display_type: displayType,
      p_is_active: isActive,
    });

    const mappedError = unwrapRpcError(error, '조직 정보를 수정하지 못했습니다.');
    if (mappedError) throw mappedError;

    return data;
  },

  moveOrganizationUnit: async ({ orgUnitId, newParentId = null }) => {
    const { data, error } = await supabase.rpc('move_organization_unit', {
      p_org_unit_id: orgUnitId,
      p_new_parent_id: newParentId,
    });

    const mappedError = unwrapRpcError(error, '조직을 이동하지 못했습니다.');
    if (mappedError) throw mappedError;

    return data;
  },

  createInviteCode: async ({
    orgUnitId,
    targetRole = 'team_member',
    expiresAt = null,
    maxUses = null,
  }) => {
    const { data, error } = await supabase.rpc('create_invite_code', {
      p_org_unit_id: orgUnitId,
      p_target_role: targetRole,
      p_expires_at: expiresAt,
      p_max_uses: maxUses,
    });

    const mappedError = unwrapRpcError(error, '초대코드를 생성하지 못했습니다.');
    if (mappedError) throw mappedError;

    return Array.isArray(data) ? data[0] : data;
  },

  acceptInviteCode: async (code) => {
    const { data, error } = await supabase.rpc('accept_invite_code', {
      p_code: code,
    });

    const mappedError = unwrapRpcError(error, '초대코드 가입에 실패했습니다.');
    if (mappedError) throw mappedError;

    return Array.isArray(data) ? data[0] : data;
  },

  deactivateInviteCode: async (inviteId) => {
    const { data, error } = await supabase.rpc('deactivate_invite_code', {
      p_invite_id: inviteId,
    });

    const mappedError = unwrapRpcError(error, '초대코드를 비활성화하지 못했습니다.');
    if (mappedError) throw mappedError;

    return Array.isArray(data) ? data[0] : data;
  },
};

export default inviteService;
