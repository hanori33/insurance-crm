// src/services/roleService.js
import { supabase } from '../supabaseClient';

export const ADMIN_ROLES = ['admin', 'superadmin'];

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

const STANDARD_ORGANIZATION = '로얄사업단';
const ORGANIZATION_ALIASES = new Set([
  '로얄사업단',
  '로얄본부',
  '인카다이렉트로얄사업단',
]);
const STANDARD_OFFICES = new Map(
  ['배세영', '장석환', '이재원', '육심호', '김단비'].map((name) => [
    `${name}지점`,
    `${name} 지점`,
  ])
);

function normalizeText(value, fallback = '') {
  return String(value || fallback)
    .trim()
    .replace(/\s+/g, ' ');
}

function withoutSpaces(value) {
  return normalizeText(value).replace(/\s/g, '');
}

function normalizeOrganization(value) {
  const normalized = normalizeText(value);
  return ORGANIZATION_ALIASES.has(withoutSpaces(normalized))
    ? STANDARD_ORGANIZATION
    : normalized;
}

function normalizeOffice(value) {
  const normalized = normalizeText(value);
  return STANDARD_OFFICES.get(withoutSpaces(normalized)) || normalized;
}

function getStandardOffice(value) {
  return STANDARD_OFFICES.get(withoutSpaces(value)) || '';
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

function mapToProfileRole(role) {
  if (role === 'team_member') return 'staff';
  return 'manager';
}

const ROLE_NAMES = {
  division_head: '사업단장',
  branch_head: '본부장',
  deputy_branch_head: '부본부장',
  office_head: '지점장',
  deputy_office_head: '부지점장',
  team_leader: '팀장',
  team_member: '팀원',
};

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

    const normalizedOrganization = normalizeOrganization(organization);
    const normalizedCompanyName = normalizeText(companyName);
    const normalizedOffice = normalizeOffice(office) || getStandardOffice(branch);
    const normalizedBranch = normalizedOffice ? '' : normalizeText(branch);
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

 approve: async (
  id,
  userId,
  role,
  { userName, organization, branch, office, team } = {}
) => {
    await assertAdmin();
    // TODO: Move approval to a SECURITY DEFINER RPC and enforce admin/superadmin in DB RLS.
    const cleanOrganization = normalizeOrganization(organization);
    const cleanOffice = normalizeOffice(office) || getStandardOffice(branch);
    const cleanBranch = cleanOffice ? '' : normalizeText(branch);
    const cleanTeam = normalizeText(team);

    const divisionName = cleanOrganization || '소속사업단';
    const branchName = normalizeOffice(
      cleanOffice || cleanBranch || cleanTeam || '소속지점'
    );

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

    // 부모 조직 자동 연결
let parentUserId = null;
let roleName = ROLE_NAMES[role] || '팀원';

if (role === 'team_member') {
  roleName = '팀원';

  if (cleanTeam.includes('박하늘')) {
    parentUserId = '51490728-b57d-4154-8aee-87a03d004760';
  } else if (cleanTeam.includes('배세영')) {
    parentUserId = '5726df75-011c-4944-9266-09f60250a816';
  }
}

// 기존 프로필 조회
const { data: existingProfile } = await supabase
  .from('profiles')
  .select('id')
  .eq('user_id', userId)
  .maybeSingle();

let profileError = null;

if (existingProfile) {
  const { error } = await supabase
    .from('profiles')
    .update({
  name: userName,
  role: profileRole,
  role_name: roleName,
  parent_user_id: parentUserId,
  branch_id: branchId,
  status: '상담중',
})
    .eq('user_id', userId);

  profileError = error;
} else {
  const { error } = await supabase
    .from('profiles')
    .insert({
  user_id: userId,
  name: userName,
  role: profileRole,
  role_name: roleName,
  parent_user_id: parentUserId,
  branch_id: branchId,
  status: '상담중',
});

  profileError = error;
}

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
