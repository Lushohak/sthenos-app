"use client";

import { PendingLink as Link } from "@/components/ui/pending-link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type ExerciseBrowserItem = {
  id: string;
  name: string;
  category: string | null;
  difficulty: number;
  equipment: string | null;
  movementPattern: string | null;
  primaryMuscles: string[];
  thumbnailUrl: string | null;
  createdAt: string;
};

export type ExerciseSortMode = "name" | "recent" | "difficulty";

export type ExerciseFilterState = {
  query: string;
  categories: string[];
  equipment: string[];
  difficulties: string[];
  movementPatterns: string[];
  primaryMuscles: string[];
  sort: ExerciseSortMode;
};

type ExerciseBrowserProps = {
  exercises: ExerciseBrowserItem[];
  mode: "library" | "picker";
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  initialFilters?: Partial<ExerciseFilterState>;
  syncFiltersToUrl?: boolean;
};

const emptyFilters: ExerciseFilterState = {
  query: "",
  categories: [],
  equipment: [],
  difficulties: [],
  movementPatterns: [],
  primaryMuscles: [],
  sort: "name"
};

const urlKeys = [
  "q",
  "category",
  "equipment",
  "difficulty",
  "pattern",
  "muscle",
  "sort"
] as const;

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
    .sort((a, b) => a.localeCompare(b));
}

function includesAny(selected: string[], values: string[]) {
  return !selected.length || selected.some((value) => values.includes(value));
}

function FilterMenu({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOnPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md border bg-background-secondary px-3 text-sm font-medium text-foreground shadow-soft transition hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          selected.length && "border-primary/50 bg-primary/10 text-primary"
        )}
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        {selected.length ? (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
            {selected.length}
          </span>
        ) : null}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label={`${label} filters`}
          aria-multiselectable="true"
          className="absolute left-0 z-30 mt-2 max-h-72 min-w-56 overflow-y-auto rounded-md border border-border-emphasis bg-elevated p-1 text-sm shadow-elevated"
        >
          {options.map((option) => {
            const checked = selected.includes(option);
            return (
              <label
                key={option}
                role="option"
                aria-selected={checked}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition hover:bg-muted",
                  checked && "bg-primary/10 text-primary"
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={checked}
                  onChange={() => toggle(option)}
                />
                <span>{option}</span>
              </label>
            );
          })}
          {!options.length ? <p className="px-3 py-2 text-muted-foreground">No options available.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ExerciseBrowser({
  exercises,
  mode,
  selectedIds = [],
  onSelectionChange,
  initialFilters,
  syncFiltersToUrl = false
}: ExerciseBrowserProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pickerSelection, setPickerSelection] = useState<string[]>(selectedIds);
  const [filters, setFilters] = useState<ExerciseFilterState>(() => ({
    ...emptyFilters,
    ...initialFilters
  }));
  const selectedIdsKey = [...selectedIds].sort().join("\u0000");
  const options = useMemo(
    () => ({
      categories: uniqueValues(exercises.map((exercise) => exercise.category)),
      equipment: uniqueValues(exercises.map((exercise) => exercise.equipment)),
      difficulties: uniqueValues(exercises.map((exercise) => String(exercise.difficulty))).sort(
        (a, b) => Number(a) - Number(b)
      ),
      movementPatterns: uniqueValues(exercises.map((exercise) => exercise.movementPattern)),
      primaryMuscles: uniqueValues(exercises.flatMap((exercise) => exercise.primaryMuscles))
    }),
    [exercises]
  );

  useEffect(() => {
    if (!syncFiltersToUrl) return;
    const timeout = window.setTimeout(() => {
      const url = new URL(window.location.href);
      urlKeys.forEach((key) => url.searchParams.delete(key));
      if (filters.query.trim()) url.searchParams.set("q", filters.query.trim());
      if (filters.categories.length) url.searchParams.set("category", filters.categories.join(","));
      if (filters.equipment.length) url.searchParams.set("equipment", filters.equipment.join(","));
      if (filters.difficulties.length) url.searchParams.set("difficulty", filters.difficulties.join(","));
      if (filters.movementPatterns.length) url.searchParams.set("pattern", filters.movementPatterns.join(","));
      if (filters.primaryMuscles.length) url.searchParams.set("muscle", filters.primaryMuscles.join(","));
      if (filters.sort !== "name") url.searchParams.set("sort", filters.sort);
      const queryString = url.searchParams.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      const currentUrl = `${window.location.pathname}${window.location.search}`;

      if (nextUrl !== currentUrl) {
        router.replace(nextUrl, { scroll: false });
      }
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [filters, pathname, router, syncFiltersToUrl]);

  useEffect(() => {
    setPickerSelection(selectedIds);
    // The stable key avoids resetting local selection merely because a parent
    // render produced a new array with the same values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdsKey]);

  const visibleExercises = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase();
    return exercises
      .filter((exercise) => {
        const matchesQuery =
          !query ||
          [
            exercise.name,
            exercise.category,
            exercise.equipment,
            exercise.movementPattern,
            ...exercise.primaryMuscles
          ]
            .filter(Boolean)
            .some((value) => value?.toLocaleLowerCase().includes(query));
        return (
          matchesQuery &&
          includesAny(filters.categories, exercise.category ? [exercise.category] : []) &&
          includesAny(filters.equipment, exercise.equipment ? [exercise.equipment] : []) &&
          includesAny(filters.difficulties, [String(exercise.difficulty)]) &&
          includesAny(filters.movementPatterns, exercise.movementPattern ? [exercise.movementPattern] : []) &&
          includesAny(filters.primaryMuscles, exercise.primaryMuscles)
        );
      })
      .sort((a, b) => {
        if (filters.sort === "recent") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.name.localeCompare(b.name);
        }
        if (filters.sort === "difficulty") {
          return a.difficulty - b.difficulty || a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
      });
  }, [exercises, filters]);

  const activeFilters = [
    ...filters.categories.map((value) => ({ key: "categories" as const, value, label: `Category: ${value}` })),
    ...filters.equipment.map((value) => ({ key: "equipment" as const, value, label: `Equipment: ${value}` })),
    ...filters.difficulties.map((value) => ({ key: "difficulties" as const, value, label: `Difficulty: ${value}` })),
    ...filters.movementPatterns.map((value) => ({ key: "movementPatterns" as const, value, label: `Pattern: ${value}` })),
    ...filters.primaryMuscles.map((value) => ({ key: "primaryMuscles" as const, value, label: `Muscle: ${value}` }))
  ];
  const hasFilters = Boolean(filters.query.trim() || activeFilters.length || filters.sort !== "name");

  function updateFilter<Key extends keyof ExerciseFilterState>(key: Key, value: ExerciseFilterState[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function removeFilter(key: Exclude<keyof ExerciseFilterState, "query" | "sort">, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].filter((item) => item !== value)
    }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
  }

  function updateSelection(exerciseId: string, selected: boolean) {
    const next = selected
      ? Array.from(new Set([...pickerSelection, exerciseId]))
      : pickerSelection.filter((id) => id !== exerciseId);
    setPickerSelection(next);
    onSelectionChange?.(next);
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-xl border bg-card p-3 shadow-soft" aria-label="Exercise filters">
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              className="pl-9"
              value={filters.query}
              placeholder="Search exercises"
              aria-label="Search exercises"
              onChange={(event) => updateFilter("query", event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <span className="shrink-0">Sort by</span>
            <Select value={filters.sort} className="min-w-44" onChange={(event) => updateFilter("sort", event.target.value as ExerciseSortMode)}>
              <option value="name">Name</option>
              <option value="recent">Recently created</option>
              <option value="difficulty">Difficulty</option>
            </Select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters
          </span>
          <FilterMenu label="Category" options={options.categories} selected={filters.categories} onChange={(value) => updateFilter("categories", value)} />
          <FilterMenu label="Equipment" options={options.equipment} selected={filters.equipment} onChange={(value) => updateFilter("equipment", value)} />
          <FilterMenu label="Difficulty" options={options.difficulties} selected={filters.difficulties} onChange={(value) => updateFilter("difficulties", value)} />
          <FilterMenu label="Movement pattern" options={options.movementPatterns} selected={filters.movementPatterns} onChange={(value) => updateFilter("movementPatterns", value)} />
          <FilterMenu label="Primary muscles" options={options.primaryMuscles} selected={filters.primaryMuscles} onChange={(value) => updateFilter("primaryMuscles", value)} />
        </div>
        {activeFilters.length ? (
          <div className="flex flex-wrap gap-2" aria-label="Active exercise filters">
            {activeFilters.map((filter) => (
              <button
                key={`${filter.key}-${filter.value}`}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:border-primary"
                aria-label={`Remove ${filter.label}`}
                onClick={() => removeFilter(filter.key, filter.value)}
              >
                {filter.label}<X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            Showing {visibleExercises.length} of {exercises.length} exercises
          </p>
          {hasFilters ? <Button type="button" variant="ghost" className="h-8 px-2" onClick={clearFilters}>Clear all</Button> : null}
        </div>
      </section>

      <div
        role="region"
        aria-label="Exercise results"
        className={cn(mode === "picker" && "max-h-[34rem] overflow-y-auto rounded-xl border bg-card p-3")}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {visibleExercises.map((exercise) => {
            const selected = pickerSelection.includes(exercise.id);
            const content = (
              <>
                <ExerciseThumb
                  src={exercise.thumbnailUrl}
                  alt={exercise.name}
                  className="h-24 w-full bg-muted object-contain p-1 sm:h-28"
                />
                <span className="grid min-w-0 gap-1 p-2.5">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug">{exercise.name}</span>
                  <span className="flex flex-wrap gap-1 text-[0.68rem] font-medium text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">{exercise.category ?? "Uncategorized"}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">Difficulty {exercise.difficulty}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{exercise.equipment ?? "No equipment"}</span>
                </span>
              </>
            );

            return mode === "library" ? (
              <Link
                key={exercise.id}
                href={`/dashboard/exercises/${exercise.id}`}
                className="group overflow-hidden rounded-lg border bg-card shadow-soft transition hover:-translate-y-0.5 hover:border-secondary hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {content}
              </Link>
            ) : (
              <button
                type="button"
                role="checkbox"
                aria-checked={selected}
                aria-label={exercise.name}
                key={exercise.id}
                onClick={() => updateSelection(exercise.id, !selected)}
                className={cn(
                  "group relative overflow-hidden rounded-lg border bg-background-secondary text-left shadow-soft transition hover:-translate-y-0.5 hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  selected && "border-primary bg-primary/5 ring-2 ring-primary/20"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded border bg-background-secondary shadow-soft",
                    selected && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                {content}
              </button>
            );
          })}
        </div>
        {!visibleExercises.length ? (
          <div className="rounded-lg border border-dashed bg-background-secondary p-8 text-center text-sm text-muted-foreground">
            {exercises.length ? "No exercises match the current filters." : "No exercises are available yet."}
          </div>
        ) : null}
      </div>
    </div>
  );
}
