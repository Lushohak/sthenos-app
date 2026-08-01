import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke coach assignment becomes a trainee workout and coach history", async ({
  admin,
  browser,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const traineeName = `Trainee ${uniqueValue("golden")}`;
  const exerciseName = `Exercise ${uniqueValue("golden")}`;
  const routineName = `Routine ${uniqueValue("golden")}`;
  const completionNote = `Completed ${uniqueValue("golden")}`;

  await logIn(page, coach);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/dashboard/clients/new");
  await page.getByLabel("Name").fill(traineeName);
  await page.getByLabel("Email").fill(trainee.email);
  await page.getByLabel("Age").fill("28");
  await page.getByLabel("Goal").fill("Complete the E2E workout");
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page).toHaveURL(/\/dashboard\/clients$/);
  await expect(page.getByRole("link", { name: traineeName })).toBeVisible();

  const { data: client, error: clientLookupError } = await admin
    .from("clients")
    .select("id")
    .eq("coach_id", coach.id)
    .eq("name", traineeName)
    .single();

  expect(clientLookupError, clientLookupError?.message).toBeNull();
  expect(client).not.toBeNull();

  const { error: linkError } = await admin
    .from("clients")
    .update({
      client_user_id: trainee.id,
      invitation_accepted_at: new Date().toISOString()
    })
    .eq("id", client!.id);

  expect(linkError, linkError?.message).toBeNull();

  await page.goto("/dashboard/exercises/new");
  await page.getByLabel("Title").fill(exerciseName);
  await page.getByLabel("Difficulty").selectOption("2");
  await page.getByRole("button", { name: "Create exercise" }).click();
  await expect(page.getByRole("heading", { name: exerciseName })).toBeVisible();

  await page.goto("/dashboard/routines/new");
  await page.getByLabel("Routine name").fill(routineName);
  await page.getByLabel("Description").fill("A complete automated workout");
  await page.getByLabel("Routine structure").selectOption("circuit");
  await page.getByLabel("Default cycles").fill("2");
  await page.getByRole("button", { name: "Create routine" }).click();
  await expect(page.getByRole("heading", { name: routineName })).toBeVisible();

  await page.getByLabel("Search exercises").fill(exerciseName);
  await page.getByText(exerciseName, { exact: true }).click();
  await expect(page.getByRole("radio")).toBeChecked();
  await page.getByLabel("Reps").fill("8");
  await page.getByLabel("Rest sec").fill("1");
  await page.getByLabel("Notes").fill("Controlled tempo");
  await page.getByRole("button", { name: "Add exercise to routine" }).click();
  await expect(page.getByText(exerciseName).first()).toBeVisible();

  await page.getByRole("link", { name: "Assign trainees" }).click();
  await page.getByRole("checkbox", { name: new RegExp(traineeName) }).check();
  await page
    .getByRole("button", { name: "Assign routine to 1 trainee" })
    .click();
  await expect(page.getByText("Routine assigned")).toBeVisible();

  const traineeContext = await browser.newContext();
  const traineePage = await traineeContext.newPage();

  try {
    await logIn(traineePage, trainee);
    await expect(traineePage).toHaveURL(/\/trainee$/);
    await expect(
      traineePage.getByRole("heading", { name: routineName })
    ).toBeVisible();

    await traineePage.getByRole("button", { name: "Preview workout" }).click();
    await expect(traineePage.getByText("Controlled tempo")).toBeVisible();
    await traineePage.getByRole("link", { name: "Begin workout" }).click();
    await expect(
      traineePage.getByRole("heading", { name: exerciseName })
    ).toBeVisible();

    await traineePage.getByRole("button", { name: "Done — Next" }).click();
    await expect(traineePage.getByText("Rest before the next exercise")).toBeVisible();
    await expect(traineePage.getByText("Round 2 of 2").first()).toBeVisible({
      timeout: 5_000
    });
    await traineePage
      .getByRole("button", { name: "Finish exercises" })
      .click();
    await expect(
      traineePage.getByRole("heading", { name: "Workout complete" })
    ).toBeVisible();
    await traineePage.getByLabel("How did it feel?").fill(completionNote);
    await traineePage
      .getByRole("button", { name: "Finish and save workout" })
      .click();
    await expect(
      traineePage.getByRole("heading", { name: "Workout saved" })
    ).toBeVisible();
  } finally {
    await traineeContext.close();
  }

  await page.goto(`/dashboard/clients/${client!.id}`);
  await expect(page.getByText(completionNote)).toBeVisible();
  await expect(page.getByText(routineName).last()).toBeVisible();
});
