import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a coach filters the compact Exercise Library and keeps Routine Builder selections", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const marker = uniqueValue("browser");
  const names = {
    alpha: `Alpha press ${marker}`,
    beta: `Beta pull ${marker}`,
    gamma: `Gamma mobility ${marker}`,
    delta: `Delta walk ${marker}`,
    epsilon: `Epsilon push ${marker}`
  };
  const { data: exercises, error: exerciseError } = await admin
    .from("exercises")
    .insert([
      { coach_id: coach.id, name: names.alpha, category: "Strength", difficulty: 1, equipment: "None", movement_pattern: "Push", primary_muscles: ["Chest"], created_at: "2026-01-01T00:00:00.000Z" },
      { coach_id: coach.id, name: names.beta, category: "Strength", difficulty: 3, equipment: "Pull-up bar", movement_pattern: "Pull", primary_muscles: ["Upper back"], created_at: "2026-02-01T00:00:00.000Z" },
      { coach_id: coach.id, name: names.gamma, category: "Mobility", difficulty: 2, equipment: "Resistance band", movement_pattern: "Mobility flow", primary_muscles: ["Shoulders"], created_at: "2026-03-01T00:00:00.000Z" },
      { coach_id: coach.id, name: names.delta, category: "Cardio", difficulty: 2, equipment: "Treadmill", movement_pattern: "Carry", primary_muscles: ["Calves"], created_at: "2026-05-01T00:00:00.000Z" },
      { coach_id: coach.id, name: names.epsilon, category: "Strength", difficulty: 4, equipment: "Resistance band", movement_pattern: "Push", primary_muscles: ["Chest"], created_at: "2026-04-01T00:00:00.000Z" }
    ])
    .select("id, name");
  expect(exerciseError, exerciseError?.message).toBeNull();
  expect(exercises).toHaveLength(5);

  const { data: routine, error: routineError } = await admin
    .from("workout_routines")
    .insert({
      coach_id: coach.id,
      name: `Filtered routine ${marker}`,
      routine_type: "individual",
      default_cycles: 1,
      status: "draft"
    })
    .select("id")
    .single();
  expect(routineError, routineError?.message).toBeNull();

  await logIn(page, coach);
  await page.goto("/dashboard/exercises");
  await expect(page.getByRole("heading", { name: "Exercise Library" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Exercise Library" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Routine Builder" })).toBeVisible();
  await expect(page.getByText("Showing 5 of 5 exercises")).toBeVisible();

  const filters = page.getByRole("region", { name: "Exercise filters" });
  await filters.getByRole("button", { name: "Category" }).click();
  await page.getByRole("option", { name: "Strength" }).getByRole("checkbox").check();
  await page.getByRole("option", { name: "Mobility" }).getByRole("checkbox").check();
  await filters.getByRole("button", { name: "Equipment" }).click();
  await page.getByRole("option", { name: "Resistance band" }).getByRole("checkbox").check();
  await filters.getByRole("button", { name: "Difficulty" }).click();
  await page.getByRole("option", { name: "2" }).getByRole("checkbox").check();
  await page.getByRole("option", { name: "4" }).getByRole("checkbox").check();
  await filters.getByRole("button", { name: "Movement pattern" }).click();
  await page.getByRole("option", { name: "Mobility flow" }).getByRole("checkbox").check();
  await page.getByRole("option", { name: "Push" }).getByRole("checkbox").check();
  await filters.getByRole("button", { name: "Primary muscles" }).click();
  await page.getByRole("option", { name: "Shoulders" }).getByRole("checkbox").check();
  await page.getByRole("option", { name: "Chest" }).getByRole("checkbox").check();

  await expect(page.getByText("Showing 2 of 5 exercises")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("category")).toBe("Strength,Mobility");
  await expect(page.getByRole("button", { name: "Remove Equipment: Resistance band" })).toBeVisible();

  const results = page.getByRole("region", { name: "Exercise results" });
  await results.getByRole("link", { name: new RegExp(names.gamma) }).click();
  await expect(page.getByRole("heading", { name: names.gamma })).toBeVisible();
  await page.goBack();
  await expect(page.getByText("Showing 2 of 5 exercises")).toBeVisible();

  await page.getByRole("button", { name: "Clear all" }).click();
  await filters.getByLabel("Sort by").selectOption("recent");
  await expect(results.getByRole("link").first()).toContainText(names.delta);
  const firstFourRows = await results.getByRole("link").evaluateAll((cards) =>
    cards.slice(0, 4).map((card) => Math.round(card.getBoundingClientRect().top))
  );
  expect(new Set(firstFourRows).size).toBe(1);

  await filters.getByLabel("Search exercises").fill("No matching movement");
  await expect(page.getByText("No exercises match the current filters.")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("No matching movement");

  await page.goto(`/dashboard/routines/${routine!.id}?step=exercises`);
  await expect(page.getByRole("link", { name: "Routine Builder" })).toHaveAttribute("aria-current", "page");
  await page.getByLabel("Search exercises").fill(names.alpha);
  await page.getByRole("checkbox", { name: names.alpha }).click();
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await page.getByLabel("Search exercises").fill(names.delta);
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: names.delta }).click();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add 2 to routine" }).click();
  await expect(page.getByText("Exercises added", { exact: true })).toBeVisible();

  const { count } = await admin
    .from("routine_exercises")
    .select("id", { count: "exact", head: true })
    .eq("routine_id", routine!.id);
  expect(count).toBe(2);
});
