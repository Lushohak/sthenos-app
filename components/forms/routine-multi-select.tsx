"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type RoutineOption = {
  id: string;
  name: string;
  disabled?: boolean;
  disabledLabel?: string;
};

type RoutineMultiSelectProps = {
  name: string;
  options: RoutineOption[];
  placeholder?: string;
  emptyMessage?: string;
  onSelectionChange?: (selectedIds: string[]) => void;
};

export function RoutineMultiSelect({
  name,
  options,
  placeholder = "Select routines",
  emptyMessage = "No active routines are available.",
  onSelectionChange
}: RoutineMultiSelectProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectedRoutines = options.filter((option) =>
    selectedIds.includes(option.id)
  );

  function updateSelection(nextSelection: string[]) {
    setSelectedIds(nextSelection);
    onSelectionChange?.(nextSelection);
  }

  function toggleRoutine(routineId: string) {
    const option = options.find((routine) => routine.id === routineId);
    if (!option || option.disabled) return;

    const nextSelection = selectedIds.includes(routineId)
      ? selectedIds.filter((id) => id !== routineId)
      : [...selectedIds, routineId];

    updateSelection(nextSelection);
  }

  const triggerText =
    selectedRoutines.length === 0
      ? placeholder
      : selectedRoutines.length === 1
        ? selectedRoutines[0].name
        : `${selectedRoutines.length} routines selected`;

  return (
    <div ref={containerRef} className="relative">
      {selectedIds.map((routineId) => (
        <input key={routineId} type="hidden" name={name} value={routineId} />
      ))}

      <button
        type="button"
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-border-emphasis bg-background-secondary px-3 py-2 text-left text-sm text-foreground shadow-soft outline-none transition-colors hover:border-secondary focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/25 disabled:cursor-not-allowed disabled:border-border disabled:bg-elevated disabled:text-disabled-foreground",
          selectedRoutines.length === 0 && "text-muted-foreground"
        )}
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={options.length === 0}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="truncate">{triggerText}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Routine options"
          aria-multiselectable="true"
          className="absolute z-30 mt-2 max-h-72 w-full min-w-64 overflow-y-auto rounded-md border border-border-emphasis bg-elevated p-1 text-sm shadow-elevated"
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsOpen(false);
          }}
        >
          {options.length ? (
            options.map((option) => {
              const isSelected = selectedIds.includes(option.id);

              return (
                <label
                  key={option.id}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-foreground transition-colors hover:bg-muted",
                    isSelected && "bg-primary/10 text-primary",
                    option.disabled &&
                      "cursor-not-allowed text-disabled-foreground hover:bg-transparent"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed"
                    checked={isSelected}
                    disabled={option.disabled}
                    onChange={() => toggleRoutine(option.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {option.disabled ? (
                    <span className="shrink-0 text-xs">
                      {option.disabledLabel ?? "Already assigned"}
                    </span>
                  ) : null}
                </label>
              );
            })
          ) : (
            <p className="px-3 py-2 text-muted-foreground">
              {emptyMessage}
            </p>
          )}

          {selectedIds.length ? (
            <div className="sticky bottom-0 mt-1 flex items-center justify-between gap-2 border-t border-border bg-elevated px-2 pt-2">
              <button
                type="button"
                className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                onClick={() => updateSelection([])}
              >
                Clear selection
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                onClick={() => setIsOpen(false)}
              >
                Done
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedRoutines.length ? (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Selected routines">
          {selectedRoutines.map((routine) => (
            <span
              key={routine.id}
              className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
            >
              {routine.name}
              <button
                type="button"
                aria-label={`Remove ${routine.name}`}
                className="rounded-full p-0.5 transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                onClick={() => toggleRoutine(routine.id)}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
