import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a coach can bulk-create exercises in a persistent routine draft", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const routineName = `Builder ${uniqueValue("routine")}`;
  const existingName = `Shared press ${uniqueValue("exercise")}`;
  const newName = `Builder row ${uniqueValue("exercise")}`;
  const clientName = `Builder ${uniqueValue("client")}`;

  const [{ data: existingExercise }, { data: client }] = await Promise.all([
    admin
      .from("exercises")
      .insert({
        coach_id: coach.id,
        name: existingName,
        category: "Strength",
        difficulty: 2,
        equipment: "None"
      })
      .select("id")
      .single(),
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
      .single()
  ]);

  await logIn(page, coach);
  await page.goto("/dashboard/routines/new");
  await page.getByLabel("Routine name").fill(routineName);
  await page.getByLabel("Routine structure").selectOption("gym");
  await page.getByRole("button", { name: "Start building" }).click();

  await expect(page.getByText("Draft routine")).toBeVisible();
  const { data: draft } = await admin
    .from("workout_routines")
    .select("id, status")
    .eq("coach_id", coach.id)
    .eq("name", routineName)
    .single();
  expect(draft?.status).toBe("draft");

  const { error: draftAssignmentError } = await admin
    .from("client_routines")
    .insert({
      coach_id: coach.id,
      client_id: client!.id,
      routine_id: draft!.id
    });
  expect(draftAssignmentError).not.toBeNull();

  await page.getByRole("tab", { name: "Create exercises" }).click();
  await page
    .getByPlaceholder("Push-up\nPull-up\nBodyweight squat")
    .fill(`${existingName}\n${existingName}\n${newName}`);
  await page.getByRole("button", { name: "Create rows from names" }).click();

  await expect(page.getByText("Reusing library exercise").first()).toBeVisible();
  await page
    .getByText(existingName, { exact: true })
    .nth(1)
    .click();
  await page
    .getByLabel("Create a separate exercise anyway")
    .nth(1)
    .check();
  const sharedDefaults = page.getByRole("region", { name: "Shared defaults" });
  await sharedDefaults.getByLabel("Sets").fill("4");
  await sharedDefaults.getByLabel("Reps").fill("12");
  await sharedDefaults.getByLabel("Rest seconds").fill("35");
  await sharedDefaults.getByRole("button", { name: "Apply to all rows" }).click();
  await expect(page.getByText("Configuration applied", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create and add to routine" }).click();
  await expect(page.getByText("Exercises added")).toBeVisible();
  await page.getByRole("button", { name: "Configure 3 exercises" }).click();
  await expect
    .poll(() =>
      page
        .getByRole("navigation", { name: "Routine builder steps" })
        .evaluate((navigation) => Math.round(navigation.getBoundingClientRect().top))
    )
    .toBeLessThanOrEqual(24);
  const warmupExerciseCard = page.locator("article").filter({ hasText: newName });
  await warmupExerciseCard.getByLabel("Workout phase").selectOption("warmup");
  await expect(
    page.getByRole("region", { name: "Warm-up" }).getByText(newName, { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Details" }).click();
  await page
    .getByLabel("Warm-up guidance")
    .fill("Walk easily for five minutes before beginning.");
  await expect(page.getByText("Saving", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const [{ data: routineItems }, { count: duplicateNameCount }] =
    await Promise.all([
      admin
        .from("routine_exercises")
        .select("exercise_id, position, sets, reps, rest_seconds")
        .eq("routine_id", draft!.id)
        .order("position"),
      admin
        .from("exercises")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", coach.id)
        .eq("name", existingName)
    ]);
  expect(routineItems).toHaveLength(3);
  expect(routineItems?.[0].exercise_id).toBe(existingExercise!.id);
  expect(routineItems?.every((item) => item.reps === "12")).toBe(true);
  expect(routineItems?.every((item) => item.rest_seconds === 35)).toBe(true);
  expect(routineItems?.filter((item) => item.sets === 4)).toHaveLength(2);
  expect(duplicateNameCount).toBe(2);

  await page.goto("/dashboard/routines?view=drafts");
  await expect(page.getByRole("link", { name: new RegExp(routineName) })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(routineName) }).click();
  await page.getByRole("button", { name: "Configure" }).click();
  await expect(
    page.getByRole("region", { name: "Warm-up" }).getByText(newName, { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Walk easily for five minutes before beginning.")).toBeVisible();
  await page.getByRole("button", { name: "Review routine" }).click();
  await page.getByRole("button", { name: "Publish and continue" }).click();

  await expect(page.getByText("Assign trainees").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Archive routine" })).toBeVisible();
  const { data: published } = await admin
    .from("workout_routines")
    .select("status")
    .eq("id", draft!.id)
    .single();
  expect(published?.status).toBe("published");
});

test("@smoke bulk-created library exercises can start a prefilled routine draft", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const firstExerciseName = `Library push ${uniqueValue("exercise")}`;
  const secondExerciseName = `Library pull ${uniqueValue("exercise")}`;
  const routineName = `Prefilled ${uniqueValue("routine")}`;

  await logIn(page, coach);
  await page.goto("/dashboard/exercises/bulk-new");
  await page
    .getByPlaceholder("Push-up\nPull-up\nBodyweight squat")
    .fill(`${firstExerciseName}\n${secondExerciseName}`);
  await page.getByRole("button", { name: "Create rows from names" }).click();
  await page
    .getByLabel("Thumbnail")
    .first()
    .setInputFiles("public/brand/sthenos/app-icon-192.png");
  await page.getByRole("button", { name: "Create exercises", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Exercises are ready" })).toBeVisible();
  await page.getByRole("link", { name: "Start routine with exercises" }).click();
  await expect(page.getByText("2 selected exercises")).toBeVisible();
  await page.getByLabel("Routine name").fill(routineName);
  await page.getByRole("button", { name: "Start building" }).click();
  await page.getByRole("button", { name: "Configure 2 exercises" }).click();
  await expect(page.getByText(firstExerciseName, { exact: true })).toBeVisible();
  await expect(page.getByText(secondExerciseName, { exact: true })).toBeVisible();

  const { data: firstExercise } = await admin
    .from("exercises")
    .select("id, thumbnail_url")
    .eq("coach_id", coach.id)
    .eq("name", firstExerciseName)
    .single();
  const { data: routine } = await admin
    .from("workout_routines")
    .select("id, status")
    .eq("coach_id", coach.id)
    .eq("name", routineName)
    .single();
  const { count: routineItemCount } = await admin
    .from("routine_exercises")
    .select("id", { count: "exact", head: true })
    .eq("routine_id", routine!.id);

  expect(firstExercise?.thumbnail_url).toContain("/exercise-media/");
  expect(routine?.status).toBe("draft");
  expect(routineItemCount).toBe(2);
});
