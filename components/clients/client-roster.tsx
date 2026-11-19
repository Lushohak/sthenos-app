"use client";

import { PendingLink as Link } from "@/components/ui/pending-link";
import { ChevronRight, LoaderCircle, RefreshCw, ScrollText, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TrainingLogDialogContent } from "@/components/clients/client-workspace-actions";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Table, Td, Th } from "@/components/ui/table";
import { getClientLoggingOptionsAction } from "@/lib/actions/clients";
import type {
  ClientLoggingOptionsResult,
  ClientRosterItem,
  ClientRosterSort,
  ClientRosterStatus
} from "@/lib/client-roster";
import { cn, formatDate, formatTrainingRecency } from "@/lib/utils";

type ClientRosterProps = {
  clients: ClientRosterItem[];
  archived: boolean;
  today: string;
};

function statusFrom(value: string | null): ClientRosterStatus | null {
  return value === "active" || value === "paused" ? value : null;
}

function sortFrom(value: string | null): ClientRosterSort {
  return value === "recent" || value === "inactive" ? value : "name";
}

function statusBadge(status: ClientRosterItem["status"]) {
  return cn(
    "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
    status === "active" && "border-success/40 bg-success/10 text-success",
    status === "paused" && "border-warning/40 bg-warning/10 text-warning",
    status === "archived" && "border-border-emphasis bg-elevated text-muted-foreground"
  );
}

function LastTrained({ client, today }: { client: ClientRosterItem; today: string }) {
  if (!client.lastTrainedOn) {
    return <span className="text-muted-foreground">Never trained</span>;
  }
  const exactDate = formatDate(client.lastTrainedOn);
  return (
    <span className="grid gap-0.5" title={exactDate}>
      <span className="font-medium text-foreground">{formatTrainingRecency(client.lastTrainedOn, today)}</span>
      <span className="text-xs text-muted-foreground">{exactDate}</span>
    </span>
  );
}

export function ClientRoster({ clients, archived, today }: ClientRosterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [selectedClient, setSelectedClient] = useState<ClientRosterItem | null>(null);
  const [loggingResult, setLoggingResult] = useState<ClientLoggingOptionsResult | null>(null);
  const [loggingOpen, setLoggingOpen] = useState(false);
  const [isLoadingOptions, startLoadingOptions] = useTransition();
  const loggingRequest = useRef(0);
  const status = archived ? null : statusFrom(searchParams.get("status"));
  const sort = sortFrom(searchParams.get("sort"));

  useEffect(() => setQuery(urlQuery), [urlQuery]);

  useEffect(() => {
    if (query === urlQuery) return;
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, searchParams, urlQuery]);

  const updateParam = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const visibleClients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = clients.filter((client) => {
      if (status && client.status !== status) return false;
      return !normalizedQuery || client.name.toLocaleLowerCase().includes(normalizedQuery);
    });
    return [...filtered].sort((left, right) => {
      let comparison = 0;
      if (sort === "recent" || sort === "inactive") {
        if (left.lastTrainedOn === null && right.lastTrainedOn !== null) return 1;
        if (left.lastTrainedOn !== null && right.lastTrainedOn === null) return -1;
        if (left.lastTrainedOn && right.lastTrainedOn) {
          comparison = sort === "recent"
            ? right.lastTrainedOn.localeCompare(left.lastTrainedOn)
            : left.lastTrainedOn.localeCompare(right.lastTrainedOn);
        }
      }
      return comparison || left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
  }, [clients, query, sort, status]);

  function viewHref(nextView: "active" | "archived") {
    const next = new URLSearchParams(searchParams.toString());
    if (nextView === "archived") next.set("view", "archived");
    else next.delete("view");
    next.delete("status");
    return `${pathname}?${next.toString()}`;
  }

  function clearFilters() {
    setQuery("");
    const next = new URLSearchParams(searchParams.toString());
    next.delete("q");
    next.delete("status");
    next.delete("sort");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const loadLoggingOptions = useCallback((client: ClientRosterItem) => {
    const requestId = loggingRequest.current + 1;
    loggingRequest.current = requestId;
    setSelectedClient(client);
    setLoggingResult(null);
    setLoggingOpen(true);
    startLoadingOptions(async () => {
      try {
        const result = await getClientLoggingOptionsAction(client.id);
        if (loggingRequest.current === requestId) setLoggingResult(result);
      } catch {
        if (loggingRequest.current === requestId) {
          setLoggingResult({
            success: false,
            message: "We could not load this trainee's training options. Please try again."
          });
        }
      }
    });
  }, []);

  const handleLogSuccess = useCallback(() => {
    setLoggingOpen(false);
    router.refresh();
  }, [router]);

  const hasFilters = Boolean(query.trim() || status || sort !== "name");
  const emptyMessage = clients.length === 0
    ? archived ? "No archived clients." : "No active clients yet."
    : "No clients match these filters.";

  return (
    <>
      <div className="mb-5 grid gap-4 rounded-xl border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap gap-2" aria-label="Client views">
          <LinkButton href={viewHref("active")} variant={archived ? "ghost" : "secondary"}>Active clients</LinkButton>
          <LinkButton href={viewHref("archived")} variant={archived ? "secondary" : "ghost"}>Archived clients</LinkButton>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_auto_minmax(11rem,auto)_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-medium">
            <span>Search by name</span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9 pr-9"
                placeholder="Find a trainee..."
              />
              {query ? (
                <Button type="button" variant="ghost" className="absolute right-1 top-1 h-8 w-8 px-0" aria-label="Clear name search" onClick={() => setQuery("")}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </span>
          </label>
          {!archived ? (
            <div className="grid gap-2">
              <span className="text-sm font-medium">Status</span>
              <div className="flex rounded-md border border-border-emphasis bg-background-secondary p-1" role="group" aria-label="Filter clients by status">
                {([null, "active", "paused"] as const).map((value) => (
                  <Button
                    key={value ?? "all"}
                    type="button"
                    variant={status === value ? "secondary" : "ghost"}
                    className="h-8 px-3"
                    aria-pressed={status === value}
                    onClick={() => updateParam("status", value)}
                  >
                    {value ? value.charAt(0).toUpperCase() + value.slice(1) : "All"}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <label className="grid gap-2 text-sm font-medium">
            <span>Sort by</span>
            <Select value={sort} onChange={(event) => updateParam("sort", event.target.value === "name" ? null : event.target.value)}>
              <option value="name">Name A–Z</option>
              <option value="recent">Recently trained</option>
              <option value="inactive">Longest inactive</option>
            </Select>
          </label>
          <Button type="button" variant="ghost" disabled={!hasFilters} onClick={clearFilters}>Clear filters</Button>
        </div>
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {visibleClients.length} {visibleClients.length === 1 ? "client" : "clients"}
        </p>
      </div>

      <div className="hidden md:block">
        <Table>
          <thead><tr><Th>Name</Th><Th>Goal</Th><Th>Status</Th><Th>Last trained</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {visibleClients.map((client) => (
              <tr key={client.id}>
                <Td>
                  <Link
                    className="group inline-flex items-center gap-1 font-semibold text-primary underline decoration-primary/45 underline-offset-4 transition-colors hover:text-primary-hover hover:decoration-primary-hover focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    href={`/dashboard/clients/${client.id}`}
                    title={`View ${client.name}'s details`}
                  >
                    {client.name}
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </Td>
                <Td>{client.goal ?? "Not set"}</Td>
                <Td><span className={statusBadge(client.status)}>{client.status}</span></Td>
                <Td><LastTrained client={client} today={today} /></Td>
                <Td>
                  {!archived ? (
                    <Button type="button" variant="secondary" className="h-9 px-3" aria-label={`Log training for ${client.name}`} onClick={() => loadLoggingOptions(client)}>
                      <ScrollText className="h-4 w-4" aria-hidden="true" /> Log training
                    </Button>
                  ) : <span className="text-sm text-muted-foreground">—</span>}
                </Td>
              </tr>
            ))}
            {!visibleClients.length ? <tr><Td colSpan={5}>{emptyMessage}</Td></tr> : null}
          </tbody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {visibleClients.map((client) => (
          <article key={client.id} className="grid gap-4 rounded-xl border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{client.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{client.goal ?? "No goal set"}</p>
              </div>
              <span className={statusBadge(client.status)}>{client.status}</span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground">Last trained</span>
              <LastTrained client={client} today={today} />
            </div>
            <div className={cn("grid gap-2", archived ? "grid-cols-1" : "grid-cols-2")}>
              <LinkButton href={`/dashboard/clients/${client.id}`} variant="ghost">View client</LinkButton>
              {!archived ? (
                <Button type="button" variant="secondary" aria-label={`Log training for ${client.name}`} onClick={() => loadLoggingOptions(client)}>
                  <ScrollText className="h-4 w-4" aria-hidden="true" /> Log training
                </Button>
              ) : null}
            </div>
          </article>
        ))}
        {!visibleClients.length ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{emptyMessage}</p> : null}
      </div>

      <Modal
        open={loggingOpen}
        onOpenChange={setLoggingOpen}
        title={`Log training${selectedClient ? ` for ${selectedClient.name}` : ""}`}
        description="Record a completed workout or Activity without leaving the roster."
        className="max-w-2xl"
      >
        {isLoadingOptions && !loggingResult ? (
          <div className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading training options...
          </div>
        ) : loggingResult?.success ? (
          <TrainingLogDialogContent
            key={loggingResult.options.client.id}
            clientId={loggingResult.options.client.id}
            routineAssignments={loggingResult.options.routineAssignments}
            activityAssignments={loggingResult.options.activityAssignments}
            scheduledSessions={loggingResult.options.scheduledSessions}
            today={today}
            requireExplicitRoutineChoice
            activityCompletionBehavior="return"
            onSuccess={handleLogSuccess}
          />
        ) : loggingResult ? (
          <div className="grid gap-4 p-5">
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{loggingResult.message}</p>
            {selectedClient ? (
              <Button type="button" variant="secondary" className="w-fit" disabled={isLoadingOptions} onClick={() => loadLoggingOptions(selectedClient)}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
              </Button>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
