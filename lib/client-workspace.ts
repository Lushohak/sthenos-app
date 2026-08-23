export const CLIENT_WORKSPACE_TABS = [
  "training",
  "schedule",
  "overview",
  "progress",
  "history",
  "account"
] as const;

export type ClientWorkspaceTab = (typeof CLIENT_WORKSPACE_TABS)[number];

export function parseClientWorkspaceTab(value: string | string[] | undefined): ClientWorkspaceTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return CLIENT_WORKSPACE_TABS.includes(candidate as ClientWorkspaceTab)
    ? candidate as ClientWorkspaceTab
    : "training";
}

export function clientWorkspaceHref(clientId: string, tab: ClientWorkspaceTab) {
  const base = `/dashboard/clients/${clientId}`;
  return tab === "training" ? base : `${base}?tab=${tab}`;
}
