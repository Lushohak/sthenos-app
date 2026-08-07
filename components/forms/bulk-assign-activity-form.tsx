"use client";

import { CheckCircle2, Search, Users } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  bulkAssignActivityAction,
  type AssignActivityState
} from "@/lib/actions/activities";
import { parseActivityTargets, type ActivityMetricKey } from "@/lib/activities";
import { ActivityAssignmentFields } from "@/components/forms/activity-assignment-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import type { Json } from "@/types/database";

type BulkAssignActivityFormProps = {
  activity: {
    id: string;
    name: string;
    trackedMetrics: ActivityMetricKey[];
    requiredMetrics: ActivityMetricKey[];
    defaultTargets: Json;
  };
  trainees: Array<{
    id: string;
    name: string;
    email: string | null;
    existingAssignmentStatus: "active" | "paused" | null;
  }>;
};

const initialState: AssignActivityState = {
  status: "idle",
  message: "",
  assignedCount: 0,
  skippedCount: 0
};

export function BulkAssignActivityForm({
  activity,
  trainees
}: BulkAssignActivityFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [state, formAction] = useActionState(
    bulkAssignActivityAction.bind(null, activity.id),
    initialState
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return trainees;
    return trainees.filter((trainee) =>
      [trainee.name, trainee.email]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalized))
    );
  }, [query, trainees]);
  const selectableIds = filtered
    .filter((trainee) => !trainee.existingAssignmentStatus)
    .map((trainee) => trainee.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    if (state.status !== "success") return;
    formRef.current?.reset();
    setSelectedIds(new Set());
    setIsToastOpen(true);
  }, [state]);

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }

  return (
    <>
      <form ref={formRef} action={formAction} className="grid gap-5">
        <section className="overflow-hidden rounded-xl border bg-card shadow-soft">
          <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-2">
              <label htmlFor="activity-trainee-search" className="text-sm font-medium">
                Search active trainees
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="activity-trainee-search"
                  type="search"
                  value={query}
                  className="pl-9"
                  placeholder="Search by name or email..."
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                />
              </div>
            </div>
            <Button type="button" variant="secondary" disabled={!selectableIds.length} onClick={toggleAll}>
              {allSelected ? "Clear filtered" : "Select all filtered"}
            </Button>
          </div>
          <fieldset className="max-h-[32rem] overflow-y-auto p-4">
            <legend className="sr-only">Select trainees</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((trainee) => {
                const assigned = Boolean(trainee.existingAssignmentStatus);
                return (
                  <label
                    key={trainee.id}
                    className={assigned
                      ? "flex cursor-not-allowed items-start gap-3 rounded-lg border bg-muted/40 p-4 opacity-75"
                      : "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition hover:border-primary/60 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/15"}
                  >
                    <input
                      name="client_ids"
                      type="checkbox"
                      value={trainee.id}
                      checked={selectedIds.has(trainee.id)}
                      disabled={assigned}
                      className="mt-1 h-4 w-4 accent-primary"
                      onChange={() => toggle(trainee.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{trainee.name}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{trainee.email ?? "No email set"}</span>
                    </span>
                    {assigned ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium capitalize text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {trainee.existingAssignmentStatus}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            {!filtered.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Users className="mx-auto mb-2 h-7 w-7" aria-hidden="true" />
                No trainees match this search.
              </div>
            ) : null}
          </fieldset>
        </section>

        <ActivityAssignmentFields
          trackedMetrics={activity.trackedMetrics}
          requiredMetrics={activity.requiredMetrics}
          defaultTargets={parseActivityTargets(activity.defaultTargets)}
          notesLabel="Shared assignment note"
        />

        {state.status === "error" ? (
          <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedIds.size}</span> {selectedIds.size === 1 ? "trainee selected" : "trainees selected"}
          </p>
          <SubmitButton disabled={!selectedIds.size} pendingLabel="Assigning activity...">
            Assign Activity to {selectedIds.size} {selectedIds.size === 1 ? "trainee" : "trainees"}
          </SubmitButton>
        </div>
      </form>
      <Toast
        open={isToastOpen}
        onOpenChange={setIsToastOpen}
        title="Activity assigned"
        description={`${state.assignedCount} ${state.assignedCount === 1 ? "trainee received" : "trainees received"} ${activity.name}.`}
        variant="success"
      />
    </>
  );
}
