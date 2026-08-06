import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a coach can build a gym workout with per-exercise sets", async ({
  admin,
  browser,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const clientName = `Gym ${uniqueValue("client")}`;
  const exerciseName = `Bench press ${uniqueValue("exercise")}`;
  const routineName = `Upper body ${uniqueValue("gym")}`;
  const completionNote = `Strong session ${uniqueValue("note")}`;

  const [{ data: client, error: clientError }, { error: exerciseError }] =
    await Promise.all([
      admin
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
        .single(),
      admin.from("exercises").insert({
        coach_id: coach.id,
        name: exerciseName,
        difficulty: 2,
        category: "Strength",
        equipment: "Barbell"
      })
    ]);

  expect(clientError, clientError?.message).toBeNull();
  expect(exerciseError, exerciseError?.message).toBeNull();
  expect(client).not.toBeNull();

  await logIn(page, coach);
  await page.goto("/dashboard/routines/new");
  await page.getByLabel("Routine name").fill(routineName);
  await page.getByLabel("Routine structure").selectOption("gym");
  await expect(
    page.getByText("Gym workouts use sets and reps")
  ).toBeVisible();
  await expect(page.getByLabel("Default cycles")).not.toBeVisible();
  await page.getByRole("button", { name: "Create routine" }).click();

  await expect(page.getByRole("heading", { name: routineName })).toBeVisible();
  await expect(page.getByText("Gym workout", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Search exercises").fill(exerciseName);
  await page.getByText(exerciseName, { exact: true }).click();
  await page.getByLabel("Sets").fill("3");
  await page.getByLabel("Reps").fill("8");
  await page.getByLabel("Rest sec").fill("0");
  await page
    .getByRole("button", { name: "Add exercise to routine" })
    .click();
  await expect(
    page.getByRole("cell", { name: new RegExp(exerciseName) }).first()
  ).toBeVisible();

  const { data: routine, error: routineError } = await admin
    .from("workout_routines")
    .select("id, routine_type, default_cycles")
    .eq("coach_id", coach.id)
    .eq("name", routineName)
    .single();

  expect(routineError, routineError?.message).toBeNull();
  expect(routine?.routine_type).toBe("gym");
  expect(routine?.default_cycles).toBe(1);

  const { data: configuredExercise, error: configuredExerciseError } = await admin
    .from("routine_exercises")
    .select("sets, reps")
    .eq("routine_id", routine!.id)
    .single();

  expect(configuredExerciseError, configuredExerciseError?.message).toBeNull();
  expect(configuredExercise).toEqual(expect.objectContaining({ sets: 3, reps: "8" }));

  await page.getByRole("link", { name: "Assign trainees" }).click();
  await page
    .getByRole("checkbox", { name: new RegExp(clientName) })
    .check();
  await page
    .getByRole("button", { name: "Assign routine to 1 trainee" })
    .click();
  await expect(page.getByText("Routine assigned")).toBeVisible();

  const traineeContext = await browser.newContext();
  const traineePage = await traineeContext.newPage();

  try {
    await logIn(traineePage, trainee);
    await traineePage.getByRole("button", { name: "Preview workout" }).click();
    await expect(traineePage.getByText("Sets")).toBeVisible();
    await expect(traineePage.getByText("3", { exact: true })).toBeVisible();
    await traineePage.getByRole("link", { name: "Begin workout" }).click();

    await expect(
      traineePage.getByText("Set 1 of 3").first()
    ).toBeVisible();
    await traineePage.getByRole("button", { name: "Done — Next" }).click();
    await expect(
      traineePage.getByText("Set 2 of 3").first()
    ).toBeVisible();
    await traineePage.getByRole("button", { name: "Done — Next" }).click();
    await expect(
      traineePage.getByText("Set 3 of 3").first()
    ).toBeVisible();
    await traineePage
      .getByRole("button", { name: "Finish exercises" })
      .click();

    await expect(
      traineePage.getByRole("heading", { name: "Workout complete" })
    ).toBeVisible();
    await expect(traineePage.getByText("Total sets")).toBeVisible();
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

  const { data: log, error: logError } = await admin
    .from("workout_logs")
    .select("notes, duration_minutes")
    .eq("client_id", client!.id)
    .eq("routine_id", routine!.id)
    .single();

  expect(logError, logError?.message).toBeNull();
  expect(log?.notes).toBe(completionNote);
  expect(log?.duration_minutes).toBeGreaterThanOrEqual(1);
});
