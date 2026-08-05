"use client";

import { useEffect, useState } from "react";
import { Toast } from "@/components/ui/toast";

type ArchiveStatusToastProps = {
  itemName: string;
  action: "archived" | "restored";
  description: string;
};

export function ArchiveStatusToast({
  itemName,
  action,
  description
}: ArchiveStatusToastProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete(action);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }, [action]);

  return (
    <Toast
      open={open}
      onOpenChange={setOpen}
      title={`${itemName} ${action}`}
      description={description}
      variant="success"
    />
  );
}
