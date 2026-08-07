import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a coach can permanently delete a trainee account and its client data", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const clientName = `Delete ${uniqueValue("trainee")}`;
  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      coach_id: coach.id,
      client_user_id: trainee.id,
      name: clientName,
      email: trainee.email,
      status: "active"
    })
    .select("id")
    .single();

  expect(clientError, clientError?.message).toBeNull();
  expect(client).not.toBeNull();

  const { data: activity, error: activityError } = await admin
    .from("activities")
    .insert({
      coach_id: coach.id,
      name: `Delete cascade ${uniqueValue("activity")}`,
      tracked_metrics: ["duration_minutes"],
      required_metrics: ["duration_minutes"]
    })
    .select("id")
    .single();
  const { data: activityAssignment, error: activityAssignmentError } = await admin
    .from("client_activities")
    .insert({
      coach_id: coach.id,
      client_id: client!.id,
      activity_id: activity!.id,
      tracked_metrics: ["duration_minutes"],
      required_metrics: ["duration_minutes"]
    })
    .select("id")
    .single();
  const { error: activityLogError } = await admin.from("activity_logs").insert({
    coach_id: coach.id,
    client_id: client!.id,
    activity_id: activity!.id,
    assignment_id: activityAssignment!.id,
    performed_on: "2026-08-05",
    duration_minutes: 45,
    notes: "Deletion cascade Activity"
  });

  const { error: workoutError } = await admin.from("workout_logs").insert({
    coach_id: coach.id,
    client_id: client!.id,
    trained_on: "2026-08-05",
    notes: "Deletion cascade workout"
  });
  const { error: progressError } = await admin
    .from("body_progress_entries")
    .insert({
      coach_id: coach.id,
      client_id: client!.id,
      recorded_on: "2026-08-05",
      body_weight: 75,
      notes: "Deletion cascade progress"
    });

  expect(workoutError, workoutError?.message).toBeNull();
  expect(progressError, progressError?.message).toBeNull();
  expect(activityError, activityError?.message).toBeNull();
  expect(activityAssignmentError, activityAssignmentError?.message).toBeNull();
  expect(activityLogError, activityLogError?.message).toBeNull();

  await logIn(page, coach);
  await page.goto(`/dashboard/clients/${client!.id}`);
  await page.getByRole("button", { name: "Delete trainee account" }).click();
  await expect(
    page.getByRole("heading", { name: `Delete ${clientName}?` })
  ).toBeVisible();

  const deleteButton = page.getByRole("button", {
    name: "Permanently delete account"
  });
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel(`Type ${clientName} to confirm`).fill(clientName);
  await deleteButton.click();

  await expect(page).toHaveURL(/\/dashboard\/clients\?deleted=/);
  await expect(
    page.getByText(`${clientName} and their account were permanently deleted.`)
  ).toBeVisible();

  const [{ count: clientCount }, { count: workoutCount }, { count: progressCount }, { count: activityAssignmentCount }, { count: activityLogCount }] =
    await Promise.all([
      admin
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("id", client!.id),
      admin
        .from("workout_logs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client!.id),
      admin
        .from("body_progress_entries")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client!.id),
      admin
        .from("client_activities")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client!.id),
      admin
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client!.id)
    ]);

  expect(clientCount).toBe(0);
  expect(workoutCount).toBe(0);
  expect(progressCount).toBe(0);
  expect(activityAssignmentCount).toBe(0);
  expect(activityLogCount).toBe(0);

  const { data: deletedAuthUser, error: deletedAuthUserError } =
    await admin.auth.admin.getUserById(trainee.id);
  expect(deletedAuthUser.user).toBeNull();
  expect(deletedAuthUserError).not.toBeNull();
  users.untrack(trainee.id);
});
