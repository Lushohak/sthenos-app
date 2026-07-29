"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { CheckCircle2, Search, Users } from "lucide-react";
import {
  bulkAssignRoutineAction,
  type BulkAssignRoutineState
} from "@/lib/actions/routines";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";

type BulkAssignableTrainee = {
  id: string;
  name: string;
  email: string | null;
  existingAssignmentStatus: "active" | "paused" | null;
};

type BulkAssignRoutineFormProps = {
  routineId: string;
  routineName: string;
  routineDescription: string | null;
  trainees: BulkAssignableTrainee[];
};

const initialState: BulkAssignRoutineState = {
  status: "idle",
  message: "",
  assignedCount: 0,
  skippedCount: 0
};

export function BulkAssignRoutineForm({
  routineId,
  routineName,
  routineDescription,
  trainees
}: BulkAssignRoutineFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [state, formAction] = useActionState(
    bulkAssignRoutineAction.bind(null, routineId),
    initialState
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTrainees = useMemo(() => {
    if (!normalizedQuery) return trainees;

    return trainees.filter((trainee) =>
      [trainee.name, trainee.email]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [normalizedQuery, trainees]);
  const selectableFilteredIds = filteredTrainees
    .filter((trainee) => !trainee.existingAssignmentStatus)
    .map((trainee) => trainee.id);
  const areAllFilteredSelected =
    selectableFilteredIds.length > 0 &&
    selectableFilteredIds.every((id) => selectedIds.has(id));
  const assignedCount = trainees.filter(
    (trainee) => trainee.existingAssignmentStatus
  ).length;

  useEffect(() => {
    const availableIds = new Set(
      trainees
        .filter((trainee) => !trainee.existingAssignmentStatus)
        .map((trainee) => trainee.id)
    );
    setSelectedIds(
      (current) => new Set([...current].filter((id) => availableIds.has(id)))
    );
  }, [trainees]);

  useEffect(() => {
    if (state.status !== "success") return;

    formRef.current?.reset();
    setSelectedIds(new Set());
    setIsToastOpen(true);
  }, [state]);

  function toggleTrainee(traineeId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(traineeId)) {
        next.delete(traineeId);
      } else {
        next.add(traineeId);
      }
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (areAllFilteredSelected) {
        selectableFilteredIds.forEach((id) => next.delete(id));
      } else {
        selectableFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  return (
    <>
      <section className="mb-5 rounded-xl border bg-white p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">{routineName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {routineDescription ?? "This routine will be added as an active assignment."}
            </p>
          </div>
        </div>
      </section>

      <form ref={formRef} action={formAction} className="grid gap-5">
        <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
          <div className="grid gap-3 border-b p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="grid gap-2">
              <label htmlFor="trainee-search" className="text-sm font-medium">
                Search active trainees
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="trainee-search"
                  type="search"
                  value={query}
                  className="pl-9"
                  placeholder="Search by name or email..."
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!selectableFilteredIds.length}
              onClick={toggleAllFiltered}
            >
              {areAllFilteredSelected ? "Clear filtered" : "Select all filtered"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <span aria-live="polite">
              Showing {filteredTrainees.length} of {trainees.length} active trainees
            </span>
            {assignedCount ? (
              <span>{assignedCount} already assigned</span>
            ) : null}
          </div>

          <fieldset className="max-h-[34rem] overflow-y-auto p-3 sm:p-4">
            <legend className="sr-only">Select trainees</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredTrainees.map((trainee) => {
                const isAssigned = Boolean(trainee.existingAssignmentStatus);
                const isSelected = selectedIds.has(trainee.id);

                return (
                  <label
                    key={trainee.id}
                    className={
                      isAssigned
                        ? "flex cursor-not-allowed items-start gap-3 rounded-lg border bg-muted/40 p-4 opacity-75"
                        : "flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-4 transition hover:border-primary/60 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/15"
                    }
                  >
                    <input
                      name="client_ids"
                      type="checkbox"
                      value={trainee.id}
                      checked={isSelected}
                      disabled={isAssigned}
                      className="mt-1 h-4 w-4 accent-primary"
                      onChange={() => toggleTrainee(trainee.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {trainee.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {trainee.email ?? "No email set"}
                      </span>
                    </span>
                    {isAssigned ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {trainee.existingAssignmentStatus === "active"
                          ? "Assigned"
                          : "Paused"}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            {!trainees.length ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 font-medium">No active trainees available</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add or reactivate trainees before assigning this routine.
                </p>
              </div>
            ) : null}
            {trainees.length && !filteredTrainees.length ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No trainees match &ldquo;{query.trim()}&rdquo;.
              </div>
            ) : null}
          </fieldset>
        </section>

        <section className="rounded-xl border bg-white p-4 shadow-soft">
          <label htmlFor="bulk-assignment-notes" className="text-sm font-medium">
            Assignment note
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional — the same note will be shared with every selected trainee.
          </p>
          <Textarea
            id="bulk-assignment-notes"
            name="notes"
            className="mt-3"
            placeholder="Add guidance for this group..."
          />
        </section>

        {state.status === "error" ? (
          <p
            className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {state.message}
          </p>
        ) : null}

        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedIds.size}</span>{" "}
            {selectedIds.size === 1 ? "trainee selected" : "trainees selected"}
          </p>
          <SubmitButton
            disabled={!selectedIds.size}
            pendingLabel="Assigning routine..."
          >
            Assign routine to {selectedIds.size}{" "}
            {selectedIds.size === 1 ? "trainee" : "trainees"}
          </SubmitButton>
        </div>
      </form>

      <Toast
        open={isToastOpen}
        onOpenChange={setIsToastOpen}
        title="Routine assigned"
        description={`${state.assignedCount} ${
          state.assignedCount === 1 ? "trainee" : "trainees"
        } received ${routineName}${
          state.skippedCount
            ? `; ${state.skippedCount} ${
                state.skippedCount === 1 ? "selection was" : "selections were"
              } skipped.`
            : "."
        }`}
        variant="success"
      />
    </>
  );
}
