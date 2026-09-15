import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AuthorizationError, jsonError, requireUser } from "../_shared/auth.ts";

const corsHeaders = {
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

class FcmTestError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "FcmTestError";
    this.code = code;
    this.status = status;
  }
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

async function getFirebaseAccessToken(serviceAccount: ServiceAccount) {
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
    const detail = await response.text();
    console.error("Firebase access token request failed:", response.status, detail);
    throw new FcmTestError(
      "FIREBASE_OAUTH_FAILED",
      "Firebase 인증에 실패했습니다.",
      502,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new FcmTestError(
      "FIREBASE_OAUTH_FAILED",
      "Firebase 인증 응답을 확인하지 못했습니다.",
      502,
    );
  }

  if (!data?.access_token) {
    throw new FcmTestError(
      "FIREBASE_OAUTH_FAILED",
      "Firebase 인증 토큰을 발급하지 못했습니다.",
      502,
    );
  }

  return data.access_token as string;
}

async function sendFcmMessage(
  serviceAccount: ServiceAccount,
  accessToken: string,
  token: string,
) {
  const notificationId = `test-${Date.now()}`;
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
            title: "보플랜",
            body: "보플랜 PC 백그라운드 알림 테스트입니다. 🔔",
          },
          data: {
            type: "system_notice",
            source: "notification-settings",
            notificationId,
            tag: "boplan-web-push-test",
            url: "/",
          },
          webpush: {
            notification: {
              icon: "/boplan192.png",
              badge: "/boplan192.png",
              tag: "boplan-web-push-test",
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

  const text = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail: text,
    };
  }

  return { ok: true, status: response.status };
}

function parseServiceAccount() {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) {
    throw new FcmTestError(
      "SERVICE_ACCOUNT_SECRET_MISSING",
      "Firebase 서버 인증 정보가 설정되지 않았습니다.",
      500,
    );
  }

  if (!raw.trim()) {
    throw new FcmTestError(
      "SERVICE_ACCOUNT_JSON_INVALID",
      "Firebase 서버 인증 정보 형식이 올바르지 않습니다.",
      500,
    );
  }

  if (raw.trimStart()[0] !== "{") {
    throw new FcmTestError(
      "SERVICE_ACCOUNT_JSON_INVALID",
      "Firebase 서버 인증 정보가 JSON 형식이 아닙니다.",
      500,
    );
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new FcmTestError(
      "SERVICE_ACCOUNT_JSON_INVALID",
      "Firebase 서버 인증 정보 JSON을 해석하지 못했습니다.",
      500,
    );
  }

  if (serviceAccount.type && serviceAccount.type !== "service_account") {
    throw new FcmTestError(
      "SERVICE_ACCOUNT_JSON_INVALID",
      "Firebase 서버 인증 정보 타입이 올바르지 않습니다.",
      500,
    );
  }

  if (serviceAccount.project_id !== "insu-real") {
    throw new FcmTestError(
      "SERVICE_ACCOUNT_PROJECT_MISMATCH",
      "Firebase 프로젝트 설정이 일치하지 않습니다.",
      500,
    );
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new FcmTestError(
      "SERVICE_ACCOUNT_JSON_INVALID",
      "Firebase 서버 인증 정보 필수 항목이 없습니다.",
      500,
    );
  }

  return serviceAccount;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "POST 요청만 지원합니다.", 405, corsHeaders);
  }

  try {
    const context = await requireUser(req);
    const serviceAccount = parseServiceAccount();

    const { data: tokens, error } = await context.adminClient
      .from("fcm_tokens")
      .select("id, token")
      .eq("user_id", context.user.id);

    if (error) throw error;

    if (!tokens?.length) {
      return jsonError(
        "FCM_TOKEN_NOT_FOUND",
        "현재 브라우저의 PC 푸시 토큰을 찾지 못했습니다. 알림 권한을 허용한 뒤 다시 시도해주세요.",
        404,
        corsHeaders,
      );
    }

    const accessToken = await getFirebaseAccessToken(serviceAccount);
    const results = await Promise.all(
      tokens.map(({ token }) => sendFcmMessage(serviceAccount, accessToken, token)),
    );

    const failed = results.filter((result) => !result.ok);

    if (failed.length === results.length) {
      console.error("FCM send failed for all tokens:", failed.map((result) => result.status));
      return jsonError(
        "FCM_SEND_FAILED",
        "Firebase 푸시 발송에 실패했습니다.",
        502,
        corsHeaders,
      );
    }

    return new Response(JSON.stringify({
      sent: results.length - failed.length,
      failed: failed.length,
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.code, error.message, error.status, corsHeaders);
    }

    if (error instanceof FcmTestError) {
      return jsonError(error.code, error.message, error.status, corsHeaders);
    }

    console.error("boplan-fcm-test failed:", error);
    return jsonError(
      "FCM_TEST_FAILED",
      error instanceof Error ? error.message : "PC 푸시 테스트 발송에 실패했습니다.",
      500,
      corsHeaders,
    );
  }
});
