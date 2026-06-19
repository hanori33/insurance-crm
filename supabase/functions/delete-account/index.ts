import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAGE_SIZE = 1000;

async function deleteRows(
  adminClient: SupabaseClient,
  table: string,
  column: string,
  value: string,
) {
  const { error } = await adminClient.from(table).delete().eq(column, value);
  if (error) throw error;
}

async function getCustomerIds(adminClient: SupabaseClient, userId: string) {
  const customerIds: string[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await adminClient
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    customerIds.push(...(data ?? []).map(({ id }) => id));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return customerIds;
}

async function deletePolicyFiles(adminClient: SupabaseClient, customerIds: string[]) {
  for (let offset = 0; offset < customerIds.length; offset += PAGE_SIZE) {
    const { error } = await adminClient
      .from("policy_files")
      .delete()
      .in("customer_id", customerIds.slice(offset, offset + PAGE_SIZE));

    if (error) throw error;
  }
}

async function listStorageFiles(
  adminClient: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const filePaths: string[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await adminClient.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) throw error;

    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.id === null) {
        filePaths.push(...await listStorageFiles(adminClient, bucket, path));
      } else {
        filePaths.push(path);
      }
    }

    if (!data || data.length < PAGE_SIZE) break;
  }

  return filePaths;
}

async function deleteStorageFolder(
  adminClient: SupabaseClient,
  bucket: string,
  prefix: string,
) {
  const filePaths = await listStorageFiles(adminClient, bucket, prefix);

  for (let offset = 0; offset < filePaths.length; offset += PAGE_SIZE) {
    const { error } = await adminClient.storage
      .from(bucket)
      .remove(filePaths.slice(offset, offset + PAGE_SIZE));

    if (error) throw error;
  }
}

async function deletePolicyStorageFolders(
  adminClient: SupabaseClient,
  userId: string,
  customerIds: string[],
) {
  // Keep cleaning the legacy user folder while current uploads use customerId folders.
  await deleteStorageFolder(adminClient, "policy-files", userId);

  for (const customerId of customerIds) {
    await deleteStorageFolder(adminClient, "policy-files", customerId);
  }
}

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
      return new Response(JSON.stringify({ error: "사용자 확인에 실패했습니다." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const customerIds = await getCustomerIds(adminClient, userId);

    await deleteStorageFolder(adminClient, "fax-files", userId);
    await deletePolicyStorageFolders(adminClient, userId, customerIds);
    await deletePolicyFiles(adminClient, customerIds);
    await deleteRows(adminClient, "fax_history", "user_id", userId);
    await deleteRows(adminClient, "fax_credit_transactions", "user_id", userId);

    await deleteRows(adminClient, "fcm_tokens", "user_id", userId);
    await deleteRows(adminClient, "consultations", "user_id", userId);
    await deleteRows(adminClient, "schedules", "user_id", userId);
    await deleteRows(adminClient, "sales", "user_id", userId);
    await deleteRows(adminClient, "policies", "user_id", userId);
    await deleteRows(adminClient, "customers", "user_id", userId);

    await deleteRows(adminClient, "inquiries", "user_id", userId);
    await deleteRows(adminClient, "notes", "user_id", userId);
    await deleteRows(adminClient, "notice_reads", "user_id", userId);

    await deleteRows(adminClient, "role_requests", "user_id", userId);
    await deleteRows(adminClient, "user_roles", "user_id", userId);
    await deleteRows(adminClient, "profiles", "user_id", userId);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "계정 삭제에 실패했습니다.";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
