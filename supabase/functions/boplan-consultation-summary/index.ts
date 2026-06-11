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
    summary: "OPENAI_API_KEY가 Supabase Secrets에 없습니다.",
    customerNeeds: [],
    nextActions: [],
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
너는 보험설계사용 CRM "보플랜"의 상담요약 AI다.

상담내용을 읽고 핵심만 정리해라.

반드시 JSON 형식으로만 반환한다.

고객명:
${customerName || "미입력"}

상담내용:
${content || "미입력"}

다음 액션:
${nextAction || "미입력"}

반환 형식:

{
  "summary": "상담 요약",
  "customerNeeds": [
    "고객 니즈1",
    "고객 니즈2"
  ],
  "nextActions": [
    "다음 액션1",
    "다음 액션2"
  ]
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
    summary: `OpenAI API 호출 실패: ${message}`,
    customerNeeds: [
      "OpenAI Platform 결제수단 또는 API 키 상태를 확인하세요.",
    ],
    nextActions: [
      "Supabase Secrets의 OPENAI_API_KEY가 최신 키인지 확인하세요.",
      "키를 새로 만들었다면 Supabase에 다시 등록 후 함수를 재배포하세요.",
    ],
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
  summary: text || "상담 내용을 요약하지 못했습니다.",
  customerNeeds: [],
  nextActions: [],
};
}

    return jsonResponse(parsed);
  } catch (error) {
    return jsonResponse({
  summary: `AI 상담요약 처리 중 오류: ${error?.message || String(error)}`,
  customerNeeds: [],
  nextActions: [],
});
  }
});