"use client";

import { useEffect, useState, useTransition } from "react";
import { GripVertical, Trash2 } from "lucide-react";
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
    startTransition(async () => {
      await reorderRoutineExercisesAction(
        routineId,
        nextItems.map((item) => item.id)
      );
    });
  }

  return (
    <div className="grid gap-2">
      <Table>
        <thead>
          <tr>
            <Th className="w-12"><span className="sr-only">Move</span></Th>
            <Th>Exercise</Th>
            <Th>Reps</Th>
            <Th>Rest</Th>
            <Th>Notes</Th>
            <Th>Remove</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
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

                  const nextItems = moveItem(items, droppedId, item.id);
                  setItems(nextItems);
                  persistOrder(nextItems);
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
                <Td>
                  <div className="flex min-w-56 items-center gap-3">
                    <ExerciseThumb src={exercise?.thumbnail_url} alt={exercise?.name ?? "Exercise"} className="h-14 w-20" />
                    <div>
                      <p className="font-medium">{exercise?.name ?? "Exercise"}</p>
                      <p className="text-xs text-muted-foreground">Difficulty {exercise?.difficulty ?? "?"}</p>
                    </div>
                  </div>
                </Td>
                <Td>{item.reps}</Td>
                <Td>{item.rest_seconds ? `${item.rest_seconds}s` : "Not set"}</Td>
                <Td>{item.notes ?? "No notes"}</Td>
                <Td>
                  <form action={removeRoutineExerciseAction.bind(null, routineId, item.id)}>
                    <Button type="submit" variant="ghost" className="h-8 w-8 px-0" aria-label={`Remove ${exercise?.name ?? "exercise"}`}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </form>
                </Td>
              </tr>
            );
          })}
          {!items.length ? (
            <tr>
              <Td colSpan={6}>No exercises yet.</Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
      {isPending ? <p className="text-xs text-muted-foreground">Saving order...</p> : null}
    </div>
  );
}
