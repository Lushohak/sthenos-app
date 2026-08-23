"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Bell,
  BellOff,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Footprints,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  SkipForward,
  Trash2
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  completeScheduledActivityAction,
  completeScheduledWorkoutAction,
  createTrainingScheduleAction,
  setTrainingScheduleStatusAction,
  updateTrainingScheduleAction,
  updateTrainingSchedulePreferencesAction
} from "@/lib/actions/training-schedule";
import {
  ACTIVITY_METRICS,
  formatActivityMetricValue
} from "@/lib/activities";
import {
  addDateOnlyDays,
  effectiveScheduleStatus,
  formatScheduleTime,
  initialTrainingScheduleActionState,
  parseDateOnly,
  startOfScheduleWeek,
  type ScheduleActivityOption,
  type ScheduleRoutineOption,
  type TrainingScheduleKind,
  type TrainingScheduleOccurrence
} from "@/lib/training-schedule";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ScheduleOccurrence = TrainingScheduleOccurrence & {
  isRecurring: boolean;
};

type Props = {
  client: {
    id: string;
    name: string;
    coachId: string;
    status: "active" | "paused" | "archived";
    timezone: string | null;
    timezoneConfirmedAt: string | null;
    remindersEnabled: boolean;
  };
  viewer: {
    id: string;
    role: "coach" | "trainee";
    coachName: string;
  };
  occurrences: ScheduleOccurrence[];
  routines: ScheduleRoutineOption[];
  activities: ScheduleActivityOption[];
  initialDate: string;
  localToday: string;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC"
});
const longDateFormatter = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC"
});

const statusStyles = {
  planned: "border-info/30 bg-info/10 text-info",
  completed: "border-success/30 bg-success/10 text-success",
  skipped: "border-warning/30 bg-warning/10 text-warning",
  missed: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted text-muted-foreground"
};

function formatDay(value: string, long = false) {
  const date = parseDateOnly(value);
  return date ? (long ? longDateFormatter : dateFormatter).format(date) : value;
}

function TimezonePreferences({ client }: Pick<Props, "client">) {
  const [open, setOpen] = useState(!client.timezoneConfirmedAt && client.status !== "archived");
  const [detectedTimezone, setDetectedTimezone] = useState(client.timezone ?? "UTC");
  const [state, action] = useActionState(
    updateTrainingSchedulePreferencesAction.bind(null, client.id),
    initialTrainingScheduleActionState
  );

  useEffect(() => {
    if (!client.timezone) {
      setDetectedTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    }
  }, [client.timezone]);

  useEffect(() => {
    if (state.status === "success") setOpen(false);
  }, [state.status]);

  return (
    <>
      {client.status === "archived" ? (
        <div className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
          {client.timezone ?? "Timezone not confirmed"} · Reminders {client.remindersEnabled ? "enabled" : "disabled"}
        </div>
      ) : client.timezoneConfirmedAt ? (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Schedule settings
        </Button>
      ) : (
        <div className="rounded-xl border border-info/30 bg-info/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Confirm the trainee timezone</p>
              <p className="mt-1 text-sm text-muted-foreground">Session times and 7 PM email reminders use this timezone.</p>
            </div>
            <Button type="button" onClick={() => setOpen(true)}>Confirm timezone</Button>
          </div>
        </div>
      )}
      <Modal open={open} onOpenChange={setOpen} title="Schedule settings" description="Either the coach or trainee can update these preferences.">
        <form action={action} className="grid gap-4 p-5">
          <Field label="Trainee timezone" hint="Use an IANA timezone such as America/Mexico_City.">
            <Input name="timezone" value={detectedTimezone} onChange={(event) => setDetectedTimezone(event.target.value)} required />
          </Field>
          <label className="flex items-start gap-3 rounded-lg border bg-background-secondary p-3 text-sm">
            <input name="reminders_enabled" type="checkbox" defaultChecked={client.remindersEnabled} className="mt-1 h-4 w-4 accent-primary" />
            <span><span className="font-medium">Email workout reminders</span><span className="mt-1 block text-muted-foreground">Send one summary at 7:00 PM for all training planned the next day.</span></span>
          </label>
          {state.status === "error" ? <p className="text-sm text-destructive" role="alert">{state.message}</p> : null}
          <div className="flex justify-end gap-2 border-t pt-4">
            {client.timezoneConfirmedAt ? <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button> : null}
            <SubmitButton pendingLabel="Saving...">Save settings</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

function ScheduleEditor({
  clientId,
  occurrence,
  defaultDate,
  routines,
  activities,
  remindersDefault,
  onClose,
  onSuccess
}: {
  clientId: string;
  occurrence: ScheduleOccurrence | null;
  defaultDate: string;
  routines: ScheduleRoutineOption[];
  activities: ScheduleActivityOption[];
  remindersDefault: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [kind, setKind] = useState<TrainingScheduleKind>(occurrence?.kind ?? "routine");
  const action = occurrence
    ? updateTrainingScheduleAction.bind(null, clientId, occurrence.id)
    : createTrainingScheduleAction.bind(null, clientId);
  const [state, formAction] = useActionState(action, initialTrainingScheduleActionState);
  const selectedAssignment = occurrence?.kind === "routine"
    ? occurrence.routineAssignmentId ?? ""
    : occurrence?.kind === "activity"
      ? occurrence.activityAssignmentId ?? ""
      : "";

  useEffect(() => {
    if (state.status === "success") onSuccess(state.message);
  }, [onSuccess, state]);

  return (
    <form action={formAction} className="grid gap-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <Input name="scheduled_on" type="date" defaultValue={occurrence?.scheduledOn ?? defaultDate} required />
        </Field>
        <Field label="Training time">
          <Input name="local_time" type="time" defaultValue={(occurrence?.localTime ?? "18:00").slice(0, 5)} required />
        </Field>
      </div>
      <Field label="Training type">
        <Select name="kind" value={kind} onChange={(event) => setKind(event.target.value as TrainingScheduleKind)}>
          <option value="routine">Routine</option>
          <option value="activity">Activity</option>
          <option value="open">Open workout</option>
        </Select>
      </Field>
      {kind === "routine" ? (
        <Field label="Routine">
          <Select name="assignment_id" defaultValue={occurrence?.kind === "routine" ? selectedAssignment : ""} required>
            <option value="" disabled>Choose an active Routine</option>
            {routines.filter((item) => item.status === "active").map((item) => <option key={item.assignmentId} value={item.assignmentId}>{item.name}</option>)}
          </Select>
        </Field>
      ) : null}
      {kind === "activity" ? (
        <Field label="Activity">
          <Select name="assignment_id" defaultValue={occurrence?.kind === "activity" ? selectedAssignment : ""} required>
            <option value="" disabled>Choose an active Activity</option>
            {activities.filter((item) => item.status === "active").map((item) => <option key={item.assignmentId} value={item.assignmentId}>{item.name}</option>)}
          </Select>
        </Field>
      ) : null}
      {kind === "open" ? (
        <Field label="Workout title">
          <Input name="open_title" defaultValue={occurrence?.kind === "open" ? occurrence.title : ""} maxLength={120} placeholder="Recovery run, mobility session..." required />
        </Field>
      ) : null}
      {!((kind === "routine" && routines.some((item) => item.status === "active")) || (kind === "activity" && activities.some((item) => item.status === "active")) || kind === "open") ? (
        <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">No active assignment is available for this training type.</p>
      ) : null}
      <Field label="Notes" hint="Optional — visible to both coach and trainee.">
        <Textarea name="notes" defaultValue={occurrence?.notes ?? ""} placeholder="Focus, preparation, or other guidance..." />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input name="reminder_enabled" type="checkbox" defaultChecked={occurrence?.reminderEnabled ?? remindersDefault} className="h-4 w-4 accent-primary" />
        Include this session in the night-before email
      </label>
      {occurrence ? (
        occurrence.isRecurring ? (
          <fieldset className="grid gap-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Apply changes to</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="scope" value="single" defaultChecked className="accent-primary" />This session only</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="scope" value="future" className="accent-primary" />This and future sessions</label>
          </fieldset>
        ) : <input type="hidden" name="scope" value="single" />
      ) : (
        <label className="flex items-center gap-3 rounded-lg border bg-background-secondary p-3 text-sm">
          <input name="repeat_weekly" type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
          <span><span className="font-medium">Repeat weekly</span><span className="block text-muted-foreground">Continue until either person changes or removes it.</span></span>
        </label>
      )}
      {state.status === "error" ? <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{state.message}</p> : null}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <SubmitButton pendingLabel="Saving...">{occurrence ? "Save changes" : "Add training"}</SubmitButton>
      </div>
    </form>
  );
}

function SessionStatusDialog({
  clientId,
  occurrence,
  mode,
  open,
  onOpenChange,
  onSuccess
}: {
  clientId: string;
  occurrence: ScheduleOccurrence;
  mode: "skip" | "cancel";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message: string) => void;
}) {
  const nextStatus = mode === "skip" ? "skipped" : "cancelled";
  const [state, action] = useActionState(
    setTrainingScheduleStatusAction.bind(null, clientId, occurrence.id, nextStatus),
    initialTrainingScheduleActionState
  );
  useEffect(() => {
    if (state.status === "success") onSuccess(state.message);
  }, [onSuccess, state]);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={mode === "skip" ? `Skip ${occurrence.title}?` : `Remove ${occurrence.title}?`} description={mode === "skip" ? "The session stays in the calendar as skipped." : "Completed history is never removed."}>
      <form action={action} className="grid gap-4 p-5">
        {mode === "skip" ? <Field label="Reason" hint="Optional"><Textarea name="skip_reason" placeholder="Rest day, travel, illness..." /></Field> : null}
        {mode === "cancel" && occurrence.isRecurring ? (
          <fieldset className="grid gap-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Remove</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="scope" value="single" defaultChecked className="accent-primary" />This session only</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="scope" value="future" className="accent-primary" />This and future sessions</label>
          </fieldset>
        ) : <input type="hidden" name="scope" value="single" />}
        {state.status === "error" ? <p className="text-sm text-destructive" role="alert">{state.message}</p> : null}
        <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Keep session</Button><SubmitButton variant={mode === "cancel" ? "danger" : "secondary"} pendingLabel="Saving...">{mode === "skip" ? "Skip session" : "Remove session"}</SubmitButton></div>
      </form>
    </Modal>
  );
}

function CompletionDialog({
  clientId,
  occurrence,
  activity,
  open,
  onOpenChange,
  onSuccess
}: {
  clientId: string;
  occurrence: ScheduleOccurrence;
  activity?: ScheduleActivityOption;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message: string) => void;
}) {
  const action = occurrence.kind === "activity"
    ? completeScheduledActivityAction.bind(null, clientId, occurrence.id)
    : completeScheduledWorkoutAction.bind(null, clientId, occurrence.id);
  const [state, formAction] = useActionState(action, initialTrainingScheduleActionState);
  useEffect(() => {
    if (state.status === "success") onSuccess(state.message);
  }, [onSuccess, state]);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Complete ${occurrence.title}`} description={`Log the scheduled session from ${formatDay(occurrence.scheduledOn, true)}.`}>
      <form action={formAction} className="grid gap-4 p-5">
        {occurrence.kind === "activity" && activity ? ACTIVITY_METRICS.filter((metric) => activity.trackedMetrics.includes(metric.key)).map((metric) => {
          const target = activity.targets[metric.key];
          return <Field key={metric.key} label={`${metric.label} (${metric.unit})`} hint={`${activity.requiredMetrics.includes(metric.key) ? "Required" : "Optional"}${target !== undefined ? ` · Target ${formatActivityMetricValue(metric.key, target)}` : ""}`}><Input name={metric.key} type="number" min={metric.min} max={metric.max} step={metric.step} required={activity.requiredMetrics.includes(metric.key)} /></Field>;
        }) : null}
        {occurrence.kind !== "activity" ? <Field label="Duration in minutes" hint="Optional"><Input name="duration_minutes" type="number" min={1} max={1440} /></Field> : null}
        <Field label="Notes" hint="Optional"><Textarea name="notes" placeholder="How did the session go?" /></Field>
        {state.status === "error" ? <p className="text-sm text-destructive" role="alert">{state.message}</p> : null}
        <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><SubmitButton pendingLabel="Saving..."><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Mark completed</SubmitButton></div>
      </form>
    </Modal>
  );
}

function RestoreButton({ clientId, occurrence, onSuccess }: { clientId: string; occurrence: ScheduleOccurrence; onSuccess: (message: string) => void }) {
  const [state, action] = useActionState(setTrainingScheduleStatusAction.bind(null, clientId, occurrence.id, "planned"), initialTrainingScheduleActionState);
  useEffect(() => { if (state.status === "success") onSuccess(state.message); }, [onSuccess, state]);
  return <form action={action}><SubmitButton variant="ghost" className="h-8 px-2" pendingLabel="Restoring..."><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Restore</SubmitButton></form>;
}

function SessionCard({
  occurrence,
  client,
  viewer,
  routines,
  activities,
  localToday,
  onEdit,
  onSuccess
}: {
  occurrence: ScheduleOccurrence;
  client: Props["client"];
  viewer: Props["viewer"];
  routines: ScheduleRoutineOption[];
  activities: ScheduleActivityOption[];
  localToday: string;
  onEdit: () => void;
  onSuccess: (message: string) => void;
}) {
  const status = effectiveScheduleStatus(occurrence, localToday);
  const [dialog, setDialog] = useState<"skip" | "cancel" | "complete" | null>(null);
  const assignment = occurrence.kind === "routine"
    ? routines.find((item) => item.assignmentId === occurrence.routineAssignmentId)
    : activities.find((item) => item.assignmentId === occurrence.activityAssignmentId);
  const unavailable = occurrence.kind !== "open" && assignment?.status !== "active";
  const canChange = client.status !== "archived" && ["planned", "missed"].includes(status);
  const canComplete = canChange && occurrence.scheduledOn <= localToday && !unavailable;
  const author = occurrence.updatedBy === client.coachId ? viewer.coachName : client.name;
  const Icon = occurrence.kind === "activity" ? Footprints : Dumbbell;

  return (
    <article className={cn("rounded-lg border bg-card p-3 shadow-soft", status === "cancelled" && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Icon className="h-4 w-4 text-primary" aria-hidden="true" /><p className="truncate font-semibold">{occurrence.title}</p><span className={cn("rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold capitalize", statusStyles[status])}>{status}</span></div>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{formatScheduleTime(occurrence.localTime)} · {occurrence.isRecurring ? "Weekly" : "One-time"}</p>
        </div>
        {occurrence.reminderEnabled ? <Bell className="h-4 w-4 shrink-0 text-primary" aria-label="Email reminder enabled" /> : <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Email reminder disabled" />}
      </div>
      {occurrence.notes ? <p className="mt-2 text-sm text-muted-foreground">{occurrence.notes}</p> : null}
      {occurrence.skipReason ? <p className="mt-2 text-xs text-warning">Reason: {occurrence.skipReason}</p> : null}
      {unavailable ? <p className="mt-2 rounded bg-warning/10 px-2 py-1 text-xs text-warning">This assignment is paused or unavailable. Reminders and completion are disabled.</p> : null}
      <p className="mt-2 text-[0.68rem] text-disabled-foreground">Last updated by {author}</p>
      {canChange ? <div className="mt-3 flex flex-wrap gap-1 border-t pt-2">
        {canComplete && occurrence.kind === "routine" && viewer.role === "trainee" && occurrence.scheduledOn === localToday ? <LinkButton href={`/trainee/workouts/${occurrence.routineAssignmentId}?schedule=${occurrence.id}`} className="h-8 px-2 text-xs"><Dumbbell className="h-3.5 w-3.5" aria-hidden="true" />Begin workout</LinkButton> : canComplete ? <Button type="button" className="h-8 px-2 text-xs" onClick={() => setDialog("complete")}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Log completed</Button> : null}
        {status === "planned" ? <><Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={onEdit}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</Button><Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setDialog("skip")}><SkipForward className="h-3.5 w-3.5" aria-hidden="true" />Skip</Button></> : null}
        <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setDialog("cancel")}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remove</Button>
      </div> : null}
      {["skipped", "cancelled"].includes(status) && client.status !== "archived" ? <div className="mt-2 border-t pt-2"><RestoreButton clientId={client.id} occurrence={occurrence} onSuccess={onSuccess} /></div> : null}
      <SessionStatusDialog clientId={client.id} occurrence={occurrence} mode="skip" open={dialog === "skip"} onOpenChange={(open) => setDialog(open ? "skip" : null)} onSuccess={onSuccess} />
      <SessionStatusDialog clientId={client.id} occurrence={occurrence} mode="cancel" open={dialog === "cancel"} onOpenChange={(open) => setDialog(open ? "cancel" : null)} onSuccess={onSuccess} />
      <CompletionDialog clientId={client.id} occurrence={occurrence} activity={activities.find((item) => item.assignmentId === occurrence.activityAssignmentId)} open={dialog === "complete"} onOpenChange={(open) => setDialog(open ? "complete" : null)} onSuccess={onSuccess} />
    </article>
  );
}

export function TrainingSchedule({ client, viewer, occurrences, routines, activities, initialDate, localToday }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"week" | "four-weeks">("week");
  const [weekStart, setWeekStart] = useState(startOfScheduleWeek(initialDate));
  const [editor, setEditor] = useState<{ date: string; occurrence: ScheduleOccurrence | null } | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
  const dates = useMemo(() => Array.from({ length: view === "week" ? 7 : 28 }, (_, index) => addDateOnlyDays(weekStart, index)), [view, weekStart]);
  const byDate = useMemo(() => new Map(dates.map((date) => [date, occurrences.filter((item) => item.scheduledOn === date).sort((a, b) => a.localTime.localeCompare(b.localTime))])), [dates, occurrences]);

  function moveWeek(delta: number) {
    const next = addDateOnlyDays(weekStart, delta * (view === "week" ? 7 : 28));
    setWeekStart(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  function showSuccess(message: string) {
    setEditor(null);
    setToast({ open: true, message });
    router.refresh();
  }
  const canEdit = client.status !== "archived" && Boolean(client.timezoneConfirmedAt);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-semibold">Training schedule</h2><p className="mt-1 text-sm text-muted-foreground">Plan the week together and keep completed training connected to progress.</p></div>
        <TimezonePreferences client={client} />
      </div>
      {client.status === "archived" ? <div className="rounded-xl border border-info/30 bg-info/5 p-4 text-sm text-muted-foreground">This archived trainee’s schedule is available for reference, but it cannot be changed.</div> : null}
      {client.status === "paused" ? <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning">This trainee is paused. The schedule remains editable, but reminder emails are suspended.</div> : null}
      <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-3 shadow-soft backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><Button type="button" variant="secondary" className="h-9 w-9 px-0" aria-label="Previous period" onClick={() => moveWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button><Button type="button" variant="ghost" className="h-9" onClick={() => { const current = startOfScheduleWeek(localToday); setWeekStart(current); }}>This week</Button><Button type="button" variant="secondary" className="h-9 w-9 px-0" aria-label="Next period" onClick={() => moveWeek(1)}><ChevronRight className="h-4 w-4" /></Button></div>
        <p className="text-sm font-semibold">{formatDay(weekStart)} – {formatDay(addDateOnlyDays(weekStart, view === "week" ? 6 : 27))}</p>
        <div className="flex rounded-lg border bg-card p-1"><Button type="button" variant={view === "week" ? "primary" : "ghost"} className="h-8 px-3" onClick={() => setView("week")}>Week</Button><Button type="button" variant={view === "four-weeks" ? "primary" : "ghost"} className="h-8 px-3" onClick={() => setView("four-weeks")}>4 weeks</Button></div>
      </div>
      {view === "week" ? (
        <div className="grid gap-3 md:grid-cols-7">
          {dates.map((date) => <section key={date} className={cn("min-w-0 rounded-xl border bg-background-secondary p-2", date === localToday && "border-primary/50")}><div className="mb-2 flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">{formatDay(date)}</h3>{date === localToday ? <p className="text-[0.68rem] font-medium text-primary">Today</p> : null}</div>{canEdit && date >= localToday ? <Button type="button" variant="ghost" className="h-8 w-8 px-0" aria-label={`Add training on ${formatDay(date, true)}`} onClick={() => setEditor({ date, occurrence: null })}><Plus className="h-4 w-4" /></Button> : null}</div><div className="grid gap-2">{byDate.get(date)?.map((occurrence) => <SessionCard key={occurrence.id} occurrence={occurrence} client={client} viewer={viewer} routines={routines} activities={activities} localToday={localToday} onEdit={() => setEditor({ date: occurrence.scheduledOn, occurrence })} onSuccess={showSuccess} />)}{!byDate.get(date)?.length ? <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Rest day</p> : null}</div></section>)}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {dates.map((date) => {
            const items = byDate.get(date) ?? [];
            if (!items.length && date < localToday) return null;
            return <section key={date} className="rounded-xl border bg-background-secondary p-3"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{formatDay(date, true)}</h3>{canEdit && date >= localToday ? <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => setEditor({ date, occurrence: null })}><Plus className="h-4 w-4" />Add</Button> : null}</div><div className="grid gap-2 sm:grid-cols-2">{items.map((occurrence) => <SessionCard key={occurrence.id} occurrence={occurrence} client={client} viewer={viewer} routines={routines} activities={activities} localToday={localToday} onEdit={() => setEditor({ date: occurrence.scheduledOn, occurrence })} onSuccess={showSuccess} />)}{!items.length ? <p className="text-sm text-muted-foreground">No training planned.</p> : null}</div></section>;
          })}
        </div>
      )}
      {!occurrences.length && client.timezoneConfirmedAt ? <div className="rounded-xl border border-dashed bg-card p-8 text-center"><CalendarDays className="mx-auto h-9 w-9 text-muted-foreground" /><h3 className="mt-3 font-semibold">Build the first training week</h3><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Add assigned Routines, Activities, or open workouts. Weekly sessions automatically continue into future weeks.</p>{canEdit ? <Button type="button" className="mt-4" onClick={() => setEditor({ date: localToday, occurrence: null })}><Plus className="h-4 w-4" />Add training</Button> : null}</div> : null}
      {viewer.role === "coach" && (!routines.some((item) => item.status === "active") || !activities.some((item) => item.status === "active")) ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm"><div><p className="font-medium">Need more training options?</p><p className="text-muted-foreground">Assign active Routines or Activities before adding them to the schedule.</p></div><LinkButton href={`/dashboard/clients/${client.id}`} variant="secondary">Open Training plan</LinkButton></div> : null}
      <Modal open={Boolean(editor)} onOpenChange={(open) => { if (!open) setEditor(null); }} title={editor?.occurrence ? `Edit ${editor.occurrence.title}` : "Add training"} description={editor ? formatDay(editor.date, true) : undefined} className="max-w-xl">
        {editor ? <ScheduleEditor key={editor.occurrence?.id ?? editor.date} clientId={client.id} occurrence={editor.occurrence} defaultDate={editor.date} routines={routines} activities={activities} remindersDefault={client.remindersEnabled} onClose={() => setEditor(null)} onSuccess={showSuccess} /> : null}
      </Modal>
      <Toast open={toast.open} onOpenChange={(open) => setToast((current) => ({ ...current, open }))} title="Schedule updated" description={toast.message} />
    </div>
  );
}
