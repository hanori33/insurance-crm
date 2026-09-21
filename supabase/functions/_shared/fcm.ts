import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ServiceAccount = {
  type?: string;
  client_email: string;
  private_key: string;
  project_id: string;
};

export class PushError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "PushError";
    this.code = code;
    this.status = status;
  }
}

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function jsonError(code: string, message: string, status = 500) {
  return jsonResponse({ code, error: message }, status);
}

export function requireServiceRole(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw new PushError("AUTH_REQUIRED", "서버 알림 실행 권한이 필요합니다.", 401);
  }

  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));

    if (decoded?.role === "service_role") return;
  } catch {
    // fall through to a generic auth error without exposing token details
  }

  throw new PushError("AUTH_REQUIRED", "서버 알림 실행 권한이 필요합니다.", 401);
}

export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new PushError("SUPABASE_CONFIG_MISSING", "Supabase 서버 설정이 필요합니다.", 500);
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function base64Url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export function parseServiceAccount() {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

  if (!raw) {
    throw new PushError("SERVICE_ACCOUNT_SECRET_MISSING", "Firebase 서버 인증 정보가 설정되지 않았습니다.", 500);
  }

  if (raw.trimStart()[0] !== "{") {
    throw new PushError("SERVICE_ACCOUNT_JSON_INVALID", "Firebase 서버 인증 정보가 JSON 형식이 아닙니다.", 500);
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new PushError("SERVICE_ACCOUNT_JSON_INVALID", "Firebase 서버 인증 정보 JSON을 해석하지 못했습니다.", 500);
  }

  if (serviceAccount.type && serviceAccount.type !== "service_account") {
    throw new PushError("SERVICE_ACCOUNT_JSON_INVALID", "Firebase 서버 인증 정보 타입이 올바르지 않습니다.", 500);
  }

  if (serviceAccount.project_id !== "insu-real") {
    throw new PushError("SERVICE_ACCOUNT_PROJECT_MISMATCH", "Firebase 프로젝트 설정이 일치하지 않습니다.", 500);
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new PushError("SERVICE_ACCOUNT_JSON_INVALID", "Firebase 서버 인증 정보 필수 항목이 없습니다.", 500);
  }

  return serviceAccount;
}

export async function getFirebaseAccessToken(serviceAccount: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${base64Url(signature)}`,
    }),
  });

  if (!response.ok) {
    await response.text();
    throw new PushError("FIREBASE_OAUTH_FAILED", "Firebase 인증에 실패했습니다.", 502);
  }

  const data = await response.json().catch(() => null);

  if (!data?.access_token) {
    throw new PushError("FIREBASE_OAUTH_FAILED", "Firebase 인증 토큰을 발급하지 못했습니다.", 502);
  }

  return data.access_token as string;
}

export type PushPayload = {
  title: string;
  body: string;
  tag: string;
  data: Record<string, string>;
};

export async function sendFcmMessage(
  serviceAccount: ServiceAccount,
  accessToken: string,
  token: string,
  payload: PushPayload,
) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data,
          webpush: {
            notification: {
              icon: "/boplan192.png",
              badge: "/boplan192.png",
              tag: payload.tag,
              requireInteraction: false,
            },
            fcm_options: {
              link: "https://www.boplan.kr/",
            },
          },
        },
      }),
    },
  );

  const detail = await response.text();
  let errorCode = "";

  if (!response.ok) {
    try {
      const payload = JSON.parse(detail);
      errorCode = payload?.error?.status || payload?.error?.details?.[0]?.errorCode || "";
    } catch {
      errorCode = "";
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    errorCode,
  };
}

export function kstDateParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter.format(now).split("-").map(Number);

  return {
    year,
    month,
    day,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    mmdd: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}
