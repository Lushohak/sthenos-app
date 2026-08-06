"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Eye, EyeOff, Play } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { RoutinePdfDownload } from "@/components/trainee/routine-pdf-download";
import type { RoutinePdfData } from "@/types/routine-pdf";

type WorkoutRoutineActionsProps = {
  assignmentId: string;
  canBegin: boolean;
  pdfRoutine?: RoutinePdfData;
  children: ReactNode;
};

export function WorkoutRoutineActions({
  assignmentId,
  canBegin,
  pdfRoutine,
  children
}: WorkoutRoutineActionsProps) {
  const previewId = useId();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);

  useEffect(() => {
    try {
      setHasSavedProgress(
        window.localStorage.getItem(`sthenos:workout:${assignmentId}`) !== null
      );
    } catch {
      setHasSavedProgress(false);
    }
  }, [assignmentId]);

  return (
    <>
      <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 p-4 sm:flex-row sm:justify-end sm:p-5">
        <Button
          type="button"
          variant="secondary"
          aria-expanded={isPreviewOpen}
          aria-controls={previewId}
          onClick={() => setIsPreviewOpen((open) => !open)}
        >
          {isPreviewOpen ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
          {isPreviewOpen ? "Hide preview" : "Preview workout"}
        </Button>
        {pdfRoutine ? <RoutinePdfDownload routine={pdfRoutine} /> : null}
        {canBegin ? (
          <LinkButton href={`/trainee/workouts/${assignmentId}`}>
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            {hasSavedProgress ? "Resume workout" : "Begin workout"}
          </LinkButton>
        ) : (
          <Button type="button" disabled>
            <Play className="h-4 w-4" aria-hidden="true" />
            Workout unavailable
          </Button>
        )}
      </div>
      {isPreviewOpen ? (
        <div id={previewId} className="border-t">
          {children}
        </div>
      ) : null}
    </>
  );
}
