// src/services/roleService.js
import { supabase } from '../supabaseClient';

export const ADMIN_ROLES = ['admin', 'superadmin'];

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function normalizeText(value, fallback = '') {
  return String(value || fallback)
    .trim()
    .replace(/\s+/g, ' ');
}

async function getCurrentRole() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const [{ data: userRole, error: userRoleError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle(),
    ]);

  if (userRoleError) throw userRoleError;
  if (profileError) throw profileError;

  const roles = [userRole?.role, profile?.role].filter(Boolean);
  return roles.find(isAdminRole) || roles[0] || 'agent';
}

async function assertAdmin() {
  const role = await getCurrentRole();
  if (!isAdminRole(role)) throw new Error('관리자 권한이 필요합니다.');
  return role;
}

const roleService = {
  getCurrentRole,
  isAdmin: async () => isAdminRole(await getCurrentRole()),
  assertAdmin,
  request: async ({
    userName,
    requestedRole,
    companyName,
    organization,
    branch,
    office,
    team,
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('로그인이 필요합니다.');

    const normalizedCompanyName = normalizeText(companyName);
    const normalizedOrganization = normalizeText(organization);
    const normalizedBranch = normalizeText(branch);
    const normalizedOffice = normalizeText(office);
    const normalizedTeam = normalizeText(team);

    const { data, error } = await supabase
      .from('role_requests')
      .upsert([
        {
          user_id: user.id,
          user_email: user.email,
          user_name: userName,
          requested_role: requestedRole,
          company_name: normalizedCompanyName,
          organization: normalizedOrganization,
          branch: normalizedBranch,
          office: normalizedOffice,
          team: normalizedTeam,
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
    await assertAdmin();
    // TODO: Enforce admin/superadmin access with Supabase RLS or a dedicated RPC.
    const { data, error } = await supabase
      .from('role_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  },

 approve: async (id) => {
    await assertAdmin();
    const { error } = await supabase.rpc('approve_role_request', {
      p_request_id: id,
    });

    if (error) throw error;
  },

  reject: async (id) => {
    await assertAdmin();
    // TODO: Move rejection to a SECURITY DEFINER RPC and enforce admin/superadmin in DB RLS.
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
