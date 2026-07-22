"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import { ExerciseThumb } from "@/components/exercises/exercise-thumb";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { removeRoutineExerciseAction, reorderRoutineExercisesAction } from "@/lib/actions/routines";

type RoutineExercise = {
  id: string;
  reps: string;
  rest_seconds: number | null;
  notes: string | null;
  position: number;
  exercises:
    | {
        name: string;
        category: string | null;
        difficulty: number | null;
        thumbnail_url: string | null;
      }
    | {
        name: string;
        category: string | null;
        difficulty: number | null;
        thumbnail_url: string | null;
      }[]
    | null;
};

type RoutineExerciseListProps = {
  routineId: string;
  routineExercises: RoutineExercise[];
};

function moveItem(items: RoutineExercise[], fromId: string, toId: string) {
  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return items;

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function RoutineExerciseList({ routineId, routineExercises }: RoutineExerciseListProps) {
  const [items, setItems] = useState(routineExercises);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(routineExercises);
  }, [routineExercises]);

  function persistOrder(nextItems: RoutineExercise[]) {
    setItems(nextItems);
    startTransition(async () => {
      await reorderRoutineExercisesAction(
        routineId,
        nextItems.map((item) => item.id)
      );
    });
  }

  function moveByOffset(itemId: string, offset: number) {
    const fromIndex = items.findIndex((item) => item.id === itemId);
    const targetItem = items[fromIndex + offset];

    if (fromIndex === -1 || !targetItem) return;
    persistOrder(moveItem(items, itemId, targetItem.id));
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-muted-foreground shadow-soft">
        No exercises yet. Choose one from the list to build this routine.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <ol className="grid gap-3 md:hidden">
        {items.map((item, index) => {
          const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;

          return (
            <li key={item.id} className="rounded-lg border bg-white p-3 shadow-soft">
              <div className="flex gap-3">
                <ExerciseThumb
                  src={exercise?.thumbnail_url}
                  alt={exercise?.name ?? "Exercise"}
                  className="h-20 w-24 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{exercise?.name ?? "Exercise"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Exercise {index + 1} · Difficulty {exercise?.difficulty ?? "?"}
                      </p>
                    </div>
                    <form action={removeRoutineExerciseAction.bind(null, routineId, item.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        className="h-8 w-8 px-0"
                        aria-label={`Remove ${exercise?.name ?? "exercise"}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </form>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md bg-muted px-2.5 py-1.5">
                      <span className="text-muted-foreground">Reps:</span> {item.reps}
                    </span>
                    <span className="rounded-md bg-muted px-2.5 py-1.5">
                      <span className="text-muted-foreground">Rest:</span>{" "}
                      {item.rest_seconds ? `${item.rest_seconds}s` : "Not set"}
                    </span>
                  </div>
                </div>
              </div>
              {item.notes ? (
                <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{item.notes}</p>
              ) : null}
              <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                <span className="mr-auto text-xs text-muted-foreground">Change order</span>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 w-9 px-0"
                  aria-label={`Move ${exercise?.name ?? "exercise"} up`}
                  disabled={index === 0 || isPending}
                  onClick={() => moveByOffset(item.id, -1)}
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 w-9 px-0"
                  aria-label={`Move ${exercise?.name ?? "exercise"} down`}
                  disabled={index === items.length - 1 || isPending}
                  onClick={() => moveByOffset(item.id, 1)}
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="hidden md:block">
        <Table className="min-w-[760px]">
          <thead>
            <tr>
              <Th className="w-12"><span className="sr-only">Move</span></Th>
              <Th className="w-16">Order</Th>
              <Th>Exercise</Th>
              <Th>Reps</Th>
              <Th>Rest</Th>
              <Th>Notes</Th>
              <Th className="w-20"><span className="sr-only">Remove</span></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;

              return (
                <tr
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    setDraggedId(item.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const droppedId = event.dataTransfer.getData("text/plain") || draggedId;
                    if (!droppedId || droppedId === item.id) return;
                    persistOrder(moveItem(items, droppedId, item.id));
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  className={draggedId === item.id ? "opacity-50" : undefined}
                >
                  <Td className="w-12">
                    <span className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground active:cursor-grabbing">
                      <GripVertical className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Drag to reorder</span>
                    </span>
                  </Td>
                  <Td className="font-medium text-muted-foreground">{index + 1}</Td>
                  <Td>
                    <div className="flex min-w-52 items-center gap-3">
                      <ExerciseThumb
                        src={exercise?.thumbnail_url}
                        alt={exercise?.name ?? "Exercise"}
                        className="h-14 w-20"
                      />
                      <div>
                        <p className="font-medium">{exercise?.name ?? "Exercise"}</p>
                        <p className="text-xs text-muted-foreground">
                          Difficulty {exercise?.difficulty ?? "?"}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td className="font-medium">{item.reps}</Td>
                  <Td>{item.rest_seconds ? `${item.rest_seconds}s` : "Not set"}</Td>
                  <Td className="max-w-64 text-muted-foreground">{item.notes ?? "No notes"}</Td>
                  <Td>
                    <form action={removeRoutineExerciseAction.bind(null, routineId, item.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        className="h-8 w-8 px-0"
                        aria-label={`Remove ${exercise?.name ?? "exercise"}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </form>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      {isPending ? (
        <p className="text-xs text-muted-foreground" role="status">Saving exercise order...</p>
      ) : null}
    </div>
  );
}
