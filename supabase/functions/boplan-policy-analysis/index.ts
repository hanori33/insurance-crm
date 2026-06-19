import {
  AuthorizationError,
  jsonError,
  requireProEntitlement,
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

function safeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authContext = await requireUser(req);
    await requireProEntitlement(authContext);

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      return jsonResponse({
        company: "",
        productName: "",
        contractor: "",
        insured: "",
        premium: "",
        policyPeriod: "",
        coverageSummary: [],
        missingChecks: [],
        salesPoint: "OPENAI_API_KEY가 Supabase Secrets에 없습니다.",
        customerScript: "",
      });
    }

    const body = await req.json();

    const fileName = safeText(body.fileName || body.file_name);
    const fileUrl = safeText(body.fileUrl || body.file_url);
    const customerName = safeText(body.customerName || body.customer_name);

    if (!fileUrl) {
      return jsonResponse({
        company: "",
        productName: "",
        contractor: "",
        insured: "",
        premium: "",
        policyPeriod: "",
        coverageSummary: [],
        missingChecks: ["분석할 파일 URL이 없습니다."],
        salesPoint: "파일 URL을 확인해주세요.",
        customerScript: "",
      }, 400);
    }

    const prompt = `
너는 보험설계사용 CRM "보플랜"의 AI 증권분석 도우미다.

첨부된 보험 증권 또는 보험 관련 문서를 읽고 설계사가 고객 상담에 참고할 수 있게 정리해라.

주의:
- 문서에서 확인되는 내용만 작성
- 확인되지 않는 내용은 "확인 필요"라고 작성
- 보험금 지급 가능 여부나 가입 가능 여부를 확정하지 말 것
- 과장 표현 금지
- 한국 보험설계사 실무 말투로 작성
- 반드시 JSON 형식으로만 반환

고객명:
${customerName || "미입력"}

파일명:
${fileName || "미입력"}

반환 형식:
{
  "company": "보험사",
  "productName": "상품명",
  "contractor": "계약자",
  "insured": "피보험자",
  "premium": "보험료",
  "policyPeriod": "보험기간",
  "coverageSummary": [
    "확인된 주요 보장 요약"
  ],
  "missingChecks": [
    "추가 확인이 필요한 보장 또는 항목"
  ],
  "salesPoint": "설계사가 참고할 상담 포인트",
  "customerScript": "고객에게 설명할 때 사용할 부드러운 멘트"
}
`;

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt,
              },
              {
                type: "input_file",
                file_url: fileUrl,
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });

    const result = await openaiResponse.json();

    if (!openaiResponse.ok) {
      const message =
        result?.error?.message ||
        result?.message ||
        JSON.stringify(result);

      return jsonResponse({
        company: "",
        productName: "",
        contractor: "",
        insured: "",
        premium: "",
        policyPeriod: "",
        coverageSummary: [],
        missingChecks: [`OpenAI API 호출 실패: ${message}`],
        salesPoint: "API 키, 결제 상태 또는 파일 접근 권한을 확인해주세요.",
        customerScript: "",
      });
    }

    const text =
      result.output_text ||
      result.output?.[0]?.content?.[0]?.text ||
      "";

    let parsed;

    try {
      const cleanedText = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      parsed = JSON.parse(cleanedText);
    } catch (_e) {
      parsed = {
        company: "",
        productName: "",
        contractor: "",
        insured: "",
        premium: "",
        policyPeriod: "",
        coverageSummary: [],
        missingChecks: ["AI 응답을 JSON으로 변환하지 못했습니다."],
        salesPoint: text || "증권분석에 실패했습니다.",
        customerScript: "",
      };
    }

    return jsonResponse(parsed);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.code, error.message, error.status, corsHeaders);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    return jsonResponse({
      company: "",
      productName: "",
      contractor: "",
      insured: "",
      premium: "",
      policyPeriod: "",
      coverageSummary: [],
      missingChecks: [`AI 증권분석 처리 중 오류: ${errorMessage}`],
      salesPoint: "잠시 후 다시 시도해주세요.",
      customerScript: "",
    });
  }
});
