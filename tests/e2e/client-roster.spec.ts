import { test, expect, logIn, uniqueValue } from "./support/fixtures";

function dateFromToday(offsetDays: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

test("a coach filters and sorts the responsive client roster by last training", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const marker = uniqueValue("roster");
  const names = {
    alpha: `Alpha ${marker}`,
    bravo: `Bravo ${marker}`,
    charlie: `Charlie ${marker}`,
    archived: `Archived ${marker}`
  };
  const { data: clients, error: clientError } = await admin.from("clients").insert([
    { coach_id: coach.id, name: names.alpha, email: "alpha@example.test", goal: "Strength", status: "active" },
    { coach_id: coach.id, name: names.bravo, email: "bravo@example.test", goal: "Conditioning", status: "paused" },
    { coach_id: coach.id, name: names.charlie, email: "charlie@example.test", goal: "Mobility", status: "active" },
    { coach_id: coach.id, name: names.archived, email: "archived@example.test", status: "archived" }
  ]).select("id, name");
  expect(clientError, clientError?.message).toBeNull();
  const clientId = (name: string) => clients!.find((client) => client.name === name)!.id;
  const { data: activity, error: activityError } = await admin.from("activities").insert({
    coach_id: coach.id,
    name: `Roster run ${marker}`,
    tracked_metrics: ["duration_minutes"],
    required_metrics: []
  }).select("id").single();
  expect(activityError, activityError?.message).toBeNull();
  const { error: logError } = await admin.from("workout_logs").insert([
    { coach_id: coach.id, client_id: clientId(names.alpha), trained_on: dateFromToday(-3) },
    { coach_id: coach.id, client_id: clientId(names.alpha), trained_on: dateFromToday(3) }
  ]);
  expect(logError, logError?.message).toBeNull();
  const { error: activityLogError } = await admin.from("activity_logs").insert({
    coach_id: coach.id,
    client_id: clientId(names.bravo),
    activity_id: activity!.id,
    performed_on: dateFromToday(0)
  });
  expect(activityLogError, activityLogError?.message).toBeNull();

  await logIn(page, coach);
  await page.goto("/dashboard/clients");
  await expect(page.getByRole("columnheader", { name: "Last trained" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Email" })).not.toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Created" })).not.toBeVisible();
  const rosterTable = page.getByRole("table");
  await expect(rosterTable.getByText("Today", { exact: true })).toBeVisible();
  await expect(rosterTable.getByText("3 days ago", { exact: true })).toBeVisible();
  await expect(rosterTable.getByText("Never trained", { exact: true })).toBeVisible();

  const namesInTable = () => page.locator("tbody tr td:first-child a").allTextContents();
  expect(await namesInTable()).toEqual([names.alpha, names.bravo, names.charlie]);

  await page.getByLabel("Sort by").selectOption("recent");
  await expect(page).toHaveURL(/sort=recent/);
  expect(await namesInTable()).toEqual([names.bravo, names.alpha, names.charlie]);

  await page.getByLabel("Sort by").selectOption("inactive");
  await expect(page).toHaveURL(/sort=inactive/);
  expect(await namesInTable()).toEqual([names.alpha, names.bravo, names.charlie]);

  await page.getByRole("button", { name: "Paused" }).click();
  await expect(page).toHaveURL(/status=paused/);
  await expect(page.getByText("1 client", { exact: true })).toBeVisible();
  expect(await namesInTable()).toEqual([names.bravo]);

  await page.getByLabel("Search by name").fill("No match");
  await expect(page.getByRole("cell", { name: "No clients match these filters." })).toBeVisible();
  await expect(page).toHaveURL(/q=No(?:\+|%20)match/);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/(?:q|status|sort)=/);
  expect(await namesInTable()).toEqual([names.alpha, names.bravo, names.charlie]);

  await page.getByLabel("Search by name").fill("Archived");
  await expect(page).toHaveURL(/q=Archived/);
  await page.getByRole("link", { name: "Archived clients" }).click();
  await expect(page).toHaveURL(/view=archived/);
  await expect(page).toHaveURL(/q=Archived/);
  await expect(page.getByRole("group", { name: "Filter clients by status" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: names.archived })).toBeVisible();
  await expect(page.getByRole("button", { name: `Log training for ${names.archived}` })).not.toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("article").filter({ hasText: names.archived })).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/view=archived/);
  await expect(page.getByLabel("Search by name")).toBeVisible();
  await page.waitForLoadState("networkidle");
});

test("a coach logs workouts and one-time Activities directly from the roster", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const marker = uniqueValue("quick-log");
  const workoutClientName = `Workout ${marker}`;
  const activityClientName = `Activity ${marker}`;
  const { data: clients, error: clientError } = await admin.from("clients").insert([
    { coach_id: coach.id, name: workoutClientName, status: "active" },
    { coach_id: coach.id, name: activityClientName, status: "active" }
  ]).select("id, name");
  expect(clientError, clientError?.message).toBeNull();
  const workoutClient = clients!.find((client) => client.name === workoutClientName)!;
  const activityClient = clients!.find((client) => client.name === activityClientName)!;
  const { data: routine, error: routineError } = await admin.from("workout_routines").insert({
    coach_id: coach.id,
    name: `Quick routine ${marker}`,
    routine_type: "individual",
    default_cycles: 1,
    status: "published"
  }).select("id, name").single();
  expect(routineError, routineError?.message).toBeNull();
  const { error: routineAssignmentError } = await admin.from("client_routines").insert({
    coach_id: coach.id,
    client_id: workoutClient.id,
    routine_id: routine!.id,
    status: "active"
  });
  expect(routineAssignmentError, routineAssignmentError?.message).toBeNull();
  const { data: secondRoutine, error: secondRoutineError } = await admin.from("workout_routines").insert({
    coach_id: coach.id,
    name: `Alternate routine ${marker}`,
    routine_type: "individual",
    default_cycles: 1,
    status: "published"
  }).select("id").single();
  expect(secondRoutineError, secondRoutineError?.message).toBeNull();

  const { data: activity, error: activityError } = await admin.from("activities").insert({
    coach_id: coach.id,
    name: `Quick match ${marker}`,
    tracked_metrics: ["duration_minutes", "perceived_intensity"],
    required_metrics: ["duration_minutes"]
  }).select("id, name").single();
  expect(activityError, activityError?.message).toBeNull();
  const { data: activityAssignment, error: activityAssignmentError } = await admin.from("client_activities").insert({
    coach_id: coach.id,
    client_id: activityClient.id,
    activity_id: activity!.id,
    assignment_mode: "one_time",
    tracked_metrics: ["duration_minutes", "perceived_intensity"],
    required_metrics: ["duration_minutes"],
    targets: { duration_minutes: 60 },
    status: "active"
  }).select("id").single();
  expect(activityAssignmentError, activityAssignmentError?.message).toBeNull();
  const { error: pauseClientError } = await admin.from("clients").update({ status: "paused" }).eq("id", activityClient.id);
  expect(pauseClientError, pauseClientError?.message).toBeNull();

  await logIn(page, coach);
  await page.goto("/dashboard/clients?sort=recent");
  await page.getByRole("button", { name: `Log training for ${workoutClientName}` }).click();
  const workoutDialog = page.getByRole("dialog", { name: `Log training for ${workoutClientName}` });
  await expect(workoutDialog.getByText("Loading training options...")).toBeVisible();
  await expect(workoutDialog.getByLabel("Routine")).toHaveValue(routine!.id);
  await workoutDialog.getByLabel("Duration in minutes").fill("45");
  await workoutDialog.getByLabel("Notes").fill("Logged from roster");
  await workoutDialog.getByRole("button", { name: "Mark completed" }).click();
  await expect(workoutDialog).not.toBeVisible();
  await expect(page.getByText("Workout logged", { exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByText("Today", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/sort=recent/);
  const { data: workoutLog } = await admin.from("workout_logs").select("routine_id, duration_minutes, notes").eq("client_id", workoutClient.id).single();
  expect(workoutLog).toMatchObject({ routine_id: routine!.id, duration_minutes: 45, notes: "Logged from roster" });

  const { error: secondAssignmentError } = await admin.from("client_routines").insert({
    coach_id: coach.id,
    client_id: workoutClient.id,
    routine_id: secondRoutine!.id,
    status: "active"
  });
  expect(secondAssignmentError, secondAssignmentError?.message).toBeNull();
  await page.getByRole("button", { name: `Log training for ${workoutClientName}` }).click();
  const multipleRoutineDialog = page.getByRole("dialog", { name: `Log training for ${workoutClientName}` });
  await expect(multipleRoutineDialog.getByLabel("Routine")).toHaveValue("");
  await multipleRoutineDialog.getByLabel("Routine").selectOption("unstructured");
  await multipleRoutineDialog.getByRole("button", { name: "Close modal" }).click();

  const quickActivityName = `Quick added ${marker}`;
  await page.getByRole("button", { name: `Log training for ${workoutClientName}` }).click();
  const quickActivityDialog = page.getByRole("dialog", { name: `Log training for ${workoutClientName}` });
  await quickActivityDialog.getByRole("tab", { name: "Activity" }).click();
  const quickActivitySelect = quickActivityDialog.locator("select").first();
  await expect(quickActivitySelect.locator("option").last()).toHaveText("＋ Create and assign new Activity…");
  await expect(quickActivityDialog.getByRole("heading", { name: "Create and assign a new Activity" })).toBeVisible();
  await quickActivityDialog.getByLabel("Activity name").fill(quickActivityName);
  await quickActivityDialog.getByRole("checkbox", { name: /Duration/ }).check();
  await quickActivityDialog.getByRole("button", { name: "Create and assign" }).click();
  await expect(page.getByText("Activity ready to log", { exact: true })).toBeVisible();
  await expect(quickActivityDialog.getByLabel("Duration (min)")).toBeVisible();
  await quickActivityDialog.getByLabel("Duration (min)").fill("28");
  await quickActivityDialog.getByLabel("Activity notes").fill("Created while logging");
  await quickActivityDialog.getByRole("button", { name: "Complete Activity" }).click();
  await expect(quickActivityDialog).not.toBeVisible();
  const { data: quickActivity, error: quickActivityError } = await admin
    .from("activities")
    .select("id, tracked_metrics")
    .eq("coach_id", coach.id)
    .eq("name", quickActivityName)
    .single();
  expect(quickActivityError, quickActivityError?.message).toBeNull();
  expect(quickActivity?.tracked_metrics).toEqual(["duration_minutes"]);
  const { data: quickActivityLog, error: quickActivityLogError } = await admin
    .from("activity_logs")
    .select("duration_minutes, notes, assignment_id")
    .eq("activity_id", quickActivity!.id)
    .eq("client_id", workoutClient.id)
    .single();
  expect(quickActivityLogError, quickActivityLogError?.message).toBeNull();
  expect(quickActivityLog).toEqual(expect.objectContaining({
    duration_minutes: 28,
    notes: "Created while logging"
  }));
  expect(quickActivityLog?.assignment_id).toBeTruthy();

  await page.getByRole("button", { name: `Log training for ${activityClientName}` }).click();
  const activityDialog = page.getByRole("dialog", { name: `Log training for ${activityClientName}` });
  await expect(activityDialog.getByLabel("Routine")).toHaveValue("unstructured");
  await activityDialog.getByRole("tab", { name: "Activity" }).click();
  await expect(activityDialog.locator("select").first()).toHaveValue(activityAssignment!.id);
  await activityDialog.getByLabel("Duration (min)").fill("64");
  await activityDialog.getByLabel("Perceived intensity (RPE)").fill("7");
  await activityDialog.getByRole("button", { name: "Complete Activity" }).click();
  await expect(activityDialog).not.toBeVisible();
  await expect(page).toHaveURL(/dashboard\/clients\?sort=recent/);
  await expect(page.getByText("Activity completed", { exact: true })).toBeVisible();
  const [{ data: completedAssignment }, { data: activityLog }] = await Promise.all([
    admin.from("client_activities").select("status").eq("id", activityAssignment!.id).single(),
    admin.from("activity_logs").select("duration_minutes, perceived_intensity").eq("assignment_id", activityAssignment!.id).single()
  ]);
  expect(completedAssignment?.status).toBe("completed");
  expect(activityLog).toMatchObject({ duration_minutes: 64, perceived_intensity: 7 });
  await page.waitForLoadState("networkidle");
});
