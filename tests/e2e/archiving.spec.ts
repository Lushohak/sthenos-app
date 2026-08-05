import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a coach can archive and restore clients and routines without losing history", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const clientName = `Archive ${uniqueValue("client")}`;
  const routineName = `Archive ${uniqueValue("routine")}`;
  const [{ data: client, error: clientError }, { data: routine, error: routineError }] =
    await Promise.all([
      admin
        .from("clients")
        .insert({
          coach_id: coach.id,
          client_user_id: trainee.id,
          name: clientName,
          email: trainee.email,
          status: "active"
        })
        .select("id")
        .single(),
      admin
        .from("workout_routines")
        .insert({
          coach_id: coach.id,
          name: routineName,
          description: "Archive regression routine",
          routine_type: "individual",
          default_cycles: 1
        })
        .select("id")
        .single()
    ]);

  expect(clientError, clientError?.message).toBeNull();
  expect(routineError, routineError?.message).toBeNull();
  expect(client).not.toBeNull();
  expect(routine).not.toBeNull();

  const { error: assignmentError } = await admin.from("client_routines").insert({
    coach_id: coach.id,
    client_id: client!.id,
    routine_id: routine!.id,
    status: "active",
    notes: "Preserve this assignment"
  });
  expect(assignmentError, assignmentError?.message).toBeNull();

  await logIn(page, coach);
  await page.goto(`/dashboard/clients/${client!.id}`);
  await page.getByRole("button", { name: "Archive client" }).click();
  await expect(
    page.getByRole("heading", { name: `Archive ${clientName}?` })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Archive client", exact: true })
    .last()
    .click();

  await expect(page.getByText(`${clientName} archived`)).toBeVisible();
  await expect(page.getByRole("link", { name: clientName })).not.toBeVisible();

  const { data: archivedClient } = await admin
    .from("clients")
    .select("status")
    .eq("id", client!.id)
    .single();
  const { data: retainedAuthUser, error: retainedAuthError } =
    await admin.auth.admin.getUserById(trainee.id);

  expect(archivedClient?.status).toBe("archived");
  expect(retainedAuthError, retainedAuthError?.message).toBeNull();
  expect(retainedAuthUser.user?.id).toBe(trainee.id);

  await page.getByRole("link", { name: "Archived clients" }).click();
  await page.getByRole("link", { name: clientName }).click();
  await expect(
    page.getByText("Restore this client to send account invitations")
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore client" }).click();
  await expect(page.getByText(`${clientName} restored`)).toBeVisible();

  const { data: restoredClient } = await admin
    .from("clients")
    .select("status")
    .eq("id", client!.id)
    .single();
  expect(restoredClient?.status).toBe("active");

  await page.goto(`/dashboard/routines/${routine!.id}`);
  await page.getByRole("button", { name: "Archive routine" }).click();
  await expect(
    page.getByRole("heading", { name: `Archive ${routineName}?` })
  ).toBeVisible();
  await expect(page.getByText(clientName)).toBeVisible();
  await page
    .getByRole("button", { name: "Archive routine", exact: true })
    .last()
    .click();

  await expect(page.getByText(`${routineName} archived`)).toBeVisible();
  await expect(page.getByRole("link", { name: routineName })).not.toBeVisible();

  const [{ data: archivedRoutine }, { count: assignmentCount }] = await Promise.all([
    admin
      .from("workout_routines")
      .select("archived_at")
      .eq("id", routine!.id)
      .single(),
    admin
      .from("client_routines")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client!.id)
      .eq("routine_id", routine!.id)
  ]);

  expect(archivedRoutine?.archived_at).not.toBeNull();
  expect(assignmentCount).toBe(1);

  await page.getByRole("link", { name: "Archived routines" }).click();
  await page.getByRole("link", { name: routineName }).click();
  await expect(
    page.getByText("Archived routines cannot be edited or assigned")
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Assign trainees" })
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Restore routine" }).click();
  await expect(page.getByText(`${routineName} restored`)).toBeVisible();

  const { data: restoredRoutine } = await admin
    .from("workout_routines")
    .select("archived_at")
    .eq("id", routine!.id)
    .single();
  expect(restoredRoutine?.archived_at).toBeNull();
});
