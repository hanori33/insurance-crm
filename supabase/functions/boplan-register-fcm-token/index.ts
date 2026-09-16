import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AuthorizationError, jsonError, requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class RegisterFcmTokenError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "RegisterFcmTokenError";
    this.code = code;
    this.status = status;
  }
}

async function readRequestBody(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new RegisterFcmTokenError(
      "INVALID_REQUEST_BODY",
      "요청 내용을 확인하지 못했습니다.",
      400,
    );
  }
}

function getTokenFromBody(body: unknown) {
  const token = typeof (body as { token?: unknown })?.token === "string"
    ? (body as { token: string }).token.trim()
    : "";

  if (!token || token.length < 20 || token.length > 5000) {
    throw new RegisterFcmTokenError(
      "INVALID_FCM_TOKEN",
      "PC 알림 기기 정보를 확인하지 못했습니다.",
      400,
    );
  }

  return token;
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
    const body = await readRequestBody(req);
    const token = getTokenFromBody(body);

    const { error } = await context.adminClient
      .from("fcm_tokens")
      .upsert(
        {
          user_id: context.user.id,
          token,
          created_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );

    if (error) {
      console.error("Failed to register FCM token:", {
        code: error.code,
        message: error.message,
      });
      throw new RegisterFcmTokenError(
        "FCM_TOKEN_REGISTER_FAILED",
        "PC 알림 기기 등록에 실패했습니다.",
        500,
      );
    }

    return new Response(JSON.stringify({ registered: true }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof RegisterFcmTokenError) {
      return jsonError(error.code, error.message, error.status, corsHeaders);
    }

    console.error("boplan-register-fcm-token failed:", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return jsonError(
      "INTERNAL_ERROR",
      "PC 알림 기기 등록 중 오류가 발생했습니다.",
      500,
      corsHeaders,
    );
  }
});
