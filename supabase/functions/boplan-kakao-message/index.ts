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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      return jsonResponse({
        message: "OPENAI_API_KEY가 Supabase Secrets에 없습니다.",
      });
    }

    const body = await req.json();

    const customerName = safeText(body.customerName || body.customer_name);
    const status = safeText(body.status);
    const recentConsultation = safeText(
      body.recentConsultation || body.recent_consultation
    );

    const prompt = `
너는 보험설계사용 CRM "보플랜"의 카카오톡 멘트 작성 AI다.

아래 고객 정보와 연락 목적, 최근 상담기록을 참고해서
고객에게 보낼 자연스러운 카카오톡 멘트를 작성해라.

조건:
- 너무 영업적으로 쓰지 말 것
- 부담스럽지 않게 작성
- 친근하지만 예의 있게 작성
- 보험설계사가 실제 고객에게 보내는 말투
- 카톡으로 바로 보내도 어색하지 않게 작성
- 4~7줄 정도로 짧게 작성
- 과장 표현 금지
- 확정적 보장 표현 금지
- "무조건", "반드시", "100%" 같은 표현 금지
- 고객명은 자연스럽게 포함
- 이모지는 0~1개만 사용

고객명:
${customerName || "고객님"}

연락 목적:
${status || "안부 연락 및 보험 점검"}

최근 상담기록:
${recentConsultation || "없음"}

반드시 JSON 형식으로만 반환한다.

반환 형식:
{
  "message": "카카오톡 멘트"
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
        temperature: 0.4,
      }),
    });

    const result = await openaiResponse.json();

    if (!openaiResponse.ok) {
      const message =
        result?.error?.message ||
        result?.message ||
        JSON.stringify(result);

      return jsonResponse({
        message: `OpenAI API 호출 실패: ${message}`,
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
        message: text || "AI 카톡 멘트를 생성하지 못했습니다.",
      };
    }

    return jsonResponse(parsed);
  } catch (error) {
    return jsonResponse({
      message: `AI 카톡 멘트 처리 중 오류: ${error?.message || String(error)}`,
    });
  }
});