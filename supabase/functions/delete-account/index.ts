import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "사용자 확인 실패" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    await adminClient.from("fcm_tokens").delete().eq("user_id", userId);
await adminClient.from("consultations").delete().eq("user_id", userId);
await adminClient.from("schedules").delete().eq("user_id", userId);
await adminClient.from("sales").delete().eq("user_id", userId);
await adminClient.from("customers").delete().eq("user_id", userId);

await adminClient.from("inquiries").delete().eq("user_id", userId);
await adminClient.from("notes").delete().eq("user_id", userId);
await adminClient.from("notice_reads").delete().eq("user_id", userId);

await adminClient.from("role_requests").delete().eq("user_id", userId);
await adminClient.from("user_roles").delete().eq("user_id", userId);
await adminClient.from("profiles").delete().eq("user_id", userId);

const { error: deleteError } =
  await adminClient.auth.admin.deleteUser(userId);

if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "계정 삭제 실패" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});