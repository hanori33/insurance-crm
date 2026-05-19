// src/services/roleService.js
import { supabase } from '../supabaseClient';

const roleService = {
  // 권한 신청
  request: async ({ userName, requestedRole, organization, branch, office, team }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('role_requests')
      .upsert([{
        user_id: user.id,
        user_email: user.email,
        user_name: userName,
        requested_role: requestedRole,
        organization,
        branch,
        office,
        team,
        status: 'pending',
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 내 신청 현황
  getMyRequest: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('role_requests')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) return null;
    return data;
  },

  // 전체 신청 목록 (관리자용)
  listAll: async () => {
    const { data, error } = await supabase
      .from('role_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // 승인
  approve: async (id, userId, role, { organization, branch, office, team } = {}) => {
    // user_roles에 추가
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert([{
        user_id: userId,
        role,
        organization: organization || '',
        branch: branch || '',
        office: office || '',
        team: team || '',
      }]);

    if (roleError) throw roleError;

    // 신청 상태 업데이트
    const { error } = await supabase
      .from('role_requests')
      .update({ status: 'approved', processed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  // 거절
  reject: async (id) => {
    const { error } = await supabase
      .from('role_requests')
      .update({ status: 'rejected', processed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },
};

export default roleService;