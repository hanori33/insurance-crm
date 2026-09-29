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

type ExpiryParseResult =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "valid"; dateKey: string; utcDay: number };

type CarExpiryTarget = {
  customerId: string;
  userId: string;
  expiry: string;
  daysBefore: number;
};

function isValidCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function parseCarExpiry(value: string | null): ExpiryParseResult {
  const raw = String(value ?? "").trim();
  if (!raw) return { kind: "empty" };

  let yearText = "";
  let monthText = "";
  let dayText = "";
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  const separated = raw.match(/^(\d{4})([-./])(\d{1,2})\2(\d{1,2})$/);

  if (compact) {
    [, yearText, monthText, dayText] = compact;
  } else if (separated) {
    yearText = separated[1];
    monthText = separated[3];
    dayText = separated[4];
  } else {
    return { kind: "invalid" };
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!isValidCalendarDate(year, month, day)) return { kind: "invalid" };

  return {
    kind: "valid",
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    utcDay: Date.UTC(year, month - 1, day),
  };
}

async function readOptions(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function requireCarExpiryCronSecret(req: Request) {
  const expected = Deno.env.get("BOPLAN_CAR_EXPIRY_CRON_SECRET") || "";
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
    const today = kstDateParts();
    const todayUtcDay = Date.UTC(today.year, today.month - 1, today.day);
    let adminClient;
    let testUserId: string | null = null;

    if (testMode) {
      const context = await requireUser(req);
      adminClient = context.adminClient;
      testUserId = context.user.id;
    } else {
      requireCarExpiryCronSecret(req);
      adminClient = createAdminClient();
    }

    let emptyExpiryCount = 0;
    let invalidExpiryCount = 0;
    const targets: CarExpiryTarget[] = [];

    if (testMode) {
      targets.push({
        customerId: "test",
        userId: testUserId!,
        expiry: today.dateKey,
        daysBefore: 0,
      });
    } else {
      const { data: settings, error: settingsError } = await adminClient
        .from("notification_settings")
        .select("user_id,car_expiry_days")
        .eq("car_expiry_enabled", true)
        .limit(5000);
      if (settingsError) throw settingsError;

      const daysByUser = new Map<string, number>();
      for (const setting of settings || []) {
        const days = Number(setting.car_expiry_days);
        if ([7, 14, 30].includes(days)) daysByUser.set(setting.user_id, days);
      }

      const userIds = Array.from(daysByUser.keys());
      if (userIds.length > 0) {
        const { data: customers, error: customerError } = await adminClient
          .from("customers")
          .select("id,user_id,car_expiry")
          .in("user_id", userIds)
          .limit(5000);
        if (customerError) throw customerError;

        for (const customer of customers || []) {
          const parsed = parseCarExpiry(customer.car_expiry);
          if (parsed.kind === "empty") {
            emptyExpiryCount += 1;
            continue;
          }
          if (parsed.kind === "invalid") {
            invalidExpiryCount += 1;
            continue;
          }

          const daysBefore = daysByUser.get(customer.user_id);
          if (!daysBefore) continue;
          const daysUntilExpiry = Math.round((parsed.utcDay - todayUtcDay) / 86400000);
          if (daysUntilExpiry !== daysBefore) continue;

          targets.push({
            customerId: customer.id,
            userId: customer.user_id,
            expiry: parsed.dateKey,
            daysBefore,
          });
        }
      }
    }

    if (dryRun) {
      return jsonResponse({
        date: today.dateKey,
        checked: targets.length,
        due: targets.length,
        sent: 0,
        failed: 0,
        emptyExpiryCount,
        invalidExpiryCount,
        dryRun: true,
        testMode,
      });
    }

    if (targets.length === 0) {
      return jsonResponse({
        date: today.dateKey,
        checked: 0,
        due: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        emptyExpiryCount,
        invalidExpiryCount,
        testMode,
      });
    }

    const serviceAccount = parseServiceAccount();
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    const tokenCache = new Map<string, Array<{ id: string; user_id: string; token: string }>>();
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let attempted = 0;
    let permanentInvalid = 0;
    let transientFailed = 0;
    let deletedInvalidTokens = 0;

    for (const target of targets) {
      const eventKey = testMode
        ? `car-expiry-test:${today.dateKey}:${target.userId}`
        : `car-expiry:${target.customerId}:${target.expiry}:${target.daysBefore}:${target.userId}`;

      let tokens = tokenCache.get(target.userId);
      if (!tokens) {
        const { data, error } = await adminClient
          .from("fcm_tokens")
          .select("id, user_id, token")
          .eq("user_id", target.userId);
        if (error) throw error;
        tokens = data || [];
        tokenCache.set(target.userId, tokens);
      }
      if (tokens.length === 0) {
        skipped += 1;
        continue;
      }

      const { error: eventError } = await adminClient
        .from("notification_events")
        .insert({
          user_id: target.userId,
          event_type: testMode ? "car_expiry_test" : "car_expiry",
          event_key: eventKey,
          event_date: today.dateKey,
          status: "sending",
          payload: {
            days_before: target.daysBefore,
            test_mode: testMode,
          },
        });

      if (eventError) {
        if (eventError.code === "23505") {
          const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          const { data: claimedEvent, error: claimError } = await adminClient
            .from("notification_events")
            .update({ status: "sending", updated_at: new Date().toISOString(), last_error: null })
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
          title: "🚗 자동차보험 만기가 다가와요",
          body: "자동차보험 만기 예정 고객을 확인해보세요.",
          tag: `boplan-${testMode ? "car-expiry-test" : "car-expiry"}-${today.dateKey}`,
          data: {
            type: "car_expiry",
            route: "customers",
            url: "/?notification=car-expiry",
            testMode: String(testMode),
          },
        },
        "car-expiry",
      );

      const sentCount = batch.sent;
      const failedCount = batch.failed;
      attempted += batch.attempted;
      permanentInvalid += batch.permanentInvalid;
      transientFailed += batch.transientFailed;
      deletedInvalidTokens += batch.deletedInvalidTokens;
      sent += sentCount;
      failed += failedCount;

      await adminClient
        .from("notification_events")
        .update(sentCount > 0 ? {
          status: failedCount > 0 ? "partial" : "sent",
          sent_count: sentCount,
          failed_count: failedCount,
          last_error: failedCount > 0 ? "PARTIAL_FCM_SEND_FAILED" : null,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } : {
          status: "failed",
          sent_count: 0,
          failed_count: failedCount,
          last_error: "FCM_SEND_FAILED",
          updated_at: new Date().toISOString(),
        })
        .eq("event_key", eventKey);
    }

    return jsonResponse({
      date: today.dateKey,
      checked: targets.length,
      due: targets.length,
      attempted,
      sent,
      failed,
      skipped,
      permanentInvalid,
      transientFailed,
      deletedInvalidTokens,
      emptyExpiryCount,
      invalidExpiryCount,
      testMode,
    });
  } catch (error) {
    if (error instanceof PushError || error instanceof AuthorizationError) {
      return jsonError(error.code, error.message, error.status);
    }
    console.error("boplan-car-expiry-push failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonError("CAR_EXPIRY_PUSH_FAILED", "자동차 만기 푸시 처리에 실패했습니다.", 500);
  }
});
