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
        customerTemperature: "분석불가",
        score: 0,
        recommendedProducts: [],
        approachStrategy: "OPENAI_API_KEY가 Supabase Secrets에 없습니다.",
        recommendedQuestions: [],
        nextAction: "Supabase Secrets를 확인해주세요.",
      });
    }

    const body = await req.json();

    const customerName = safeText(body.customerName || body.customer_name);
    const category = safeText(body.category);
    const content = safeText(body.content || body.consultation_content);
    const nextAction = safeText(body.nextAction || body.next_action);
    const medicalHistory = Array.isArray(body.medicalHistory || body.medical_history)
      ? body.medicalHistory || body.medical_history
      : [];
    const exclusions = Array.isArray(body.exclusions) ? body.exclusions : [];

    const prompt = `
너는 보험설계사용 CRM "보플랜"의 AI 영업코치다.

아래 상담정보를 분석해서 설계사가 다음에 어떤 방향으로 고객에게 접근하면 좋을지 조언해라.

주의:
- 실제 보험 가입 가능 여부를 확정하지 말 것
- 특정 보험사 인수 가능성을 확정하지 말 것
- 과장 표현 금지
- 고객에게 불안감을 조성하지 말 것
- 설계사가 참고할 수 있는 영업 코칭으로만 작성
- 한국 보험설계사 실무 말투로 작성

고객명:
${customerName || "미입력"}

상담 카테고리:
${category || "상담"}

상담내용:
${content || "미입력"}

다음 액션:
${nextAction || "미입력"}

병력정보:
${JSON.stringify(medicalHistory)}

부담보정보:
${JSON.stringify(exclusions)}

반드시 JSON 형식으로만 반환한다.

반환 형식:
{
  "customerTemperature": "🔥 높음 / 🌤 보통 / ❄ 낮음 중 하나",
  "score": 0,
  "recommendedProducts": [
    "추천 상품 또는 보장 방향"
  ],
  "approachStrategy": "추천 접근 전략",
  "recommendedQuestions": [
    "고객에게 물어볼 질문"
  ],
  "nextAction": "다음 행동 제안"
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
        input: prompt,
        temperature: 0.35,
      }),
    });

    const result = await openaiResponse.json();

    if (!openaiResponse.ok) {
      const message =
        result?.error?.message ||
        result?.message ||
        JSON.stringify(result);

      return jsonResponse({
        customerTemperature: "분석불가",
        score: 0,
        recommendedProducts: [],
        approachStrategy: `OpenAI API 호출 실패: ${message}`,
        recommendedQuestions: [],
        nextAction: "API 키 또는 결제 상태를 확인해주세요.",
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
        customerTemperature: "분석불가",
        score: 0,
        recommendedProducts: [],
        approachStrategy: text || "AI 영업코치 분석에 실패했습니다.",
        recommendedQuestions: [],
        nextAction: "상담내용을 더 구체적으로 입력한 뒤 다시 분석해주세요.",
      };
    }

    return jsonResponse(parsed);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.code, error.message, error.status, corsHeaders);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    return jsonResponse({
      customerTemperature: "분석불가",
      score: 0,
      recommendedProducts: [],
      approachStrategy: `AI 영업코치 처리 중 오류: ${errorMessage}`,
      recommendedQuestions: [],
      nextAction: "잠시 후 다시 시도해주세요.",
    });
  }
});
