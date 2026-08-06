import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a coach can batch assign, pause, and resume a trainee's routines", async ({
  admin,
  browser,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const clientName = `Multi assign ${uniqueValue("client")}`;
  const routineNames = [
    `Already assigned ${uniqueValue("routine")}`,
    `Strength ${uniqueValue("routine")}`,
    `Conditioning ${uniqueValue("routine")}`
  ];

  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      coach_id: coach.id,
      client_user_id: trainee.id,
      name: clientName,
      email: trainee.email,
      invitation_accepted_at: new Date().toISOString(),
      status: "active"
    })
    .select("id")
    .single();

  const { data: routines, error: routinesError } = await admin
    .from("workout_routines")
    .insert(
      routineNames.map((name) => ({
        coach_id: coach.id,
        name,
        routine_type: "individual" as const,
        default_cycles: 1
      }))
    )
    .select("id, name");

  expect(clientError, clientError?.message).toBeNull();
  expect(routinesError, routinesError?.message).toBeNull();
  expect(client).not.toBeNull();
  expect(routines).toHaveLength(3);

  const alreadyAssigned = routines!.find(
    (routine) => routine.name === routineNames[0]
  );
  const { error: existingAssignmentError } = await admin
    .from("client_routines")
    .insert({
      coach_id: coach.id,
      client_id: client!.id,
      routine_id: alreadyAssigned!.id,
      status: "active"
    });

  expect(existingAssignmentError, existingAssignmentError?.message).toBeNull();

  await logIn(page, coach);
  await page.goto(`/dashboard/clients/${client!.id}`);
  await page.getByRole("button", { name: "Select routines" }).click();

  const alreadyAssignedCheckbox = page.getByRole("checkbox", {
    name: new RegExp(routineNames[0])
  });
  await expect(alreadyAssignedCheckbox).toBeDisabled();

  const strengthCheckbox = page.getByRole("checkbox", {
    name: routineNames[1]
  });
  const conditioningCheckbox = page.getByRole("checkbox", {
    name: routineNames[2]
  });

  await strengthCheckbox.check();
  await expect(strengthCheckbox).toBeChecked();
  await expect(conditioningCheckbox).toBeVisible();

  await conditioningCheckbox.check();
  await expect(conditioningCheckbox).toBeChecked();
  await expect(
    page.getByRole("listbox", { name: "Routine options" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Assign 2 routines" }).click();
  await expect(page.getByText("Routines assigned")).toBeVisible();
  await expect(
    page.getByText(`2 routines are now assigned to ${clientName}.`)
  ).toBeVisible();

  const { data: assignments, error: assignmentsError } = await admin
    .from("client_routines")
    .select("routine_id")
    .eq("client_id", client!.id)
    .in(
      "routine_id",
      routines!.map((routine) => routine.id)
    );

  expect(assignmentsError, assignmentsError?.message).toBeNull();
  expect(assignments).toHaveLength(3);

  await page.getByRole("button", { name: "Select active routines" }).click();
  await page
    .getByRole("checkbox", { name: routineNames[1] })
    .check();
  await expect(
    page.getByRole("checkbox", { name: routineNames[2] })
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: routineNames[2] })
    .check();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Pause 2 routines" }).click();
  await expect(
    page.getByRole("heading", { name: "Pause these routines?" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause 2 routines" })
    .last()
    .click();
  await expect(page.getByText("Routines paused")).toBeVisible();

  const { data: pausedAssignments, error: pausedAssignmentsError } = await admin
    .from("client_routines")
    .select("routine_id, status")
    .eq("client_id", client!.id)
    .in("routine_id", [
      routines!.find((routine) => routine.name === routineNames[1])!.id,
      routines!.find((routine) => routine.name === routineNames[2])!.id
    ]);

  expect(pausedAssignmentsError, pausedAssignmentsError?.message).toBeNull();
  expect(pausedAssignments).toHaveLength(2);
  expect(pausedAssignments?.every((assignment) => assignment.status === "paused")).toBe(
    true
  );

  const traineeContext = await browser.newContext();
  const traineePage = await traineeContext.newPage();

  try {
    await logIn(traineePage, trainee);
    await expect(
      traineePage.getByRole("heading", { name: routineNames[0] })
    ).toBeVisible();
    await expect(
      traineePage.getByRole("heading", { name: routineNames[1] })
    ).not.toBeVisible();
    await expect(
      traineePage.getByRole("heading", { name: routineNames[2] })
    ).not.toBeVisible();

    await page.getByRole("button", { name: "Select paused routines" }).click();
    await page
      .getByRole("checkbox", { name: routineNames[1] })
      .check();
    await page
      .getByRole("checkbox", { name: routineNames[2] })
      .check();
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "Resume 2 routines" }).click();
    await expect(page.getByText("Routines resumed")).toBeVisible();

    await traineePage.reload();
    await expect(
      traineePage.getByRole("heading", { name: routineNames[1] })
    ).toBeVisible();
    await expect(
      traineePage.getByRole("heading", { name: routineNames[2] })
    ).toBeVisible();
  } finally {
    await traineeContext.close();
  }
});
