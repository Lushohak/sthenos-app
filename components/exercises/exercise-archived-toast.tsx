"use client";

import { useEffect, useState } from "react";
import { Toast } from "@/components/ui/toast";

type ExerciseArchivedToastProps = {
  exerciseName: string;
};

export function ExerciseArchivedToast({
  exerciseName
}: ExerciseArchivedToastProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("archived");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }, []);

  return (
    <Toast
      open={open}
      onOpenChange={setOpen}
      title={`${exerciseName} archived`}
      description="It is hidden from the library. Existing routines were not changed."
      variant="success"
    />
  );
}
