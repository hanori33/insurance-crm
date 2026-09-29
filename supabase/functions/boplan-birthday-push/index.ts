import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AuthorizationError, requireUser } from "../_shared/auth.ts";
import {
  corsHeaders,
  createAdminClient,
  getFirebaseAccessToken,
  jsonError,
  jsonResponse,
  kstDateParts,
  parseServiceAccount,
  PushError,
  sendFcmMessagesAndCleanup,
} from "../_shared/fcm.ts";

type CustomerRow = {
  id: string;
  user_id: string;
  birth: string | null;
};

type BirthParseResult =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "valid"; mmdd: string };

function isValidCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function parseBirth(value: string | null): BirthParseResult {
  const raw = String(value ?? "").trim();
  if (!raw) return { kind: "empty" };

  let yearText = "";
  let monthText = "";
  let dayText = "";

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  const separated = raw.match(/^(\d{4})([-./])(\d{1,2})\2(\d{1,2})$/);
  const short = raw.match(/^(\d{2})(\d{2})(\d{2})$/);

  if (compact) {
    [, yearText, monthText, dayText] = compact;
  } else if (separated) {
    yearText = separated[1];
    monthText = separated[3];
    dayText = separated[4];
  } else if (short) {
    // YYMMDD is used only to obtain month/day. 2000-2099 provides a
    // deterministic Gregorian leap-year check without guessing a birth century.
    yearText = `20${short[1]}`;
    monthText = short[2];
    dayText = short[3];
  } else {
    return { kind: "invalid" };
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!isValidCalendarDate(year, month, day)) return { kind: "invalid" };

  return {
    kind: "valid",
    mmdd: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

async function readOptions(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function requireBirthdayCronSecret(req: Request) {
  const expected = Deno.env.get("BOPLAN_BIRTHDAY_CRON_SECRET") || "";
  const received = req.headers.get("X-Boplan-Cron-Secret") || "";
  if (!expected || !received || expected !== received) {
    throw new PushError("AUTH_REQUIRED", "서버 알림 실행 권한이 필요합니다.", 401);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "POST 요청만 지원합니다.", 405);
  }

  try {
    const options = await readOptions(req);
    const testMode = options?.testMode === true;
    const dryRun = options?.dryRun === true;
    let testUserId: string | null = null;
    let adminClient;

    if (testMode) {
      const context = await requireUser(req);
      testUserId = context.user.id;
      adminClient = context.adminClient;
    } else {
      requireBirthdayCronSecret(req);
      adminClient = createAdminClient();
    }

    const today = kstDateParts();

    const countsByUser = new Map<string, number>();
    let emptyBirthCount = 0;
    let invalidBirthCount = 0;

    if (testMode) {
      countsByUser.set(testUserId!, 1);
    } else {
      const { data: customers, error: customerError } = await adminClient
        .from("customers")
        .select("id,user_id,birth")
        .limit(5000);

      if (customerError) throw customerError;

      (customers || []).forEach((customer: CustomerRow) => {
        const parsed = parseBirth(customer.birth);
        if (parsed.kind === "empty") {
          emptyBirthCount += 1;
          return;
        }
        if (parsed.kind === "invalid") {
          invalidBirthCount += 1;
          return;
        }
        if (parsed.mmdd !== today.mmdd) return;
        countsByUser.set(customer.user_id, (countsByUser.get(customer.user_id) || 0) + 1);
      });
    }

    if (countsByUser.size === 0) {
      return jsonResponse({ date: today.dateKey, users: 0, sent: 0, failed: 0, emptyBirthCount, invalidBirthCount, dryRun, testMode });
    }

    if (dryRun) {
      return jsonResponse({
        date: today.dateKey,
        users: countsByUser.size,
        birthdayCustomers: Array.from(countsByUser.values()).reduce((sum, count) => sum + count, 0),
        emptyBirthCount,
        invalidBirthCount,
        sent: 0,
        failed: 0,
        dryRun: true,
        testMode,
      });
    }

    const serviceAccount = parseServiceAccount();
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let attempted = 0;
    let permanentInvalid = 0;
    let transientFailed = 0;
    let deletedInvalidTokens = 0;

    for (const [userId, birthdayCount] of countsByUser.entries()) {
      const eventKey = `${testMode ? "birthday-test" : "birthday"}:${today.dateKey}:${userId}`;

      const { data: tokens, error: tokenError } = await adminClient
        .from("fcm_tokens")
        .select("id, user_id, token")
        .eq("user_id", userId);

      if (tokenError) throw tokenError;
      if (!tokens?.length) {
        skipped += 1;
        continue;
      }

      const { error: eventError } = await adminClient
        .from("notification_events")
        .insert({
          user_id: userId,
          event_type: testMode ? "birthday_test" : "birthday",
          event_key: eventKey,
          event_date: today.dateKey,
          status: "sending",
          payload: {
            count: birthdayCount,
            test_mode: testMode,
          },
        });

      if (eventError) {
        if (eventError.code === "23505") {
          const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          const { data: claimedEvent, error: claimError } = await adminClient
            .from("notification_events")
            .update({
              status: "sending",
              updated_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("event_key", eventKey)
            .in("status", ["failed", "pending", "sending"])
            .or(`status.neq.sending,updated_at.lt.${staleBefore}`)
            .select("id")
            .maybeSingle();

          if (claimError) throw claimError;
          if (!claimedEvent) {
            skipped += 1;
            continue;
          }
        } else {
          throw eventError;
        }
      }

      const batch = await sendFcmMessagesAndCleanup(
        adminClient,
        serviceAccount,
        accessToken,
        tokens,
        {
          title: "🎂 오늘 생일 고객이 있어요",
          body: "오늘 생일인 고객을 확인해보세요.",
          tag: `boplan-${testMode ? "birthday-test" : "birthday"}-${today.dateKey}`,
          data: {
            type: "birthday",
            route: "customers",
            url: "/?notification=birthday",
            testMode: String(testMode),
          },
        },
        "birthday",
      );

      const sentCount = batch.sent;
      const failedCount = batch.failed;
      attempted += batch.attempted;
      permanentInvalid += batch.permanentInvalid;
      transientFailed += batch.transientFailed;
      deletedInvalidTokens += batch.deletedInvalidTokens;
      sent += sentCount;
      failed += failedCount;

      if (sentCount > 0) {
        await adminClient
          .from("notification_events")
          .update({
            status: failedCount > 0 ? "partial" : "sent",
            sent_count: sentCount,
            failed_count: failedCount,
            last_error: failedCount > 0 ? "PARTIAL_FCM_SEND_FAILED" : null,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("event_key", eventKey);
      } else {
        await adminClient
          .from("notification_events")
          .update({
            status: "failed",
            sent_count: 0,
            failed_count: failedCount,
            last_error: "FCM_SEND_FAILED",
            updated_at: new Date().toISOString(),
          })
          .eq("event_key", eventKey);
      }
    }

    return jsonResponse({
      date: today.dateKey,
      users: countsByUser.size,
      attempted,
      sent,
      failed,
      skipped,
      permanentInvalid,
      transientFailed,
      deletedInvalidTokens,
      emptyBirthCount,
      invalidBirthCount,
      testMode,
    });
  } catch (error) {
    if (error instanceof PushError || error instanceof AuthorizationError) {
      return jsonError(error.code, error.message, error.status);
    }

    console.error("boplan-birthday-push failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return jsonError("BIRTHDAY_PUSH_FAILED", "생일 푸시 알림 처리에 실패했습니다.", 500);
  }
});
