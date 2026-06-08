import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { diseaseName } = await req.json();

    if (!diseaseName) {
      throw new Error("질병명이 없습니다.");
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    const prompt = `
너는 보험설계사 교육 전문가다.

질병명:
${diseaseName}

반드시 JSON만 반환.

형식:

{
  "summary": "",
  "checkQuestions": [],
  "disclosurePoints": [],
  "underwritingNotes": [],
  "customerScript": ""
}
`;

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "보험설계사 상담용 병력사전 초안 생성 전문가",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    const text =
      data?.choices?.[0]?.message?.content ||
      "{}";

    return new Response(text, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});