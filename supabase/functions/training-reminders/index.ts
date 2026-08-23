// @ts-nocheck — Supabase Edge Functions run in Deno, outside the Next.js TypeScript runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localParts(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function addDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

function emailHtml({ traineeName, coachName, targetDate, timezone, sessions, appUrl }) {
  const rows = sessions.map((session) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #303946;vertical-align:top;width:92px;color:#E4C768;font-weight:700;">${escapeHtml(formatTime(session.local_time))}</td>
      <td style="padding:14px 0;border-bottom:1px solid #303946;vertical-align:top;">
        <div style="color:#F1F3F5;font-weight:700;">${escapeHtml(session.title)}</div>
        <div style="margin-top:3px;color:#A8B0BC;font-size:13px;text-transform:capitalize;">${escapeHtml(session.kind)}</div>
        ${session.notes ? `<div style="margin-top:7px;color:#A8B0BC;font-size:14px;">${escapeHtml(session.notes)}</div>` : ""}
      </td>
    </tr>`).join("");
  const scheduleUrl = `${appUrl.replace(/\/$/, "")}/trainee/schedule?date=${targetDate}`;
  const logoUrl = `${appUrl.replace(/\/$/, "")}/brand/sthenos/app-icon-192.png`;
  return `<!doctype html><html><body style="margin:0;background:#0B0D10;color:#F1F3F5;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">Tomorrow's training plan from Sthenos.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0D10;padding:28px 12px;"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#181D24;border:1px solid #303946;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:26px 30px;border-bottom:1px solid #303946;"><img src="${escapeHtml(logoUrl)}" width="42" height="42" alt="Sthenos" style="vertical-align:middle;border-radius:10px;"><span style="margin-left:12px;color:#F1F3F5;font-size:21px;font-weight:800;vertical-align:middle;">STHENOS</span></td></tr>
        <tr><td style="padding:30px;">
          <p style="margin:0;color:#A8B0BC;font-size:14px;">TRAINING REMINDER</p>
          <h1 style="margin:8px 0 12px;color:#F1F3F5;font-size:26px;line-height:1.25;">Your plan for tomorrow</h1>
          <p style="margin:0 0 22px;color:#A8B0BC;line-height:1.6;">Hello ${escapeHtml(traineeName)}, here is the training planned with ${escapeHtml(coachName)} for <strong style="color:#F1F3F5;">${escapeHtml(formatDate(targetDate))}</strong>.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
          <p style="margin:12px 0 24px;color:#687280;font-size:12px;">Times shown in ${escapeHtml(timezone)}.</p>
          <a href="${escapeHtml(scheduleUrl)}" style="display:inline-block;background:#E4C768;color:#11151A;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:8px;">View training schedule</a>
          <p style="margin:24px 0 0;color:#687280;font-size:12px;line-height:1.5;">You or your coach can turn reminders off from Schedule settings.</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get("TRAINING_REMINDER_CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
  }
  if (Deno.env.get("TRAINING_REMINDER_EMAILS_ENABLED") !== "true") {
    return new Response(JSON.stringify({ enabled: false, sent: 0 }), { headers: jsonHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("TRAINING_REMINDER_FROM_EMAIL");
  const appUrl = Deno.env.get("TRAINING_REMINDER_APP_URL");
  if (!supabaseUrl || !serviceKey || !resendKey || !fromEmail || !appUrl) {
    return new Response(JSON.stringify({ error: "Reminder secrets are incomplete." }), { status: 500, headers: jsonHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  await supabase.rpc("refresh_training_schedule_occurrences");
  const { data: clients, error: clientError } = await supabase
    .from("clients")
    .select("id, coach_id, name, email, timezone, profiles!clients_coach_id_fkey(full_name)")
    .eq("status", "active")
    .not("client_user_id", "is", null)
    .not("timezone_confirmed_at", "is", null)
    .eq("email_workout_reminders_enabled", true)
    .not("email", "is", null);
  if (clientError) return new Response(JSON.stringify({ error: clientError.message }), { status: 500, headers: jsonHeaders });

  let sent = 0;
  let failed = 0;
  for (const client of clients ?? []) {
    const local = localParts(client.timezone);
    if (Number(local.hour) !== 19) continue;
    const today = `${local.year}-${local.month}-${local.day}`;
    const targetDate = addDay(today);
    const { data: sessions, error: sessionError } = await supabase
      .from("training_schedule_occurrences")
      .select("id, title, kind, local_time, notes, routine_assignment_id, activity_assignment_id, client_routines(status), client_activities(status)")
      .eq("client_id", client.id)
      .eq("scheduled_on", targetDate)
      .eq("status", "planned")
      .eq("reminder_enabled", true)
      .order("local_time");
    if (sessionError) { failed += 1; continue; }
    const available = (sessions ?? []).filter((session) => {
      const routine = Array.isArray(session.client_routines) ? session.client_routines[0] : session.client_routines;
      const activity = Array.isArray(session.client_activities) ? session.client_activities[0] : session.client_activities;
      return session.kind === "open" || routine?.status === "active" || activity?.status === "active";
    });
    if (!available.length) continue;

    const { data: existing } = await supabase.from("training_reminder_deliveries")
      .select("id, status, attempts")
      .eq("client_id", client.id).eq("target_date", targetDate).maybeSingle();
    if (existing?.status === "sent" || existing?.status === "suppressed" || (existing?.attempts ?? 0) >= 3) continue;

    let deliveryId = existing?.id;
    const attempt = (existing?.attempts ?? 0) + 1;
    if (!deliveryId) {
      const { data: delivery, error: deliveryError } = await supabase.from("training_reminder_deliveries").insert({
        coach_id: client.coach_id,
        client_id: client.id,
        target_date: targetDate,
        occurrence_ids: available.map((session) => session.id),
        recipient_email: client.email,
        attempts: attempt,
        status: "pending"
      }).select("id").single();
      if (deliveryError || !delivery) continue;
      deliveryId = delivery.id;
    } else {
      await supabase.from("training_reminder_deliveries").update({
        status: "pending", attempts: attempt, last_error: null
      }).eq("id", deliveryId);
    }

    const coach = Array.isArray(client.profiles) ? client.profiles[0] : client.profiles;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `training-${client.id}-${targetDate}` },
        body: JSON.stringify({
          from: fromEmail,
          to: [client.email],
          subject: `Tomorrow's training plan · ${formatDate(targetDate)}`,
          html: emailHtml({ traineeName: client.name, coachName: coach?.full_name ?? "your coach", targetDate, timezone: client.timezone, sessions: available, appUrl })
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message ?? `Resend returned ${response.status}`);
      await supabase.from("training_reminder_deliveries").update({ status: "sent", provider_message_id: result.id ?? null, sent_at: new Date().toISOString(), last_error: null }).eq("id", deliveryId);
      sent += 1;
    } catch (error) {
      await supabase.from("training_reminder_deliveries").update({ status: "failed", last_error: error instanceof Error ? error.message : "Unknown delivery error" }).eq("id", deliveryId);
      failed += 1;
    }
  }

  return new Response(JSON.stringify({ enabled: true, sent, failed }), { headers: jsonHeaders });
});
