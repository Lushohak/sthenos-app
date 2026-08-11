"use client";

import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Library,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users
} from "lucide-react";
import { useRouter } from "next/navigation";
import { BulkExerciseEditor } from "@/components/exercises/bulk-exercise-editor";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { BulkAssignRoutineForm } from "@/components/forms/bulk-assign-routine-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Toast } from "@/components/ui/toast";
import {
  addLibraryExercisesAction,
  discardRoutineDraftAction,
  publishRoutineAction,
  saveRoutineDetailsAction,
  saveRoutineExerciseConfigAction,
  type RoutineDetailsInput,
  type RoutineExerciseConfigInput,
  type RoutinePhase
} from "@/lib/actions/routine-builder";
import {
  removeRoutineExerciseAction,
  reorderRoutineExercisesAction
} from "@/lib/actions/routines";

type RoutineType = "circuit" | "individual" | "gym";
type Step = "details" | "exercises" | "configure" | "review" | "assign";
type SaveStatus = "saved" | "saving" | "error";

type LibraryExercise = {
  id: string;
  name: string;
  category: string | null;
  difficulty: number;
  equipment: string | null;
  movement_pattern: string | null;
  primary_muscles: string[];
  thumbnail_url: string | null;
};

type RoutineExercise = {
  id: string;
  position: number;
  sets: number;
  reps: string;
  rest_seconds: number | null;
  notes: string | null;
  phase: RoutinePhase;
  exercises:
    | {
        id: string;
        name: string;
        category: string | null;
        difficulty: number;
        thumbnail_url: string | null;
        archived_at: string | null;
      }
    | {
        id: string;
        name: string;
        category: string | null;
        difficulty: number;
        thumbnail_url: string | null;
        archived_at: string | null;
      }[]
    | null;
};

type AssignableTrainee = {
  id: string;
  name: string;
  email: string | null;
  existingAssignmentStatus: "active" | "paused" | null;
};

type RoutineBuilderProps = {
  coachId: string;
  routine: {
    id: string;
    name: string;
    description: string | null;
    warmup_notes: string | null;
    workout_notes: string | null;
    cooldown_notes: string | null;
    routine_type: RoutineType;
    default_cycles: number;
    status: "draft" | "published";
  };
  routineExercises: RoutineExercise[];
  libraryExercises: LibraryExercise[];
  trainees: AssignableTrainee[];
  affectedTraineeCount: number;
  initialStep?: Step;
};

const steps: Array<{ id: Step; label: string }> = [
  { id: "details", label: "Details" },
  { id: "exercises", label: "Exercises" },
  { id: "configure", label: "Configure" },
  { id: "review", label: "Review" },
  { id: "assign", label: "Assign" }
];

const routinePhases: Array<{
  id: RoutinePhase;
  label: string;
  description: string;
}> = [
  {
    id: "warmup",
    label: "Warm-up",
    description: "Prepare the body with light cardio, mobility, or activation work."
  },
  {
    id: "main",
    label: "Main workout",
    description: "The primary training work, including routine cycles or gym sets."
  },
  {
    id: "cooldown",
    label: "Cool-down",
    description: "Gradually recover with easy movement, mobility, or stretching."
  }
];

function getPhaseLabel(phase: RoutinePhase) {
  return routinePhases.find((item) => item.id === phase)?.label ?? "Main workout";
}

function getExercise(item: RoutineExercise) {
  return Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        status === "error"
          ? "text-destructive"
          : status === "saving"
            ? "text-info"
            : "text-success"
      }`}
      role="status"
      aria-live="polite"
    >
      {status === "saving" ? (
        <Spinner className="h-3.5 w-3.5" label="Saving changes" />
      ) : status === "error" ? (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {status === "saving" ? "Saving" : status === "error" ? "Couldn’t save" : "Saved"}
    </span>
  );
}

function ConfigureExerciseCard({
  routineId,
  routineType,
  item,
  index,
  itemCount,
  onMove,
  onRemove,
  onConfigChange,
  onSaveStatusChange
}: {
  routineId: string;
  routineType: RoutineType;
  item: RoutineExercise;
  index: number;
  itemCount: number;
  onMove: (itemId: string, offset: number) => void;
  onRemove: (itemId: string) => void;
  onConfigChange: (itemId: string, input: RoutineExerciseConfigInput) => void;
  onSaveStatusChange: (itemId: string, status: SaveStatus) => void;
}) {
  const exercise = getExercise(item);
  const [values, setValues] = useState<RoutineExerciseConfigInput>({
    sets: item.sets,
    reps: item.reps,
    restSeconds: item.rest_seconds,
    notes: item.notes ?? "",
    phase: item.phase
  });
  const [status, setStatus] = useState<SaveStatus>("saved");
  const lastSaved = useRef(JSON.stringify(values));

  useEffect(() => {
    const snapshot = JSON.stringify(values);
    if (snapshot === lastSaved.current) return;
    setStatus("saving");
    onSaveStatusChange(item.id, "saving");
    const timeout = window.setTimeout(async () => {
      const result = await saveRoutineExerciseConfigAction(routineId, item.id, values);
      if (result.success) {
        lastSaved.current = snapshot;
        setStatus("saved");
        onSaveStatusChange(item.id, "saved");
        onConfigChange(item.id, values);
      } else {
        setStatus("error");
        onSaveStatusChange(item.id, "error");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [item.id, onConfigChange, onSaveStatusChange, routineId, values]);

  async function retry() {
    setStatus("saving");
    const result = await saveRoutineExerciseConfigAction(routineId, item.id, values);
    if (result.success) {
      lastSaved.current = JSON.stringify(values);
      setStatus("saved");
      onSaveStatusChange(item.id, "saved");
      onConfigChange(item.id, values);
    } else {
      setStatus("error");
      onSaveStatusChange(item.id, "error");
    }
  }

  return (
    <article className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 gap-3">
          <ExerciseThumb
            src={exercise?.thumbnail_url}
            alt={exercise?.name ?? "Exercise"}
            className="h-20 w-24 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Exercise {index + 1}
            </p>
            <h3 className="mt-1 truncate font-semibold">{exercise?.name ?? "Exercise"}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {exercise?.category ?? "Uncategorized"} · Difficulty {exercise?.difficulty ?? "?"}
            </p>
            {exercise?.archived_at ? (
              <p className="mt-2 text-xs font-medium text-warning">Archived library exercise</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator status={status} />
          {status === "error" ? (
            <Button type="button" variant="ghost" className="h-8 px-2" onClick={retry}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
            </Button>
          ) : null}
          <Button type="button" variant="secondary" className="h-9 w-9 px-0" aria-label={`Move ${exercise?.name ?? "exercise"} up`} disabled={index === 0} onClick={() => onMove(item.id, -1)}>
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="secondary" className="h-9 w-9 px-0" aria-label={`Move ${exercise?.name ?? "exercise"} down`} disabled={index === itemCount - 1} onClick={() => onMove(item.id, 1)}>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" className="h-9 w-9 px-0 text-destructive" aria-label={`Remove ${exercise?.name ?? "exercise"}`} onClick={() => onRemove(item.id)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className={`mt-4 grid gap-4 border-t pt-4 ${routineType === "gym" && values.phase === "main" ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Field label="Workout phase">
          <Select value={values.phase} onChange={(event) => setValues((current) => ({ ...current, phase: event.target.value as RoutinePhase }))}>
            {routinePhases.map((phase) => <option key={phase.id} value={phase.id}>{phase.label}</option>)}
          </Select>
        </Field>
        {routineType === "gym" && values.phase === "main" ? (
          <Field label="Sets">
            <Input type="number" min={1} max={20} value={values.sets} onChange={(event) => setValues((current) => ({ ...current, sets: Number(event.target.value) }))} />
          </Field>
        ) : null}
        <Field label="Reps">
          <Input value={values.reps} onChange={(event) => setValues((current) => ({ ...current, reps: event.target.value }))} />
        </Field>
        <Field label="Rest seconds">
          <Input type="number" min={0} value={values.restSeconds ?? ""} onChange={(event) => setValues((current) => ({ ...current, restSeconds: event.target.value === "" ? null : Number(event.target.value) }))} />
        </Field>
        <div className="sm:col-span-full">
          <Field label="Instructions">
            <Textarea value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} />
          </Field>
        </div>
      </div>
    </article>
  );
}

export function RoutineBuilder({
  coachId,
  routine,
  routineExercises,
  libraryExercises,
  trainees,
  affectedTraineeCount,
  initialStep = "details"
}: RoutineBuilderProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const builderNavigationRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState(routine.status);
  const [details, setDetails] = useState<RoutineDetailsInput>({
    name: routine.name,
    description: routine.description ?? "",
    warmupNotes: routine.warmup_notes ?? "",
    workoutNotes: routine.workout_notes ?? "",
    cooldownNotes: routine.cooldown_notes ?? "",
    routineType: routine.routine_type,
    defaultCycles: routine.default_cycles
  });
  const [detailSaveStatus, setDetailSaveStatus] = useState<SaveStatus>("saved");
  const lastSavedDetails = useRef(JSON.stringify(details));
  const [libraryQuery, setLibraryQuery] = useState("");
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());
  const [selectedAddPhase, setSelectedAddPhase] = useState<RoutinePhase>("main");
  const [exerciseTab, setExerciseTab] = useState<"library" | "create">("library");
  const [items, setItems] = useState(routineExercises);
  const [configStatuses, setConfigStatuses] = useState<Record<string, SaveStatus>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, title: "", description: "" });
  const [isPending, startTransition] = useTransition();
  const hasUnsavedConfig = Object.values(configStatuses).some(
    (itemStatus) => itemStatus !== "saved"
  );

  function navigateToStep(nextStep: Step) {
    setStep(nextStep);
    window.requestAnimationFrame(() => {
      builderNavigationRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start"
      });
    });
  }

  const handleConfigChange = useCallback(
    (itemId: string, input: RoutineExerciseConfigInput) => {
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === itemId
            ? {
                ...currentItem,
                sets: input.sets,
                reps: input.reps,
                rest_seconds: input.restSeconds,
                notes: input.notes || null,
                phase: input.phase
              }
            : currentItem
        )
      );
    },
    []
  );

  const handleConfigSaveStatus = useCallback(
    (itemId: string, itemStatus: SaveStatus) => {
      setConfigStatuses((current) =>
        current[itemId] === itemStatus
          ? current
          : { ...current, [itemId]: itemStatus }
      );
    },
    []
  );

  useEffect(() => setItems(routineExercises), [routineExercises]);

  useEffect(() => {
    const snapshot = JSON.stringify(details);
    if (snapshot === lastSavedDetails.current) return;
    setDetailSaveStatus("saving");
    const timeout = window.setTimeout(async () => {
      const result = await saveRoutineDetailsAction(routine.id, details);
      if (result.success) {
        lastSavedDetails.current = snapshot;
        setDetailSaveStatus("saved");
      } else {
        setDetailSaveStatus("error");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [details, routine.id]);

  const normalizedQuery = libraryQuery.trim().toLocaleLowerCase();
  const filteredLibrary = useMemo(() => {
    if (!normalizedQuery) return libraryExercises;
    return libraryExercises.filter((exercise) =>
      [
        exercise.name,
        exercise.category,
        exercise.equipment,
        exercise.movement_pattern,
        ...exercise.primary_muscles
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery))
    );
  }, [libraryExercises, normalizedQuery]);

  async function retryDetails() {
    setDetailSaveStatus("saving");
    const result = await saveRoutineDetailsAction(routine.id, details);
    if (result.success) {
      lastSavedDetails.current = JSON.stringify(details);
      setDetailSaveStatus("saved");
    } else {
      setDetailSaveStatus("error");
    }
  }

  function addSelectedLibraryExercises() {
    setActionError(null);
    startTransition(async () => {
      const result = await addLibraryExercisesAction(
        routine.id,
        [...selectedLibraryIds],
        selectedAddPhase
      );
      if (!result.success) {
        setActionError(result.message);
        return;
      }
      setSelectedLibraryIds(new Set());
      setToast({ open: true, title: "Exercises added", description: `Added to ${getPhaseLabel(selectedAddPhase)}.` });
      router.refresh();
    });
  }

  function moveItem(itemId: string, offset: number) {
    const selectedItem = items.find((item) => item.id === itemId);
    if (!selectedItem) return;
    const phaseItems = items.filter((item) => item.phase === selectedItem.phase);
    const phaseIndex = phaseItems.findIndex((item) => item.id === itemId);
    const targetPhaseItem = phaseItems[phaseIndex + offset];
    if (!targetPhaseItem) return;
    const index = items.findIndex((item) => item.id === itemId);
    const targetIndex = items.findIndex((item) => item.id === targetPhaseItem.id);
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setItems(next);
    startTransition(async () => {
      try {
        await reorderRoutineExercisesAction(routine.id, next.map((item) => item.id));
      } catch {
        setItems(items);
        setActionError("The exercise order could not be saved.");
      }
    });
  }

  function removeItem(itemId: string) {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== itemId));
    setConfigStatuses((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    startTransition(async () => {
      try {
        await removeRoutineExerciseAction(routine.id, itemId);
        router.refresh();
      } catch {
        setItems(previous);
        setActionError("The exercise could not be removed.");
      }
    });
  }

  function publish() {
    setActionError(null);
    if (detailSaveStatus !== "saved" || hasUnsavedConfig) {
      setActionError("Wait for all changes to save before publishing.");
      return;
    }
    startTransition(async () => {
      const result = await publishRoutineAction(routine.id);
      if (!result.success) {
        setActionError(result.message);
        return;
      }
      setStatus("published");
      navigateToStep("assign");
      setToast({ open: true, title: "Routine published", description: "It is ready to assign to trainees." });
      router.refresh();
    });
  }

  function discardDraft() {
    startTransition(async () => {
      const result = await discardRoutineDraftAction(routine.id);
      if (!result.success) {
        setActionError(result.message);
        setIsDiscardOpen(false);
        return;
      }
      router.push("/dashboard/routines?view=drafts");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      {status === "published" && affectedTraineeCount ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="font-semibold">You are editing a live routine.</p>
            <p className="mt-1 text-muted-foreground">
              Saved changes will be visible to {affectedTraineeCount} {affectedTraineeCount === 1 ? "assigned trainee" : "assigned trainees"}.
            </p>
          </div>
        </div>
      ) : null}

      <nav
        ref={builderNavigationRef}
        className="scroll-mt-4 overflow-x-auto rounded-xl border bg-card p-2 shadow-soft"
        aria-label="Routine builder steps"
      >
        <ol className="flex min-w-max gap-2">
          {steps.map((item, index) => {
            const disabled =
              (item.id === "assign" && status === "draft") ||
              (item.id !== "details" && detailSaveStatus !== "saved") ||
              ((item.id === "review" || item.id === "assign") &&
                hasUnsavedConfig);
            return (
              <li key={item.id}>
                <Button
                  type="button"
                  variant={step === item.id ? "primary" : "ghost"}
                  className="h-9"
                  disabled={disabled}
                  onClick={() => navigateToStep(item.id)}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[0.7rem]">{index + 1}</span>
                  {item.label}
                </Button>
              </li>
            );
          })}
        </ol>
      </nav>

      {step === "details" ? (
        <section className="max-w-3xl rounded-xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Routine details</h2>
              <p className="mt-1 text-sm text-muted-foreground">Changes save automatically after you stop typing.</p>
            </div>
            <div className="flex items-center gap-2">
              <SaveIndicator status={detailSaveStatus} />
              {detailSaveStatus === "error" ? (
                <Button type="button" variant="ghost" className="h-8 px-2" onClick={retryDetails}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-5 grid gap-4">
            <Field label="Routine name">
              <Input value={details.name} required onChange={(event) => setDetails((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Description">
              <Textarea value={details.description} onChange={(event) => setDetails((current) => ({ ...current, description: event.target.value }))} />
            </Field>
            <div className="grid gap-4 rounded-xl border bg-background-secondary p-4">
              <div>
                <h3 className="font-semibold">Phase guidance</h3>
                <p className="mt-1 text-sm text-muted-foreground">Optional instructions appear before each part of the workout.</p>
              </div>
              <Field label="Warm-up guidance">
                <Textarea value={details.warmupNotes} placeholder="e.g. Begin with 10 minutes of easy walking or jogging." onChange={(event) => setDetails((current) => ({ ...current, warmupNotes: event.target.value }))} />
              </Field>
              <Field label="Main workout guidance">
                <Textarea value={details.workoutNotes} placeholder="e.g. Keep each repetition controlled and stop if form breaks down." onChange={(event) => setDetails((current) => ({ ...current, workoutNotes: event.target.value }))} />
              </Field>
              <Field label="Cool-down guidance">
                <Textarea value={details.cooldownNotes} placeholder="e.g. Finish with easy cycling, then complete the stretches below." onChange={(event) => setDetails((current) => ({ ...current, cooldownNotes: event.target.value }))} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Routine structure">
                <Select
                  value={details.routineType}
                  onChange={(event) => {
                    const routineType = event.target.value as RoutineType;
                    setDetails((current) => ({ ...current, routineType }));
                    setItems((current) =>
                      current.map((item) => ({
                        ...item,
                        sets: routineType === "gym" ? 3 : 1
                      }))
                    );
                  }}
                >
                  <option value="circuit">Cycles</option>
                  <option value="individual">Exercise-specific repeats</option>
                  <option value="gym">Gym workout</option>
                </Select>
              </Field>
              {details.routineType !== "gym" ? (
                <Field label="Default cycles">
                  <Input type="number" min={1} max={12} value={details.defaultCycles} onChange={(event) => setDetails((current) => ({ ...current, defaultCycles: Number(event.target.value) }))} />
                </Field>
              ) : (
                <div className="rounded-md border border-info/30 bg-info/5 p-3 text-sm text-muted-foreground">Gym workouts use sets and reps for each exercise.</div>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end border-t pt-4">
            <Button type="button" disabled={!details.name.trim() || detailSaveStatus !== "saved"} onClick={() => navigateToStep("exercises")}>Continue to exercises</Button>
          </div>
        </section>
      ) : null}

      {step === "exercises" ? (
        <section className="grid gap-5">
          <div>
            <h2 className="text-lg font-semibold">Build the exercise list</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose a workout phase, then select library exercises or create a batch without leaving the routine.</p>
          </div>
          <div className="max-w-sm rounded-xl border bg-card p-4 shadow-soft">
            <Field label="Add exercises to">
              <Select value={selectedAddPhase} onChange={(event) => setSelectedAddPhase(event.target.value as RoutinePhase)}>
                {routinePhases.map((phase) => <option key={phase.id} value={phase.id}>{phase.label}</option>)}
              </Select>
            </Field>
            <p className="mt-2 text-xs text-muted-foreground">{routinePhases.find((phase) => phase.id === selectedAddPhase)?.description}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercise sources">
            <Button type="button" variant={exerciseTab === "library" ? "primary" : "secondary"} role="tab" aria-selected={exerciseTab === "library"} onClick={() => setExerciseTab("library")}>
              <Library className="h-4 w-4" aria-hidden="true" /> Exercise library
            </Button>
            <Button type="button" variant={exerciseTab === "create" ? "primary" : "secondary"} role="tab" aria-selected={exerciseTab === "create"} onClick={() => setExerciseTab("create")}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Create exercises
            </Button>
          </div>
          {exerciseTab === "library" ? (
            <div className="grid gap-4">
              <div className="relative max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input type="search" className="pl-9" value={libraryQuery} placeholder="Search by name, category, equipment..." aria-label="Search exercise library" onChange={(event) => setLibraryQuery(event.target.value)} />
              </div>
              <fieldset className="grid max-h-[34rem] gap-3 overflow-y-auto rounded-xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-3">
                <legend className="sr-only">Select exercises</legend>
                {filteredLibrary.map((exercise) => {
                  const selected = selectedLibraryIds.has(exercise.id);
                  return (
                    <label key={exercise.id} className="grid cursor-pointer grid-cols-[auto_5rem_1fr] gap-3 rounded-lg border p-3 transition hover:border-primary/60 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/15">
                      <input className="mt-2 h-4 w-4 accent-primary" type="checkbox" value={exercise.id} checked={selected} onChange={() => setSelectedLibraryIds((current) => {
                        const next = new Set(current);
                        selected ? next.delete(exercise.id) : next.add(exercise.id);
                        return next;
                      })} />
                      <ExerciseThumb src={exercise.thumbnail_url} alt={exercise.name} className="h-16 w-20" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{exercise.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{exercise.category ?? "Uncategorized"} · Difficulty {exercise.difficulty}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{exercise.equipment ?? "No equipment"}</span>
                      </span>
                    </label>
                  );
                })}
                {!filteredLibrary.length ? <p className="p-4 text-sm text-muted-foreground">No exercises match this search.</p> : null}
              </fieldset>
              <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur">
                <p className="text-sm text-muted-foreground">{selectedLibraryIds.size} selected</p>
                <Button type="button" disabled={!selectedLibraryIds.size || isPending} onClick={addSelectedLibraryExercises}>
                  {isPending ? <Spinner className="h-4 w-4" label="Adding exercises" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                  {isPending ? "Adding exercises..." : `Add ${selectedLibraryIds.size || "selected"} to routine`}
                </Button>
              </div>
            </div>
          ) : (
            <BulkExerciseEditor
              coachId={coachId}
              existingExercises={libraryExercises}
              routineId={routine.id}
              routineType={details.routineType}
              routinePhase={selectedAddPhase}
            />
          )}
          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => navigateToStep("details")}>Back</Button>
            <Button type="button" onClick={() => navigateToStep("configure")}>Configure {items.length || routineExercises.length} exercises</Button>
          </div>
        </section>
      ) : null}

      {step === "configure" ? (
        <section className="grid gap-4">
          <div>
            <h2 className="text-lg font-semibold">Configure the workout</h2>
            <p className="mt-1 text-sm text-muted-foreground">Set workload, rest, instructions, and order. Each exercise saves automatically.</p>
          </div>
          {routinePhases.map((phase) => {
            const phaseItems = items.filter((item) => item.phase === phase.id);
            const guidance = phase.id === "warmup"
              ? details.warmupNotes
              : phase.id === "main"
                ? details.workoutNotes
                : details.cooldownNotes;
            return (
              <section key={phase.id} className="grid gap-3 rounded-xl border bg-background-secondary p-4" aria-labelledby={`${phase.id}-phase-heading`}>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id={`${phase.id}-phase-heading`} className="font-semibold">{phase.label}</h3>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{phaseItems.length} {phaseItems.length === 1 ? "exercise" : "exercises"}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{guidance || phase.description}</p>
                </div>
                {phaseItems.map((item, index) => (
                  <ConfigureExerciseCard
                    key={item.id}
                    routineId={routine.id}
                    routineType={details.routineType}
                    item={item}
                    index={index}
                    itemCount={phaseItems.length}
                    onMove={moveItem}
                    onRemove={removeItem}
                    onConfigChange={handleConfigChange}
                    onSaveStatusChange={handleConfigSaveStatus}
                  />
                ))}
                {!phaseItems.length ? (
                  <div className="rounded-lg border border-dashed bg-card p-4 text-center text-sm text-muted-foreground">
                    No {phase.label.toLocaleLowerCase()} exercises yet. Move an exercise here or add one from the Exercises step.
                  </div>
                ) : null}
              </section>
            );
          })}
          {!items.length ? (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center">
              <Dumbbell className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-medium">No exercises yet</p>
              <Button type="button" className="mt-4" onClick={() => navigateToStep("exercises")}>Add exercises</Button>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => navigateToStep("exercises")}>Back</Button>
            <Button type="button" disabled={!items.length || hasUnsavedConfig} onClick={() => navigateToStep("review")}>Review routine</Button>
          </div>
        </section>
      ) : null}

      {step === "review" ? (
        <section className="grid gap-5">
          <div>
            <h2 className="text-lg font-semibold">Review routine</h2>
            <p className="mt-1 text-sm text-muted-foreground">Confirm the structure before publishing or assigning.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-soft"><p className="text-xs font-medium uppercase text-muted-foreground">Routine</p><p className="mt-2 font-semibold">{details.name || "Untitled"}</p></div>
            <div className="rounded-xl border bg-card p-4 shadow-soft"><p className="text-xs font-medium uppercase text-muted-foreground">Structure</p><p className="mt-2 font-semibold">{details.routineType === "gym" ? "Gym workout" : details.routineType === "circuit" ? `${details.defaultCycles} cycles` : "Exercise-specific"}</p></div>
            <div className="rounded-xl border bg-card p-4 shadow-soft"><p className="text-xs font-medium uppercase text-muted-foreground">Exercises</p><p className="mt-2 font-semibold">{items.length}</p></div>
          </div>
          <div className="grid gap-4">
            {routinePhases.map((phase) => {
              const phaseItems = items.filter((item) => item.phase === phase.id);
              const guidance = phase.id === "warmup"
                ? details.warmupNotes
                : phase.id === "main"
                  ? details.workoutNotes
                  : details.cooldownNotes;
              if (!phaseItems.length && !guidance) return null;
              return (
                <section key={phase.id} className="overflow-hidden rounded-xl border bg-card shadow-soft">
                  <div className="border-b bg-background-secondary px-4 py-3">
                    <h3 className="font-semibold">{phase.label}</h3>
                    {guidance ? <p className="mt-1 text-sm text-muted-foreground">{guidance}</p> : null}
                  </div>
                  <ol className="divide-y">
                    {phaseItems.map((item, index) => {
                      const exercise = getExercise(item);
                      return <li key={item.id} className="flex items-center gap-3 p-3"><span className="w-6 text-center text-sm font-medium text-muted-foreground">{index + 1}</span><ExerciseThumb src={exercise?.thumbnail_url} alt={exercise?.name ?? "Exercise"} className="h-12 w-16" /><span className="min-w-0 flex-1 truncate font-medium">{exercise?.name ?? "Exercise"}</span><span className="text-xs text-muted-foreground">{details.routineType === "gym" && phase.id === "main" ? `${item.sets} sets · ` : ""}{item.reps}</span></li>;
                    })}
                    {!phaseItems.length ? <li className="p-4 text-sm text-muted-foreground">Guidance only — no individual exercises.</li> : null}
                  </ol>
                </section>
              );
            })}
          </div>
          {status === "draft" ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <h3 className="font-semibold">Ready to publish?</h3>
              <p className="mt-1 text-sm text-muted-foreground">Publishing makes this routine available for trainee assignment. At least one Main workout exercise is required.</p>
              <Button type="button" className="mt-4" disabled={isPending || !items.some((item) => item.phase === "main") || !details.name.trim() || detailSaveStatus !== "saved" || hasUnsavedConfig} onClick={publish}>
                {isPending ? <Spinner className="h-4 w-4" label="Publishing routine" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                {isPending ? "Publishing routine..." : "Publish and continue"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
              <span className="inline-flex items-center gap-2 font-medium"><CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />Routine is published</span>
              <Button type="button" onClick={() => navigateToStep("assign")}>Continue to assignment</Button>
            </div>
          )}
          <div className="flex justify-start border-t pt-4"><Button type="button" variant="ghost" onClick={() => navigateToStep("configure")}>Back</Button></div>
        </section>
      ) : null}

      {step === "assign" && status === "published" ? (
        <section>
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Assign trainees</h2>
            <p className="mt-1 text-sm text-muted-foreground">This step is optional. You can return and assign more trainees later.</p>
          </div>
          <BulkAssignRoutineForm routineId={routine.id} routineName={details.name} routineDescription={details.description || null} trainees={trainees} />
        </section>
      ) : null}

      {actionError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{actionError}</div>
      ) : null}

      {status === "draft" ? (
        <section className="border-t pt-6">
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setIsDiscardOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Discard draft
          </Button>
        </section>
      ) : null}

      <Modal open={isDiscardOpen} onOpenChange={(open) => !isPending && setIsDiscardOpen(open)} title={`Discard ${details.name || "this draft"}?`} description="The routine draft and its configuration will be permanently removed.">
        <div className="grid gap-5 p-5">
          <p className="text-sm text-muted-foreground">Exercises created while building this routine will remain available in your exercise library.</p>
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => setIsDiscardOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" disabled={isPending} onClick={discardDraft}>
              {isPending ? <Spinner className="h-4 w-4" label="Discarding draft" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              {isPending ? "Discarding draft..." : "Discard draft"}
            </Button>
          </div>
        </div>
      </Modal>

      <Toast open={toast.open} onOpenChange={(open) => setToast((current) => ({ ...current, open }))} title={toast.title} description={toast.description} variant="success" />
    </div>
  );
}
