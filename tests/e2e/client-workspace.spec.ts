import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a coach navigates a focused client workspace with URL-backed tabs", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const clientName = `Workspace ${uniqueValue("client")}`;
  const routineName = `Workspace ${uniqueValue("routine")}`;
  const activityName = `Workspace ${uniqueValue("activity")}`;
  const { data: client, error: clientError } = await admin.from("clients").insert({
    coach_id: coach.id,
    name: clientName,
    email: `${uniqueValue("workspace")}@example.test`,
    goal: "Build training consistency",
    status: "active"
  }).select("id").single();
  const { data: routine, error: routineError } = await admin.from("workout_routines").insert({
    coach_id: coach.id,
    name: routineName,
    routine_type: "individual",
    default_cycles: 1
  }).select("id").single();
  const { data: activity, error: activityError } = await admin.from("activities").insert({
    coach_id: coach.id,
    name: activityName,
    tracked_metrics: ["duration_minutes"],
    required_metrics: ["duration_minutes"]
  }).select("id").single();
  expect(clientError, clientError?.message).toBeNull();
  expect(routineError, routineError?.message).toBeNull();
  expect(activityError, activityError?.message).toBeNull();

  const [{ error: routineAssignmentError }, { error: activityAssignmentError }] = await Promise.all([
    admin.from("client_routines").insert({ coach_id: coach.id, client_id: client!.id, routine_id: routine!.id, status: "active", notes: "Monday plan" }),
    admin.from("client_activities").insert({ coach_id: coach.id, client_id: client!.id, activity_id: activity!.id, status: "paused", tracked_metrics: ["duration_minutes"], required_metrics: ["duration_minutes"], notes: "Weekend session" })
  ]);
  expect(routineAssignmentError, routineAssignmentError?.message).toBeNull();
  expect(activityAssignmentError, activityAssignmentError?.message).toBeNull();

  await Promise.all([
    admin.from("workout_logs").insert({ coach_id: coach.id, client_id: client!.id, routine_id: routine!.id, trained_on: "2026-08-10", duration_minutes: 35, notes: "Good session" }),
    admin.from("body_progress_entries").insert({ coach_id: coach.id, client_id: client!.id, recorded_on: "2026-08-10", body_weight: 76.4 })
  ]);

  await logIn(page, coach);
  await page.goto(`/dashboard/clients/${client!.id}`);
  const workspaceTabs = page.getByRole("navigation", { name: "Client workspace" });
  await expect(page.getByRole("heading", { name: "Training plan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Training plan" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Monday plan")).toBeVisible();
  await expect(page.getByText("Weekend session")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).not.toBeVisible();

  await page.goto(`/dashboard/clients/${client!.id}?tab=unknown`);
  await expect(page.getByRole("heading", { name: "Training plan" })).toBeVisible();

  await page.route(`**/dashboard/clients/${client!.id}**`, async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get("tab") === "overview" && route.request().headers().rsc) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    await route.continue();
  });
  const overviewTab = workspaceTabs.getByRole("link", { name: "Overview" });
  await Promise.all([
    expect(overviewTab).toHaveAttribute("aria-busy", "true"),
    overviewTab.click()
  ]);
  await expect(page).toHaveURL(/tab=overview/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("76.4 kg", { exact: true })).toBeVisible();
  await expect(page.getByText(routineName)).toBeVisible();
  await expect(page.getByText(/Workout · 35 min/)).toBeVisible();

  await workspaceTabs.getByRole("link", { name: "Progress" }).click();
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add measurement" }).first()).toBeVisible();
  await page.getByRole("navigation", { name: "Progress date range" }).getByRole("link", { name: "30 days" }).click();
  await expect(page).toHaveURL(/tab=progress/);
  await expect(page).toHaveURL(/range=30d/);

  await workspaceTabs.getByRole("link", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Training history", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log training" }).first()).toBeVisible();

  await workspaceTabs.getByRole("link", { name: "Account" }).click();
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profile details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send invite" })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Training history", exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(workspaceTabs).toBeVisible();
  expect(await workspaceTabs.evaluate((nav) => getComputedStyle(nav.parentElement!).position)).toBe("sticky");
  expect(await workspaceTabs.evaluate((nav) => nav.scrollWidth >= nav.clientWidth)).toBe(true);

  const { error: archiveError } = await admin.from("clients").update({ status: "archived" }).eq("id", client!.id);
  expect(archiveError, archiveError?.message).toBeNull();
  await page.goto(`/dashboard/clients/${client!.id}`);
  await expect(page.getByText("Restore this client before changing assignments.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Assign training" })).not.toBeVisible();
  await workspaceTabs.getByRole("link", { name: "Account" }).click();
  await expect(page.getByText("Restore this client before sending account invitations.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send invite" })).not.toBeVisible();
});
