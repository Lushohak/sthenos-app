"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  Flag,
  Maximize2,
  PlayCircle,
  Trophy,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import {
  createTraineeWorkoutLogAction,
  type TraineeWorkoutLogState
} from "@/lib/actions/trainee";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Toast } from "@/components/ui/toast";

export type WorkoutPlayerExercise = {
  id: string;
  name: string;
  category: string | null;
  equipment: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  sets: number;
  reps: string;
  restSeconds: number | null;
  notes: string | null;
};

type WorkoutPlayerProps = {
  assignmentId: string;
  routineId: string;
  routineName: string;
  routineDescription: string | null;
  assignmentNotes: string | null;
  routineType: "circuit" | "individual" | "gym";
  defaultCycles: number;
  exercises: WorkoutPlayerExercise[];
  today: string;
};

type WorkoutPhase = "exercise" | "rest" | "summary";

type SavedWorkout = {
  signature: string;
  stepIndex: number;
  phase: WorkoutPhase;
  startedAt: number;
  restEndsAt: number | null;
};

const initialActionState: TraineeWorkoutLogState = {
  status: "idle",
  message: ""
};

const WORKOUT_SOUND_STORAGE_KEY = "sthenos:workout-sound-enabled";

function getLocalDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function WorkoutPlayer({
  assignmentId,
  routineId,
  routineName,
  routineDescription,
  assignmentNotes,
  routineType,
  defaultCycles,
  exercises,
  today
}: WorkoutPlayerProps) {
  const cycleCount = routineType === "circuit" ? Math.max(defaultCycles, 1) : 1;
  const workoutSteps = useMemo(() => {
    if (routineType === "gym") {
      return exercises.flatMap((exercise, exerciseIndex) =>
        Array.from({ length: Math.max(exercise.sets, 1) }, (_, setIndex) => ({
          exercise,
          exerciseIndex,
          round: 1,
          setNumber: setIndex + 1,
          totalSets: Math.max(exercise.sets, 1)
        }))
      );
    }

    return Array.from({ length: cycleCount }, (_, roundIndex) =>
      exercises.map((exercise, exerciseIndex) => ({
        exercise,
        exerciseIndex,
        round: roundIndex + 1,
        setNumber: 1,
        totalSets: 1
      }))
    ).flat();
  }, [cycleCount, exercises, routineType]);
  const totalSteps = workoutSteps.length;
  const storageKey = `sthenos:workout:${assignmentId}`;
  const signature = useMemo(
    () =>
      `${routineId}:${routineType}:${workoutSteps
        .map((step) => `${step.exercise.id}:${step.setNumber}:${step.round}`)
        .join(",")}`,
    [routineId, routineType, workoutSteps]
  );
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasPlayedRestChimeRef = useRef(false);
  const [phase, setPhase] = useState<WorkoutPhase>("exercise");
  const [stepIndex, setStepIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  const [hasRestored, setHasRestored] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isQuickCompleteModalOpen, setIsQuickCompleteModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [localToday, setLocalToday] = useState(today);
  const [trainingDate, setTrainingDate] = useState(today);
  const [actionState, formAction, isPending] = useActionState(
    createTraineeWorkoutLogAction.bind(null, assignmentId),
    initialActionState
  );

  const currentStep = workoutSteps[stepIndex];
  const exerciseIndex = currentStep?.exerciseIndex ?? 0;
  const round = currentStep?.round ?? 1;
  const currentExercise = currentStep?.exercise;
  const nextStepIndex = Math.min(stepIndex + 1, Math.max(totalSteps - 1, 0));
  const nextStep = workoutSteps[nextStepIndex];
  const nextExercise = nextStep?.exercise;
  const completedSteps =
    phase === "summary"
      ? totalSteps
      : phase === "rest"
        ? Math.min(stepIndex + 1, totalSteps)
        : stepIndex;
  const progressPercentage = totalSteps
    ? Math.round((completedSteps / totalSteps) * 100)
    : 0;
  const elapsedMinutes = Math.max(
    1,
    Math.round((Date.now() - startedAt) / 60_000)
  );

  const getOrCreateAudioContext = useCallback(() => {
    const currentContext = audioContextRef.current;
    if (currentContext && currentContext.state !== "closed") {
      return currentContext;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextConstructor) return null;

    const context = new AudioContextConstructor();
    audioContextRef.current = context;
    return context;
  }, []);

  const unlockWorkoutAudio = useCallback(() => {
    if (!isSoundEnabled) return;

    const context = getOrCreateAudioContext();
    if (context?.state === "suspended") {
      void context.resume().catch(() => {
        // The visual timer remains the fallback when a browser blocks audio.
      });
    }
  }, [getOrCreateAudioContext, isSoundEnabled]);

  const playRestCompleteChime = useCallback(() => {
    if (!isSoundEnabled) return;

    const context = getOrCreateAudioContext();
    if (!context) return;

    function scheduleBell() {
      if (!context || context.state !== "running") return;

      const strikeTime = context.currentTime + 0.02;
      const masterGain = context.createGain();
      const strikeOffsets = [0, 0.34, 0.68];
      const bellPartials = [
        { frequency: 988, volume: 0.24, decay: 0.78 },
        { frequency: 1985, volume: 0.16, decay: 0.67 },
        { frequency: 2696, volume: 0.11, decay: 0.53 },
        { frequency: 3902, volume: 0.075, decay: 0.4 },
        { frequency: 5117, volume: 0.05, decay: 0.3 },
        { frequency: 6362, volume: 0.035, decay: 0.22 }
      ];

      masterGain.gain.setValueAtTime(0.85, strikeTime);
      masterGain.gain.setValueAtTime(0.85, strikeTime + 1.3);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + 1.55);
      masterGain.connect(context.destination);

      // Inharmonic partials give the synthesized tone a metallic bell character.
      strikeOffsets.forEach((offset) => {
        const currentStrikeTime = strikeTime + offset;

        bellPartials.forEach(({ frequency, volume, decay }) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();

          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(
            frequency * 1.012,
            currentStrikeTime
          );
          oscillator.frequency.exponentialRampToValueAtTime(
            frequency,
            currentStrikeTime + 0.035
          );
          gain.gain.setValueAtTime(0.0001, currentStrikeTime);
          gain.gain.exponentialRampToValueAtTime(
            volume,
            currentStrikeTime + 0.004
          );
          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            currentStrikeTime + decay
          );
          oscillator.connect(gain);
          gain.connect(masterGain);
          oscillator.start(currentStrikeTime);
          oscillator.stop(currentStrikeTime + decay + 0.05);
        });
      });
    }

    if (context.state === "suspended") {
      void context
        .resume()
        .then(scheduleBell)
        .catch(() => {
          // The visual timer remains the fallback when a browser blocks audio.
        });
      return;
    }

    scheduleBell();
  }, [getOrCreateAudioContext, isSoundEnabled]);

  useEffect(() => {
    try {
      const savedPreference = window.localStorage.getItem(
        WORKOUT_SOUND_STORAGE_KEY
      );
      if (savedPreference !== null) {
        setIsSoundEnabled(savedPreference === "true");
      }
    } catch {
      // Sound defaults to on when preferences cannot be persisted.
    }

    return () => {
      const context = audioContextRef.current;
      if (context && context.state !== "closed") {
        void context.close();
      }
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const currentLocalDate = getLocalDateValue();
    setLocalToday(currentLocalDate);
    setTrainingDate(currentLocalDate);

    try {
      const savedValue = window.localStorage.getItem(storageKey);
      if (!savedValue) return;

      const saved = JSON.parse(savedValue) as SavedWorkout;
      if (
        saved.signature !== signature ||
        !Number.isInteger(saved.stepIndex) ||
        saved.stepIndex < 0 ||
        saved.stepIndex >= totalSteps ||
        !["exercise", "rest", "summary"].includes(saved.phase) ||
        !Number.isFinite(saved.startedAt) ||
        saved.startedAt <= 0 ||
        saved.startedAt > Date.now()
      ) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      setStepIndex(saved.stepIndex);
      setStartedAt(saved.startedAt);

      if (saved.phase === "rest" && saved.restEndsAt) {
        if (saved.restEndsAt > Date.now()) {
          setPhase("rest");
          setRestEndsAt(saved.restEndsAt);
          setRestSecondsRemaining(
            Math.ceil((saved.restEndsAt - Date.now()) / 1000)
          );
        } else {
          setStepIndex(Math.min(saved.stepIndex + 1, totalSteps - 1));
          setPhase("exercise");
        }
      } else {
        setPhase(saved.phase);
      }
    } catch {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Resume is an enhancement; the workout remains usable without storage.
      }
    } finally {
      setHasRestored(true);
    }
  }, [signature, storageKey, totalSteps]);

  useEffect(() => {
    if (!hasRestored || !totalSteps || actionState.status === "success") return;

    const savedWorkout: SavedWorkout = {
      signature,
      stepIndex,
      phase,
      startedAt,
      restEndsAt
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(savedWorkout));
    } catch {
      // Resume is an enhancement; the workout remains usable without storage.
    }
  }, [
    actionState.status,
    hasRestored,
    phase,
    restEndsAt,
    signature,
    startedAt,
    stepIndex,
    storageKey,
    totalSteps
  ]);

  useEffect(() => {
    if (phase !== "rest" || !restEndsAt) return;

    function updateTimer() {
      const remaining = Math.max(
        0,
        Math.ceil(((restEndsAt ?? Date.now()) - Date.now()) / 1000)
      );
      setRestSecondsRemaining(remaining);

      if (remaining === 0) {
        if (!hasPlayedRestChimeRef.current) {
          hasPlayedRestChimeRef.current = true;
          playRestCompleteChime();
        }
        setStepIndex((current) => Math.min(current + 1, totalSteps - 1));
        setRestEndsAt(null);
        setPhase("exercise");
      }
    }

    updateTimer();
    const intervalId = window.setInterval(updateTimer, 250);
    return () => window.clearInterval(intervalId);
  }, [phase, playRestCompleteChime, restEndsAt, totalSteps]);

  useEffect(() => {
    if (actionState.status !== "success") return;

    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // The completed workout is already persisted in Supabase.
    }
    setIsQuickCompleteModalOpen(false);
    setIsToastOpen(true);
  }, [actionState.status, storageKey]);

  function advanceAfterRest() {
    hasPlayedRestChimeRef.current = true;
    setStepIndex((current) => Math.min(current + 1, totalSteps - 1));
    setRestEndsAt(null);
    setRestSecondsRemaining(0);
    setPhase("exercise");
  }

  function handleExerciseDone() {
    if (!currentExercise) return;
    unlockWorkoutAudio();

    if (stepIndex >= totalSteps - 1) {
      setPhase("summary");
      return;
    }

    if (currentExercise.restSeconds && currentExercise.restSeconds > 0) {
      hasPlayedRestChimeRef.current = false;
      const endTime = Date.now() + currentExercise.restSeconds * 1000;
      setRestEndsAt(endTime);
      setRestSecondsRemaining(currentExercise.restSeconds);
      setPhase("rest");
      return;
    }

    setStepIndex((current) => current + 1);
  }

  function handlePrevious() {
    if (phase === "summary") {
      setStepIndex(Math.max(totalSteps - 1, 0));
      setPhase("exercise");
      return;
    }

    if (phase === "rest") {
      hasPlayedRestChimeRef.current = true;
      setRestEndsAt(null);
      setPhase("exercise");
      return;
    }

    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function toggleWorkoutSound() {
    const nextValue = !isSoundEnabled;
    setIsSoundEnabled(nextValue);

    try {
      window.localStorage.setItem(
        WORKOUT_SOUND_STORAGE_KEY,
        String(nextValue)
      );
    } catch {
      // The setting still applies for the current workout.
    }

    if (nextValue) {
      const context = getOrCreateAudioContext();
      if (context?.state === "suspended") {
        void context.resume().catch(() => {
          // The visual timer remains the fallback when a browser blocks audio.
        });
      }
    }
  }

  if (!exercises.length) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border border-dashed bg-card p-8 text-center shadow-soft">
        <Flag className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-semibold">This workout is not ready yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your coach needs to add at least one exercise before you can begin.
        </p>
        <LinkButton href="/trainee" className="mt-5">
          Back to routines
        </LinkButton>
      </section>
    );
  }

  if (actionState.status === "success") {
    return (
      <>
        <section className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-center shadow-soft sm:p-8">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <Trophy className="h-8 w-8" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">Workout saved</h1>
          <p className="mt-2 text-muted-foreground">
            Nice work completing {routineName}. Your coach can now see this session.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <LinkButton href="/trainee">Back to routines</LinkButton>
            <LinkButton href="/trainee/progress" variant="secondary">
              View progress
            </LinkButton>
          </div>
        </section>
        <Toast
          open={isToastOpen}
          onOpenChange={setIsToastOpen}
          title="Workout completed"
          description="Your session was added to your workout history."
          variant="success"
        />
      </>
    );
  }

  return (
    <>
      <section className="mx-auto max-w-3xl pb-24 sm:pb-0">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">
              {phase === "summary"
                ? "Ready to finish"
                : routineType === "circuit"
                  ? `Round ${round} of ${cycleCount}`
                  : routineType === "gym" && currentStep
                    ? `Set ${currentStep.setNumber} of ${currentStep.totalSets}`
                  : `Exercise ${stepIndex + 1} of ${totalSteps}`}
            </p>
            <h1 className="truncate text-xl font-semibold sm:text-2xl">{routineName}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              className="px-3"
              aria-label={
                isSoundEnabled
                  ? "Turn rest timer sound off"
                  : "Turn rest timer sound on"
              }
              aria-pressed={isSoundEnabled}
              onClick={toggleWorkoutSound}
            >
              {isSoundEnabled ? (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {isSoundEnabled ? "Sound on" : "Sound off"}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="px-3"
              disabled={isPending}
              onClick={() => setIsExitModalOpen(true)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Exit
            </Button>
          </div>
        </div>

        {phase !== "summary" ? (
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => setIsQuickCompleteModalOpen(true)}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Complete workout
            </Button>
          </div>
        ) : null}

        <div
          className="mb-5 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Workout progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercentage}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {phase === "exercise" && currentExercise ? (
          <>
            <div
              key={`${stepIndex}-${currentExercise.id}`}
              className="touch-pan-y overflow-hidden rounded-xl border bg-card shadow-soft"
              onTouchStart={(event) => {
                const touch = event.changedTouches[0];
                touchStart.current = touch
                  ? { x: touch.clientX, y: touch.clientY }
                  : null;
              }}
              onTouchEnd={(event) => {
                const start = touchStart.current;
                const touch = event.changedTouches[0];
                touchStart.current = null;
                if (!start || !touch) return;

                const distanceX = touch.clientX - start.x;
                const distanceY = touch.clientY - start.y;
                const isHorizontalGesture =
                  Math.abs(distanceX) > 70 &&
                  Math.abs(distanceX) > Math.abs(distanceY) * 1.2;

                if (!isHorizontalGesture) return;
                if (distanceX < 0) handleExerciseDone();
                if (distanceX > 0 && stepIndex > 0) handlePrevious();
              }}
            >
              <div className="p-4 sm:p-6" aria-live="polite">
              <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  Exercise {exerciseIndex + 1} of {exercises.length}
                </span>
                {routineType === "circuit" ? (
                  <span>Round {round} of {cycleCount}</span>
                ) : routineType === "gym" && currentStep ? (
                  <span>Set {currentStep.setNumber} of {currentStep.totalSets}</span>
                ) : null}
              </div>
              {currentExercise.thumbnailUrl ? (
                <button
                  type="button"
                  className="group relative block w-full overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  aria-label={`View the full image for ${currentExercise.name}`}
                  aria-haspopup="dialog"
                  onClick={() => setIsImageModalOpen(true)}
                >
                  <ExerciseThumb
                    src={currentExercise.thumbnailUrl}
                    alt={currentExercise.name}
                    className="aspect-video h-52 w-full transition group-hover:brightness-90 sm:h-72"
                  />
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm">
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    View full image
                  </span>
                </button>
              ) : (
                <ExerciseThumb
                  src={null}
                  alt={currentExercise.name}
                  className="aspect-video h-52 w-full sm:h-72"
                />
              )}
              <div className="mt-5 text-center">
                <h2 className="text-2xl font-semibold">{currentExercise.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[currentExercise.category, currentExercise.equipment]
                    .filter(Boolean)
                    .join(" · ") || "No equipment details"}
                </p>
              </div>
              <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/60 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Reps
                  </p>
                  <p className="mt-1 text-xl font-semibold">{currentExercise.reps}</p>
                </div>
                <div className="rounded-lg bg-muted/60 p-4 text-center">
                  <p className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Rest
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {currentExercise.restSeconds
                      ? `${currentExercise.restSeconds}s`
                      : "None"}
                  </p>
                </div>
              </div>
              {currentExercise.notes ? (
                <div className="mx-auto mt-4 max-w-xl rounded-lg border border-info/30 bg-info/5 p-4 text-sm">
                  <span className="font-medium">Coach instruction:</span>{" "}
                  {currentExercise.notes}
                </div>
              ) : null}
              {currentExercise.videoUrl ? (
                <a
                  href={currentExercise.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mx-auto mt-4 flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-border-emphasis bg-elevated px-4 text-sm font-medium text-info transition-colors hover:border-secondary hover:bg-secondary/20"
                >
                  <PlayCircle className="h-4 w-4" aria-hidden="true" />
                  Watch demo
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
              </div>
            </div>
            <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 shadow-2xl backdrop-blur sm:static sm:mt-4 sm:rounded-xl sm:border sm:shadow-soft">
              <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={stepIndex === 0}
                  onClick={handlePrevious}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Swipe or use the controls
                </p>
                <Button type="button" onClick={handleExerciseDone}>
                  {stepIndex === totalSteps - 1 ? (
                    <Flag className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  )}
                  {stepIndex === totalSteps - 1 ? "Finish exercises" : "Done — Next"}
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {phase === "rest" ? (
          <div className="rounded-xl border bg-card p-6 text-center shadow-soft sm:p-10">
            <Clock3 className="mx-auto h-9 w-9 text-warning" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {routineType === "gym" ? "Rest before the next set" : "Rest before the next exercise"}
            </p>
            <p className="mt-3 text-6xl font-semibold tabular-nums">
              {formatTimer(restSecondsRemaining)}
            </p>
            {nextExercise ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Up next:{" "}
                <span className="font-medium text-foreground">
                  {routineType === "gym" && nextStep
                    ? `${nextExercise.name} · Set ${nextStep.setNumber} of ${nextStep.totalSets}`
                    : nextExercise.name}
                </span>
              </p>
            ) : null}
            <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <Button type="button" variant="secondary" onClick={handlePrevious}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </Button>
              <Button type="button" onClick={advanceAfterRest}>
                Skip rest
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "summary" ? (
          <div className="rounded-xl border bg-card p-5 shadow-soft sm:p-7">
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <Trophy className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-2xl font-semibold">Workout complete</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Review the session, add an optional note, then save it for your coach.
              </p>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/60 p-4 text-center">
                <dt className="text-xs font-medium text-muted-foreground">
                  {routineType === "gym" ? "Total sets" : "Exercises"}
                </dt>
                <dd className="mt-1 text-lg font-semibold">{totalSteps}</dd>
              </div>
              <div className="rounded-lg bg-muted/60 p-4 text-center">
                <dt className="text-xs font-medium text-muted-foreground">
                  {routineType === "gym" ? "Exercises" : "Rounds"}
                </dt>
                <dd className="mt-1 text-lg font-semibold">
                  {routineType === "gym" ? exercises.length : cycleCount}
                </dd>
              </div>
              <div className="col-span-2 rounded-lg bg-muted/60 p-4 text-center sm:col-span-1">
                <dt className="text-xs font-medium text-muted-foreground">Time</dt>
                <dd className="mt-1 text-lg font-semibold">~{elapsedMinutes} min</dd>
              </div>
            </dl>
            {routineDescription || assignmentNotes ? (
              <div className="mt-5 rounded-lg border p-4 text-sm text-muted-foreground">
                {assignmentNotes ?? routineDescription}
              </div>
            ) : null}
            <form action={formAction} className="mt-6 grid gap-4">
              <input
                type="hidden"
                name="duration_minutes"
                value={elapsedMinutes}
              />
              <Field label="Training date">
                <Input
                  name="trained_on"
                  type="date"
                  value={trainingDate}
                  max={localToday}
                  onChange={(event) => setTrainingDate(event.target.value)}
                  required
                />
              </Field>
              <Field label="How did it feel?" hint="Optional — add anything your coach should know.">
                <Textarea
                  name="notes"
                  placeholder="Energy, difficulty, pain, or a personal best..."
                />
              </Field>
              {actionState.status === "error" ? (
                <p
                  className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {actionState.message}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending}
                  onClick={handlePrevious}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to workout
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isPending ? "Saving workout..." : "Finish and save workout"}
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      <Modal
        open={isQuickCompleteModalOpen}
        onOpenChange={(open) => {
          if (!isPending) setIsQuickCompleteModalOpen(open);
        }}
        title="Complete this workout?"
        description="Skip the guided steps and add the completed workout directly to your history."
      >
        <form action={formAction} className="grid gap-4 p-5">
          <Field label="Training date">
            <Input
              name="trained_on"
              type="date"
              value={trainingDate}
              max={localToday}
              onChange={(event) => setTrainingDate(event.target.value)}
              required
            />
          </Field>
          <Field
            label="Duration in minutes"
            hint="Optional — enter the approximate workout time."
          >
            <Input
              name="duration_minutes"
              type="number"
              min={1}
              max={1440}
              inputMode="numeric"
              placeholder="e.g. 60"
            />
          </Field>
          <Field
            label="Completion notes"
            hint="Optional — add anything your coach should know."
          >
            <Textarea
              name="notes"
              placeholder="Energy, difficulty, pain, or a personal best..."
            />
          </Field>
          {actionState.status === "error" ? (
            <p
              className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {actionState.message}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setIsQuickCompleteModalOpen(false)}
            >
              Keep working out
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              {isPending ? "Saving workout..." : "Save completed workout"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={isImageModalOpen}
        onOpenChange={setIsImageModalOpen}
        title={currentExercise?.name ?? "Exercise image"}
        description="Full exercise reference image"
        className="max-w-6xl"
      >
        {currentExercise?.thumbnailUrl ? (
          <>
            <div className="flex min-h-0 items-center justify-center overflow-auto bg-muted/30 p-3 sm:p-6">
              <img
                src={currentExercise.thumbnailUrl}
                alt={currentExercise.name}
                className="block h-auto max-h-[calc(100dvh-13rem)] w-auto max-w-full object-contain"
              />
            </div>
            <div className="flex justify-end border-t p-4">
              <Button type="button" onClick={() => setIsImageModalOpen(false)}>
                Return to workout
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        open={isExitModalOpen}
        onOpenChange={(open) => {
          if (!isPending) setIsExitModalOpen(open);
        }}
        title="Leave this workout?"
        description="Your current exercise and round are saved on this device, so you can resume later."
      >
        <div className="flex flex-col-reverse gap-2 p-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsExitModalOpen(false)}
          >
            Continue workout
          </Button>
          <LinkButton href="/trainee" variant="secondary">
            Leave workout
          </LinkButton>
        </div>
      </Modal>
    </>
  );
}
