"use client";

import { Activity, Dumbbell, Plus, Ruler, ScrollText } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AssignRoutineForm } from "@/components/forms/assign-routine-form";
import { AssignActivityForm } from "@/components/forms/assign-activity-form";
import { ActivityLogForm } from "@/components/forms/activity-log-form";
import { BodyProgressForm } from "@/components/forms/body-progress-form";
import { WorkoutLogForm } from "@/components/forms/client-activity-forms";
import { QuickCreateActivityForm } from "@/components/forms/quick-create-activity-form";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";
import { parseActivityTargets } from "@/lib/activities";
import type {
  LoggableActivityAssignment,
  RoutineLogAssignment
} from "@/lib/client-roster";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Routine = Database["public"]["Tables"]["workout_routines"]["Row"];
type ActivityTemplate = Database["public"]["Tables"]["activities"]["Row"];
export type { LoggableActivityAssignment } from "@/lib/client-roster";

type TriggerProps = {
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary" | "ghost";
  triggerClassName?: string;
};

const CREATE_ACTIVITY_VALUE = "__create_activity__";

export function ClientTrainingAssignmentDialog({
  clientId,
  clientName,
  routines,
  assignedRoutineIds,
  activities,
  assignedActivityIds,
  initialMode = "routine",
  triggerLabel,
  triggerVariant,
  triggerClassName
}: TriggerProps & {
  clientId: string;
  clientName: string;
  routines: Routine[];
  assignedRoutineIds: string[];
  activities: ActivityTemplate[];
  assignedActivityIds: string[];
  initialMode?: "routine" | "activity";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"routine" | "activity">(initialMode);
  const handleSuccess = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setMode(initialMode);
  }

  return (
    <>
      <Button type="button" variant={triggerVariant} className={triggerClassName} onClick={() => handleOpenChange(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {triggerLabel}
      </Button>
      <Modal
        open={open}
        onOpenChange={handleOpenChange}
        title="Assign training"
        description={`Add routines or Activities to ${clientName}'s plan.`}
        className="max-w-2xl"
      >
        <div className="grid gap-4 p-5">
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Assignment type">
            <Button type="button" variant={mode === "routine" ? "primary" : "secondary"} role="tab" aria-selected={mode === "routine"} onClick={() => setMode("routine")}>
              <Dumbbell className="h-4 w-4" aria-hidden="true" /> Routines
            </Button>
            <Button type="button" variant={mode === "activity" ? "primary" : "secondary"} role="tab" aria-selected={mode === "activity"} onClick={() => setMode("activity")}>
              <Activity className="h-4 w-4" aria-hidden="true" /> Activities
            </Button>
          </div>
          {mode === "routine" ? (
            <AssignRoutineForm
              clientId={clientId}
              clientName={clientName}
              routines={routines}
              assignedRoutineIds={assignedRoutineIds}
              onSuccess={handleSuccess}
            />
          ) : (
            <AssignActivityForm
              clientId={clientId}
              clientName={clientName}
              activities={activities}
              assignedActivityIds={assignedActivityIds}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </Modal>
    </>
  );
}

export function ClientProgressDialog({
  clientId,
  clientName,
  today,
  triggerLabel,
  triggerVariant,
  triggerClassName
}: TriggerProps & { clientId: string; clientName: string; today: string }) {
  const [open, setOpen] = useState(false);
  const handleSuccess = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button type="button" variant={triggerVariant} className={triggerClassName} onClick={() => setOpen(true)}>
        <Ruler className="h-4 w-4" aria-hidden="true" /> {triggerLabel}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`Add measurements for ${clientName}`}
        description="Record a new body-progress entry."
        className="max-w-4xl"
      >
        <div className="p-5">
          <BodyProgressForm clientId={clientId} today={today} submitter="coach" onSuccess={handleSuccess} />
        </div>
      </Modal>
    </>
  );
}

export function ClientTrainingLogDialog({
  clientId,
  clientName,
  routineAssignments,
  activityAssignments,
  today,
  triggerLabel,
  triggerVariant,
  triggerClassName
}: TriggerProps & {
  clientId: string;
  clientName: string;
  routineAssignments: RoutineLogAssignment[];
  activityAssignments: LoggableActivityAssignment[];
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogSession, setDialogSession] = useState(0);
  const handleSuccess = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
  }

  return (
    <>
      <Button type="button" variant={triggerVariant} className={triggerClassName} onClick={() => {
        setDialogSession((session) => session + 1);
        handleOpenChange(true);
      }}>
        <ScrollText className="h-4 w-4" aria-hidden="true" /> {triggerLabel}
      </Button>
      <Modal
        open={open}
        onOpenChange={handleOpenChange}
        title={`Log training for ${clientName}`}
        description="Record a completed workout or Activity."
        className="max-w-2xl"
      >
        <TrainingLogDialogContent
          key={dialogSession}
          clientId={clientId}
          routineAssignments={routineAssignments}
          activityAssignments={activityAssignments}
          today={today}
          onSuccess={handleSuccess}
        />
      </Modal>
    </>
  );
}

export function TrainingLogDialogContent({
  clientId,
  routineAssignments,
  activityAssignments,
  today,
  requireExplicitRoutineChoice = false,
  activityCompletionBehavior = "redirect",
  onSuccess
}: {
  clientId: string;
  routineAssignments: RoutineLogAssignment[];
  activityAssignments: LoggableActivityAssignment[];
  today: string;
  requireExplicitRoutineChoice?: boolean;
  activityCompletionBehavior?: "redirect" | "return";
  onSuccess?: () => void;
}) {
  const [mode, setMode] = useState<"workout" | "activity">("workout");
  const [availableActivities, setAvailableActivities] = useState(activityAssignments);
  const [activityId, setActivityId] = useState(activityAssignments[0]?.id ?? "");
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateToast, setQuickCreateToast] = useState("");
  const selectedActivity = useMemo(
    () => availableActivities.find((assignment) => assignment.id === activityId),
    [availableActivities, activityId]
  );
  const handleActivityCreated = useCallback((
    assignment: LoggableActivityAssignment,
    message: string
  ) => {
    setAvailableActivities((current) => [...current, assignment]);
    setActivityId(assignment.id);
    setShowQuickCreate(false);
    setQuickCreateToast(message);
  }, []);

  return (
    <div className="grid gap-4 p-5">
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Training log type">
            <Button type="button" variant={mode === "workout" ? "primary" : "secondary"} role="tab" aria-selected={mode === "workout"} onClick={() => setMode("workout")}>
              <Dumbbell className="h-4 w-4" aria-hidden="true" /> Workout
            </Button>
            <Button type="button" variant={mode === "activity" ? "primary" : "secondary"} role="tab" aria-selected={mode === "activity"} onClick={() => {
              setMode("activity");
              if (!availableActivities.length) setShowQuickCreate(true);
            }}>
              <Activity className="h-4 w-4" aria-hidden="true" /> Activity
            </Button>
          </div>
          {mode === "workout" ? (
            <WorkoutLogForm
              clientId={clientId}
              assignments={routineAssignments}
              today={today}
              requireExplicitRoutineChoice={requireExplicitRoutineChoice}
              onSuccess={onSuccess}
            />
          ) : (
            <div className="grid gap-4">
              <Field label="Activity">
                <Select value={showQuickCreate ? CREATE_ACTIVITY_VALUE : activityId} onChange={(event) => {
                  if (event.target.value === CREATE_ACTIVITY_VALUE) {
                    setShowQuickCreate(true);
                    return;
                  }
                  setActivityId(event.target.value);
                  setShowQuickCreate(false);
                }}>
                  {!availableActivities.length ? <option value="" disabled>No assigned Activities</option> : null}
                  {availableActivities.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>{assignment.activityName}</option>
                  ))}
                  <option value={CREATE_ACTIVITY_VALUE}>＋ Create and assign new Activity…</option>
                </Select>
              </Field>
              {showQuickCreate ? (
                <QuickCreateActivityForm
                  clientId={clientId}
                  onCancel={() => setShowQuickCreate(false)}
                  onCreated={handleActivityCreated}
                />
              ) : selectedActivity ? (
                <ActivityLogForm
                  key={selectedActivity.id}
                  assignmentId={selectedActivity.id}
                  activityName={selectedActivity.activityName}
                  trackedMetrics={selectedActivity.trackedMetrics}
                  requiredMetrics={selectedActivity.requiredMetrics}
                  targets={parseActivityTargets(selectedActivity.targets)}
                  today={today}
                  completionBehavior={activityCompletionBehavior}
                  onSuccess={onSuccess}
                />
              ) : null}
            </div>
          )}
          {!availableActivities.length && !showQuickCreate ? (
            <p className={cn("text-sm text-muted-foreground", mode !== "workout" && "mt-2")}>No active Activities are assigned yet. Create one from the Activity dropdown to log it now.</p>
          ) : null}
          <Toast
            open={Boolean(quickCreateToast)}
            onOpenChange={(open) => {
              if (!open) setQuickCreateToast("");
            }}
            title="Activity ready to log"
            description={quickCreateToast}
            variant="success"
          />
        </div>
  );
}
