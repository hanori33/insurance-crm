// src/services/roleService.js
import { supabase } from '../supabaseClient';

function mapToProfileRole(role) {
  if (role === 'team_member') return 'staff';
  return 'manager';
}

const roleService = {
  request: async ({
    userName,
    requestedRole,
    organization,
    branch,
    office,
    team,
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('role_requests')
      .upsert([
        {
          user_id: user.id,
          user_email: user.email,
          user_name: userName,
          requested_role: requestedRole,
          organization,
          branch,
          office,
          team,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  getMyRequest: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from('role_requests')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) return null;

    return data;
  },

  listAll: async () => {
    const { data, error } = await supabase
      .from('role_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  },

  approve: async (
    id,
    userId,
    role,
    { organization, branch, office, team } = {}
  ) => {
    const cleanText = (value, fallback = '') =>
      String(value || fallback)
        .replace(/\s+/g, '')
        .trim();

    const cleanOrganization = cleanText(organization);
    const cleanBranch = cleanText(branch);
    const cleanOffice = cleanText(office);
    const cleanTeam = cleanText(team);

    const divisionName = cleanOrganization || '소속사업단';
    const branchName =
      cleanOffice || cleanBranch || cleanTeam || '소속지점';

    const profileRole = mapToProfileRole(role);

    let branchId = null;

    // 기존 지점 찾기
    const { data: existingBranch, error: findBranchError } = await supabase
      .from('branches')
      .select('id')
      .eq('name', branchName)
      .eq('division', divisionName)
      .maybeSingle();

    if (findBranchError) throw findBranchError;

    if (existingBranch?.id) {
      branchId = existingBranch.id;
    } else {
      // 없으면 새 지점 생성
      const { data: newBranch, error: createBranchError } = await supabase
        .from('branches')
        .insert({
          name: branchName,
          division: divisionName,
        })
        .select('id')
        .single();

      if (createBranchError) throw createBranchError;

      branchId = newBranch.id;
    }

    // user_roles 저장/수정
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert(
        [
          {
            user_id: userId,
            role,
            organization: cleanOrganization,
            branch: cleanBranch,
            office: cleanOffice,
            team: cleanTeam,
          },
        ],
        {
          onConflict: 'user_id',
        }
      );

    if (roleError) throw roleError;

    // profiles 업데이트
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: profileRole,
        branch_id: branchId,
        status: '상담중',
      })
      .eq('user_id', userId);

    if (profileError) throw profileError;

    // 신청 승인 처리
    const { error } = await supabase
      .from('role_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },

  reject: async (id) => {
    const { error } = await supabase
      .from('role_requests')
      .update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },
};

export default roleService;