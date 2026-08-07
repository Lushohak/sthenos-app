"use client";

import { useEffect, useState } from "react";
import { Toast } from "@/components/ui/toast";

type ActivityCompletedToastProps = {
  activityName: string;
};

export function ActivityCompletedToast({
  activityName
}: ActivityCompletedToastProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("activityCompleted");
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
      title="Activity completed"
      description={`${activityName} was completed and moved to training history.`}
      variant="success"
    />
  );
}
