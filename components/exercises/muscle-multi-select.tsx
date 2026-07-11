"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type MuscleMultiSelectProps = {
  name: string;
  options: string[];
  defaultValue?: string[];
};

export function MuscleMultiSelect({
  name,
  options,
  defaultValue = []
}: MuscleMultiSelectProps) {
  const [selected, setSelected] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const availableOptions = options.filter((option) => !selected.includes(option));

  function addOption(option: string) {
    setSelected((current) => [...current, option]);
    setIsOpen(false);
  }

  function removeOption(option: string) {
    setSelected((current) => current.filter((item) => item !== option));
  }

  return (
    <div ref={containerRef} className="relative">
      {selected.map((muscle) => (
        <input key={muscle} type="hidden" name={name} value={muscle} />
      ))}
      <div
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-left text-sm shadow-soft outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15",
          !selected.length && "text-muted-foreground"
        )}
        tabIndex={-1}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="flex flex-1 flex-wrap gap-2">
          {selected.length ? (
            selected.map((muscle) => (
              <span
                key={muscle}
                className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-1 text-xs font-medium text-foreground"
              >
                {muscle}
                <button
                  type="button"
                  aria-label={`Remove ${muscle}`}
                  className="rounded-full p-0.5 text-muted-foreground transition hover:bg-white hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeOption(muscle);
                  }}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))
          ) : (
            <span>Select muscles</span>
          )}
        </span>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
          aria-label="Open primary muscle options"
          aria-expanded={isOpen}
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen((current) => !current);
          }}
        >
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
      {isOpen ? (
        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-md border bg-white p-1 text-sm shadow-soft">
          {availableOptions.length ? (
            availableOptions.map((option) => (
              <button
                key={option}
                type="button"
                className="flex w-full items-center rounded-md px-3 py-2 text-left transition hover:bg-muted"
                onClick={() => addOption(option)}
              >
                {option}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-muted-foreground">All muscles selected.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
