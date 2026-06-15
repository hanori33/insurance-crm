import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { diseaseName } = await req.json();

    if (!diseaseName || !String(diseaseName).trim()) {
      return jsonResponse({ error: "질병명이 없습니다." }, 400);
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiKey) {
      return jsonResponse({ error: "OPENAI_API_KEY가 없습니다." }, 500);
    }

    const prompt = `
너는 보험설계사용 CRM "보플랜"의 병력사전 초안 생성 도우미다.

질병명:
${diseaseName}

아래 기준으로 보험설계사가 상담에 사용할 병력사전 초안을 만들어라.

중요 원칙:
- 의학적 진단을 새로 내리지 마라.
- 보험사 인수 결과를 확정하지 마라.
- "가능성이 있다", "확인 필요", "보험사별 상이"처럼 보조 표현을 사용해라.
- 고객에게 주민등록번호, 계좌번호, 카드번호 등 민감정보를 요구하지 마라.
- 질병코드는 대표적으로 자주 쓰이는 ICD 코드 1개를 제안하되, 실제 진단서 코드와 다를 수 있다고 전제해라.
- 한국 보험 알릴의무 상담 기준에 맞게 작성해라.
- 반드시 JSON만 반환해라. 코드블록 금지.

반환 JSON 형식:
{
  "diseaseCode": "대표 질병코드 예: I10",
  "category": "분류 예: 순환기 / 내분비 / 근골격 / 정신건강 / 소화기 / 호흡기 / 여성질환 / 기타",
  "keywords": ["검색 키워드1", "검색 키워드2", "검색 키워드3"],
  "summary": "병력 요약",
  "checkQuestions": ["추가 확인 질문1", "추가 확인 질문2"],
  "disclosurePoints": ["알릴의무 체크 포인트1", "알릴의무 체크 포인트2"],
  "underwritingNotes": ["심사 참고사항1", "심사 참고사항2"],
  "customerScript": "고객에게 설명할 상담 멘트"
}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
        temperature: 0.2,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return jsonResponse(
        {
          error: "OpenAI API 호출 실패",
          detail: data?.error?.message || data,
        },
        500
      );
    }

    const text =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      "{}";

    const cleanedText = String(text)
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(cleanedText);
    } catch (_e) {
      parsed = {
        diseaseCode: "",
        category: "일반",
        keywords: [String(diseaseName)],
        summary: cleanedText || "",
        checkQuestions: [],
        disclosurePoints: [],
        underwritingNotes: [],
        customerScript: "",
      };
    }

    return jsonResponse({
      diseaseCode: parsed.diseaseCode || parsed.disease_code || "",
      category: parsed.category || "일반",
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [String(diseaseName)],
      summary: parsed.summary || "",
      checkQuestions: Array.isArray(parsed.checkQuestions)
        ? parsed.checkQuestions
        : parsed.check_questions || [],
      disclosurePoints: Array.isArray(parsed.disclosurePoints)
        ? parsed.disclosurePoints
        : parsed.disclosure_points || [],
      underwritingNotes: Array.isArray(parsed.underwritingNotes)
        ? parsed.underwritingNotes
        : parsed.underwriting_notes || [],
      customerScript: parsed.customerScript || parsed.customer_script || "",
    });
  } catch (e) {
    return jsonResponse(
      {
        error: e?.message || String(e),
      },
      500
    );
  }
});