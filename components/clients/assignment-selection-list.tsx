"use client";

import { Archive } from "lucide-react";
import { cn } from "@/lib/utils";

export type CompactAssignmentItem = {
  id: string;
  name: string;
  archived: boolean;
  notes?: string | null;
};

export function AssignmentSelectionList({
  label,
  items,
  selectedIds,
  onSelectionChange,
  disabledArchived = false,
  emptyMessage
}: {
  label: string;
  items: CompactAssignmentItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabledArchived?: boolean;
  emptyMessage: string;
}) {
  function toggle(id: string) {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id]
    );
  }

  if (!items.length) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{label}</legend>
      {items.map((item) => {
        const disabled = disabledArchived && item.archived;
        const selected = selectedIds.includes(item.id);
        return (
          <label
            key={item.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border bg-background-secondary p-3 transition hover:border-secondary",
              selected && "border-primary/50 bg-primary/5",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <input
              type="checkbox"
              name="assignment_ids"
              value={item.id}
              checked={selected}
              disabled={disabled}
              className="mt-1 h-4 w-4 accent-primary"
              onChange={() => toggle(item.id)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {item.name}
                {item.archived ? (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] text-muted-foreground">
                    <Archive className="h-3 w-3" aria-hidden="true" /> Archived template
                  </span>
                ) : null}
              </span>
              {item.notes ? <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{item.notes}</span> : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
