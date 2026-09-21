import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AuthorizationError, requireUser } from "../_shared/auth.ts";
import {
  corsHeaders,
  createAdminClient,
  getFirebaseAccessToken,
  jsonError,
  jsonResponse,
  parseServiceAccount,
  PushError,
  sendFcmMessage,
} from "../_shared/fcm.ts";

type ScheduleRow = {
  id: number;
  user_id: string;
  scheduled_at: string;
  customer_app_id?: number | null;
  schedule_type?: string | null;
  reminder_minutes: number | string | null;
  reminder_sent_at?: string | null;
  completed?: boolean | null;
  push_enabled?: boolean | null;
};

function reminderBody(minutes: number) {
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}시간 후 예정된 일정이 있습니다.`;
  }

  return `${minutes}분 후 예정된 일정이 있습니다.`;
}

function isDue(schedule: ScheduleRow, now: Date) {
  const minutes = Number(schedule.reminder_minutes);
  const scheduledAt = new Date(schedule.scheduled_at);

  if (!Number.isFinite(minutes) || Number.isNaN(scheduledAt.getTime())) return false;

  const reminderAt = new Date(scheduledAt.getTime() - minutes * 60 * 1000);
  return reminderAt <= now;
}

async function readOptions(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function requireCronSecret(req: Request) {
  const expected = Deno.env.get("BOPLAN_SCHEDULE_CRON_SECRET") || "";
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
    let scheduleId: string | null = null;
    let adminClient;
    if (testMode) {
      const context = await requireUser(req);
      adminClient = context.adminClient;
      testUserId = context.user.id;
      if (typeof options?.scheduleId !== "string" ||
          !/^[1-9][0-9]{0,18}$/.test(options.scheduleId)) {
        throw new PushError("INVALID_TEST_SCHEDULE", "테스트 일정 1건을 지정해주세요.", 400);
      }
      scheduleId = options.scheduleId;
      const { data: ownedSchedule, error: ownershipError } = await adminClient
        .from("schedules").select("id")
        .eq("id", scheduleId).eq("user_id", testUserId).maybeSingle();
      if (ownershipError) throw new PushError("SCHEDULE_LOOKUP_FAILED", "테스트 일정을 확인하지 못했습니다.", 500);
      if (!ownedSchedule) throw new PushError("TEST_SCHEDULE_FORBIDDEN", "본인의 테스트 일정만 실행할 수 있습니다.", 403);
    } else {
      requireCronSecret(req);
      adminClient = createAdminClient();
    }
    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let scheduleQuery = adminClient
      .from("schedules")
      .select("id,user_id,scheduled_at,customer_app_id,schedule_type,reminder_minutes,reminder_sent_at,completed,push_enabled")
      .is("reminder_sent_at", null)
      .not("scheduled_at", "is", null)
      .not("reminder_minutes", "is", null)
      .gte("scheduled_at", windowStart.toISOString())
      .lte("scheduled_at", windowEnd.toISOString())
      .or("completed.is.null,completed.eq.false")
      .or("push_enabled.is.null,push_enabled.eq.true")
      .order("scheduled_at", { ascending: true })
      .limit(100);

    if (testMode) {
      scheduleQuery = scheduleQuery.eq("id", scheduleId).eq("user_id", testUserId);
    }
    const { data: schedules, error: scheduleError } = await scheduleQuery;

    if (scheduleError) throw scheduleError;

    const dueSchedules = (schedules || []).filter((schedule) => isDue(schedule, now));

    if (dueSchedules.length === 0) {
      return jsonResponse({ checked: schedules?.length || 0, due: 0, sent: 0, failed: 0 });
    }

    if (dryRun) {
      return jsonResponse({
        checked: schedules?.length || 0,
        due: dueSchedules.length,
        sent: 0,
        failed: 0,
        dryRun: true,
      });
    }

    const serviceAccount = parseServiceAccount();
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const schedule of dueSchedules) {
      const minutes = Number(schedule.reminder_minutes);
      const eventKey = `schedule:${schedule.id}:${minutes}`;

      const { data: tokens, error: tokenError } = await adminClient
        .from("fcm_tokens")
        .select("id, token")
        .eq("user_id", schedule.user_id);

      if (tokenError) throw tokenError;
      if (!tokens?.length) {
        skipped += 1;
        continue;
      }

      const { error: eventError } = await adminClient
        .from("notification_events")
        .insert({
          user_id: schedule.user_id,
          event_type: "schedule_reminder",
          event_key: eventKey,
          event_date: now.toISOString().slice(0, 10),
          status: "sending",
          payload: {
            schedule_id: schedule.id,
            reminder_minutes: minutes,
          },
        });

      if (eventError) {
        if (eventError.code === "23505") {
          const staleBefore = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
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

      const results = await Promise.all(
        tokens.map(({ token }) =>
          sendFcmMessage(serviceAccount, accessToken, token, {
            title: "📅 보플랜 일정 알림",
            body: reminderBody(minutes),
            tag: `boplan-schedule-${schedule.id}-${minutes}`,
            data: {
              type: "schedule",
              scheduleId: String(schedule.id),
              customerAppId: schedule.customer_app_id == null ? "" : String(schedule.customer_app_id),
              route: "schedule",
              url: "/?notification=schedule",
            },
          })
        ),
      );

      const sentCount = results.filter((result) => result.ok).length;
      const failedCount = results.length - sentCount;
      if (failedCount > 0) {
        const httpStatuses: Record<string, number> = {};
        const errorCodes: Record<string, number> = {};
        const allowedCodes = new Set([
          "UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH",
          "THIRD_PARTY_AUTH_ERROR", "UNAUTHENTICATED", "PERMISSION_DENIED",
          "NOT_FOUND", "RESOURCE_EXHAUSTED", "INTERNAL", "UNAVAILABLE",
        ]);
        for (const result of results.filter((result) => !result.ok)) {
          const status = String(result.status);
          const code = allowedCodes.has(result.errorCode) ? result.errorCode : "OTHER";
          httpStatuses[status] = (httpStatuses[status] || 0) + 1;
          errorCodes[code] = (errorCodes[code] || 0) + 1;
        }
        console.error("schedule FCM failure summary", { httpStatuses, errorCodes });
      }
      sent += sentCount;
      failed += failedCount;

      if (sentCount > 0) {
        await adminClient
          .from("schedules")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", schedule.id)
          .is("reminder_sent_at", null);

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

    return jsonResponse({ checked: schedules?.length || 0, due: dueSchedules.length, sent, failed, skipped });
  } catch (error) {
    if (error instanceof PushError || error instanceof AuthorizationError) {
      return jsonError(error.code, error.message, error.status);
    }

    console.error("boplan-schedule-push failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return jsonError("SCHEDULE_PUSH_FAILED", "일정 푸시 알림 처리에 실패했습니다.", 500);
  }
});
