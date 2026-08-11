import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a trainee is guided through warm-up, workout, and cool-down phases", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const routineName = `Complete session ${uniqueValue("routine")}`;

  const [{ data: client }, { data: routine }, { data: exercises }] = await Promise.all([
    admin
      .from("clients")
      .insert({
        coach_id: coach.id,
        client_user_id: trainee.id,
        name: `Phased ${uniqueValue("client")}`,
        email: trainee.email,
        invitation_accepted_at: new Date().toISOString(),
        status: "active"
      })
      .select("id")
      .single(),
    admin
      .from("workout_routines")
      .insert({
        coach_id: coach.id,
        name: routineName,
        routine_type: "individual",
        default_cycles: 1,
        warmup_notes: "Raise your temperature gradually.",
        workout_notes: "Use controlled repetitions.",
        cooldown_notes: "Slow your breathing before finishing."
      })
      .select("id")
      .single(),
    admin
      .from("exercises")
      .insert([
        { coach_id: coach.id, name: `Easy walk ${uniqueValue("exercise")}`, category: "Cardio" },
        { coach_id: coach.id, name: `Bodyweight squat ${uniqueValue("exercise")}`, category: "Strength" },
        { coach_id: coach.id, name: `Hamstring stretch ${uniqueValue("exercise")}`, category: "Flexibility" }
      ])
      .select("id")
  ]);

  expect(client).not.toBeNull();
  expect(routine).not.toBeNull();
  expect(exercises).toHaveLength(3);

  const [{ error: itemsError }, { error: assignmentError }] = await Promise.all([
    admin.from("routine_exercises").insert([
      { routine_id: routine!.id, exercise_id: exercises![0].id, position: 1, phase: "warmup", sets: 1, reps: "10 minutes" },
      { routine_id: routine!.id, exercise_id: exercises![1].id, position: 2, phase: "main", sets: 1, reps: "12" },
      { routine_id: routine!.id, exercise_id: exercises![2].id, position: 3, phase: "cooldown", sets: 1, reps: "30 seconds per side" }
    ]),
    admin.from("client_routines").insert({
      coach_id: coach.id,
      client_id: client!.id,
      routine_id: routine!.id,
      status: "active"
    })
  ]);
  expect(itemsError, itemsError?.message).toBeNull();
  expect(assignmentError, assignmentError?.message).toBeNull();

  await logIn(page, trainee);
  await page.getByRole("link", { name: "Begin workout" }).click();

  await expect(page.getByRole("heading", { name: "Warm-up" })).toBeVisible();
  await expect(page.getByText("Raise your temperature gradually.")).toBeVisible();
  await page.getByRole("button", { name: "Start warm-up" }).click();
  await page.getByRole("button", { name: "Finish warm-up" }).click();

  await expect(page.getByRole("heading", { name: "Main workout" })).toBeVisible();
  await expect(page.getByText("Use controlled repetitions.")).toBeVisible();
  await page.getByRole("button", { name: "Start main workout" }).click();
  await page.getByRole("button", { name: "Finish main workout" }).click();

  await expect(page.getByRole("heading", { name: "Cool-down" })).toBeVisible();
  await expect(page.getByText("Slow your breathing before finishing.")).toBeVisible();
  await page.getByRole("button", { name: "Start cool-down" }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();

  await expect(page.getByRole("heading", { name: "Workout complete" })).toBeVisible();
  await expect(page.getByText("Workout phases")).toBeVisible();
  await expect(
    page.getByText("Workout phases").locator("..").getByText("3", { exact: true })
  ).toBeVisible();
});
