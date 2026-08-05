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

  const [{ count: clientCount }, { count: workoutCount }, { count: progressCount }] =
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
        .eq("client_id", client!.id)
    ]);

  expect(clientCount).toBe(0);
  expect(workoutCount).toBe(0);
  expect(progressCount).toBe(0);

  const { data: deletedAuthUser, error: deletedAuthUserError } =
    await admin.auth.admin.getUserById(trainee.id);
  expect(deletedAuthUser.user).toBeNull();
  expect(deletedAuthUserError).not.toBeNull();
  users.untrack(trainee.id);
});
