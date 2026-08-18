import {
  AuthorizationError,
  jsonError,
  requireUser,
} from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    await requireUser(req);

    const apiKey = Deno.env.get("JUSO_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        { error: "주소 검색 API 키가 설정되어 있지 않습니다.", code: "JUSO_API_KEY_REQUIRED" },
        500,
      );
    }

    const body = await req.json().catch(() => ({}));
    const keyword = normalizeText(body.keyword);

    if (keyword.length < 2) {
      return jsonResponse({ results: [] });
    }

    const url = new URL("https://business.juso.go.kr/addrlink/addrLinkApi.do");
    url.searchParams.set("confmKey", apiKey);
    url.searchParams.set("currentPage", "1");
    url.searchParams.set("countPerPage", "10");
    url.searchParams.set("keyword", keyword);
    url.searchParams.set("resultType", "json");

    const response = await fetch(url);
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload) {
      return jsonResponse(
        { error: "주소 검색 서버 응답을 확인할 수 없습니다.", code: "JUSO_UPSTREAM_ERROR" },
        502,
      );
    }

    const common = payload?.results?.common || {};
    const errorCode = String(common.errorCode || "");

    if (errorCode && errorCode !== "0") {
      return jsonResponse(
        {
          error: common.errorMessage || "주소 검색 중 오류가 발생했습니다.",
          code: "JUSO_SEARCH_FAILED",
        },
        502,
      );
    }

    const jusoRows = Array.isArray(payload?.results?.juso) ? payload.results.juso : [];
    const results = jusoRows.map((item: Record<string, unknown>) => ({
      zipNo: normalizeText(item.zipNo),
      roadAddr: normalizeText(item.roadAddr),
      roadAddrPart1: normalizeText(item.roadAddrPart1),
      roadAddrPart2: normalizeText(item.roadAddrPart2),
      jibunAddr: normalizeText(item.jibunAddr),
      bdNm: normalizeText(item.bdNm),
      siNm: normalizeText(item.siNm),
      sggNm: normalizeText(item.sggNm),
      emdNm: normalizeText(item.emdNm),
    }));

    return jsonResponse({ results });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.code, error.message, error.status, corsHeaders);
    }

    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(
      { error: message || "주소 검색 중 오류가 발생했습니다.", code: "ADDRESS_SEARCH_ERROR" },
      500,
    );
  }
});
