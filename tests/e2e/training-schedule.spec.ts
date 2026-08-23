import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke coach and trainee share a recurring weekly training schedule", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach", "Schedule Coach");
  const trainee = await users.create("trainee", "Schedule Trainee");
  const routineName = `Schedule ${uniqueValue("routine")}`;
  const activityName = `Schedule ${uniqueValue("activity")}`;
  const { data: client, error: clientError } = await admin.from("clients").insert({
    coach_id: coach.id,
    client_user_id: trainee.id,
    name: trainee.name,
    email: trainee.email,
    status: "active",
    invitation_accepted_at: new Date().toISOString()
  }).select("id").single();
  const { data: routine, error: routineError } = await admin.from("workout_routines").insert({
    coach_id: coach.id,
    name: routineName,
    routine_type: "individual",
    status: "published",
    default_cycles: 1
  }).select("id").single();
  const { data: activity, error: activityError } = await admin.from("activities").insert({
    coach_id: coach.id,
    name: activityName,
    tracked_metrics: ["duration_minutes"],
    required_metrics: []
  }).select("id").single();
  expect(clientError, clientError?.message).toBeNull();
  expect(routineError, routineError?.message).toBeNull();
  expect(activityError, activityError?.message).toBeNull();

  const [{ data: routineAssignment }, { error: activityAssignmentError }] = await Promise.all([
    admin.from("client_routines").insert({ coach_id: coach.id, client_id: client!.id, routine_id: routine!.id, status: "active" }).select("id").single(),
    admin.from("client_activities").insert({ coach_id: coach.id, client_id: client!.id, activity_id: activity!.id, status: "active", tracked_metrics: ["duration_minutes"], required_metrics: [] })
  ]);
  expect(routineAssignment).not.toBeNull();
  expect(activityAssignmentError, activityAssignmentError?.message).toBeNull();

  await logIn(page, coach);
  await page.goto(`/dashboard/clients/${client!.id}?tab=schedule`);
  await expect(page.getByRole("heading", { name: "Training schedule" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Schedule settings" })).toBeVisible();
  await page.getByLabel("Trainee timezone").fill("America/Mexico_City");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("dialog", { name: "Schedule settings" })).not.toBeVisible();

  await page.getByRole("button", { name: "Add training", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Add training" });
  await editor.getByLabel("Training type").selectOption("routine");
  await editor.locator('select[name="assignment_id"]').selectOption(routineAssignment!.id);
  await editor.getByLabel("Notes").fill("Keep the pace controlled");
  await editor.getByRole("button", { name: "Add training" }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.getByText(routineName).first()).toBeVisible();
  await expect(page.getByText("Weekly").first()).toBeVisible();
  await expect(page.getByText("Keep the pace controlled").first()).toBeVisible();

  await page.getByRole("button", { name: "4 weeks" }).click();
  await expect(page.getByText(routineName).first()).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await logIn(page, trainee);
  await page.getByRole("link", { name: "Schedule" }).click();
  await expect(page).toHaveURL(/\/trainee\/schedule/);
  await expect(page.getByRole("heading", { name: "Training schedule" })).toBeVisible();
  await expect(page.getByText(routineName).first()).toBeVisible();
  await expect(page.getByText("Last updated by Your coach").first()).toBeVisible();
});
