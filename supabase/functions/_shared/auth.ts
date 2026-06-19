import {
  createClient,
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";

export type AuthContext = {
  user: User;
  adminClient: SupabaseClient;
};

export class AuthorizationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.status = status;
  }
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function requireUser(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw new AuthorizationError("AUTH_REQUIRED", "로그인이 필요합니다.", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new AuthorizationError(
      "AUTH_CONFIGURATION_ERROR",
      "인증 설정을 확인할 수 없습니다.",
      500,
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);

  if (error || !user) {
    throw new AuthorizationError(
      "INVALID_AUTH_TOKEN",
      "로그인이 만료되었습니다. 다시 로그인해주세요.",
      401,
    );
  }

  return { user, adminClient };
}

export async function requireProEntitlement(context: AuthContext) {
  const { data: profile, error } = await context.adminClient
    .from("profiles")
    .select("pro_plan, pro_expire_at, trial_used, pro_trial_start, pro_trial_end")
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load PRO entitlement:", error);
    throw new AuthorizationError(
      "ENTITLEMENT_CHECK_FAILED",
      "이용 권한을 확인하지 못했습니다.",
      500,
    );
  }

  if (!profile) {
    throw new AuthorizationError(
      "PROFILE_REQUIRED",
      "사용자 프로필을 찾을 수 없습니다.",
      403,
    );
  }

  const now = Date.now();
  const proExpiresAt = profile.pro_expire_at
    ? new Date(profile.pro_expire_at).getTime()
    : null;
  const trialStartsAt = profile.pro_trial_start
    ? new Date(profile.pro_trial_start).getTime()
    : null;
  const trialEndsAt = profile.pro_trial_end
    ? new Date(profile.pro_trial_end).getTime()
    : null;

  const hasActivePro =
    profile.pro_plan === true &&
    (proExpiresAt === null || (Number.isFinite(proExpiresAt) && proExpiresAt > now));
  const hasActiveTrial =
    profile.trial_used === true &&
    trialStartsAt !== null &&
    trialEndsAt !== null &&
    Number.isFinite(trialStartsAt) &&
    Number.isFinite(trialEndsAt) &&
    trialStartsAt <= now &&
    trialEndsAt > now;

  if (!hasActivePro && !hasActiveTrial) {
    throw new AuthorizationError(
      "PRO_REQUIRED",
      "PRO 구독 또는 무료체험 이용 권한이 필요합니다.",
      403,
    );
  }

  return {
    type: hasActivePro ? "pro" : "trial",
    profile,
  } as const;
}

export async function requireRole(
  context: AuthContext,
  allowedRoles: string[],
) {
  const [{ data: profile, error: profileError }, { data: userRole, error: roleError }] =
    await Promise.all([
      context.adminClient
        .from("profiles")
        .select("role")
        .eq("user_id", context.user.id)
        .maybeSingle(),
      context.adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", context.user.id)
        .maybeSingle(),
    ]);

  if (profileError || roleError) {
    console.error("Failed to load user role:", profileError || roleError);
    throw new AuthorizationError(
      "ROLE_CHECK_FAILED",
      "사용자 권한을 확인하지 못했습니다.",
      500,
    );
  }

  const roles = [profile?.role, userRole?.role].filter(Boolean);
  const matchedRole = roles.find((role) => allowedRoles.includes(role));

  if (!matchedRole) {
    throw new AuthorizationError(
      "ROLE_REQUIRED",
      "이 기능을 사용할 권한이 없습니다.",
      403,
    );
  }

  return matchedRole;
}
