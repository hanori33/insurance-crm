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
        medicalSummary: "OPENAI_API_KEY가 Supabase Secrets에 없습니다.",
        additionalQuestions: ["Supabase Secrets에 OPENAI_API_KEY가 등록되어 있는지 확인하세요."],
        disclosureCheckPoints: ["AI 분석을 실행하려면 OpenAI API 키가 필요합니다."],
        underwritingNotes: ["현재는 함수는 실행됐지만 OpenAI 키를 찾지 못한 상태입니다."],
        customerScript: "현재 AI 분석 설정이 완료되지 않아 분석 결과를 제공할 수 없습니다.",
      });
    }

    const body = await req.json();

    const customerName = safeText(body.customerName || body.customer_name);
    const content = safeText(body.content);
    const nextAction = safeText(body.nextAction || body.next_action);
    const disclosureInfo = body.disclosureInfo || body.disclosure_info || {};
    const medicalHistory = Array.isArray(body.medicalHistory || body.medical_history)
      ? body.medicalHistory || body.medical_history
      : [];
    const exclusions = Array.isArray(body.exclusions) ? body.exclusions : [];

    const prompt = `
너는 보험설계사용 CRM "보플랜"의 AI 상담 분석 도우미다.

아래 상담기록을 바탕으로 보험 알릴의무, 병력고지, 부담보 상담에 필요한 내용을 정리해라.

반드시 지켜야 할 원칙:
- 보험사 심사 결과를 확정적으로 말하지 마라.
- 의학적 진단을 새로 내리지 마라.
- 고객 진술 기준으로 추가 확인 질문을 제안해라.
- 주민등록번호, 계좌번호, 카드번호 등 민감정보 입력을 유도하지 마라.
- 모든 내용은 한국어로 작성해라.
- 결과는 반드시 JSON 형식으로만 반환해라.

고객명:
${customerName || "미입력"}

상담내용:
${content || "미입력"}

다음 액션:
${nextAction || "미입력"}

알릴의무 정보:
${JSON.stringify(disclosureInfo, null, 2)}

병력고지 정보:
${JSON.stringify(medicalHistory, null, 2)}

부담보 정보:
${JSON.stringify(exclusions, null, 2)}

반환 JSON 형식:
{
  "medicalSummary": "병력 요약",
  "additionalQuestions": ["추가 확인 질문1", "추가 확인 질문2"],
  "disclosureCheckPoints": ["알릴의무 체크 포인트1", "알릴의무 체크 포인트2"],
  "underwritingNotes": ["심사 참고사항1", "심사 참고사항2"],
  "customerScript": "고객에게 설명할 상담 멘트"
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
        medicalSummary: `OpenAI API 호출 실패: ${message}`,
        additionalQuestions: [
          "OpenAI Platform에서 Billing/결제수단이 등록되어 있는지 확인하세요.",
          "Supabase Secrets의 OPENAI_API_KEY가 최신 키인지 확인하세요.",
          "키를 새로 만들었다면 Supabase에 다시 등록 후 함수를 재배포하세요.",
        ],
        disclosureCheckPoints: [
          "현재 오류는 고객 고지내용 문제가 아니라 AI API 연결 문제입니다.",
        ],
        underwritingNotes: [
          "함수 호출은 성공했지만 OpenAI 응답에서 오류가 반환되었습니다.",
          `원본 오류: ${message}`,
        ],
        customerScript:
          "현재 AI 분석 연결 설정을 확인 중이라 분석 결과를 바로 제공하기 어렵습니다.",
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
    medicalSummary: text || "분석 결과를 정리하지 못했습니다.",
    additionalQuestions: [],
    disclosureCheckPoints: [],
    underwritingNotes: [],
    customerScript: "",
  };
}

    return jsonResponse(parsed);
  } catch (error) {
    return jsonResponse({
      medicalSummary: `AI 분석 처리 중 오류: ${error?.message || String(error)}`,
      additionalQuestions: ["입력값 또는 함수 설정을 확인하세요."],
      disclosureCheckPoints: ["현재 오류는 알릴의무 내용 문제가 아니라 시스템 처리 오류입니다."],
      underwritingNotes: [`오류 내용: ${error?.message || String(error)}`],
      customerScript: "현재 AI 분석 처리 중 오류가 발생했습니다.",
    });
  }
});