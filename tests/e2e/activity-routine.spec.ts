import path from "node:path";
import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a coach can create and assign a reusable activity routine", async ({
  admin,
  browser,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const clientName = `Activity ${uniqueValue("client")}`;
  const routineName = `Soccer match ${uniqueValue("activity")}`;
  const activityNotes = `Competitive match ${uniqueValue("notes")}`;
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

  expect(clientError, clientError?.message).toBeNull();
  expect(client).not.toBeNull();

  await logIn(page, coach);
  await page.goto("/dashboard/routines/new");
  await page.getByLabel("Routine name").fill(routineName);
  await page
    .getByLabel("Description")
    .fill("Log a completed soccer match without an exercise sequence.");
  await page.getByLabel("Routine structure").selectOption("activity");
  await expect(page.getByText("Activities skip the exercise player")).toBeVisible();
  await page.getByLabel("Activity thumbnail").setInputFiles(
    path.join(process.cwd(), "public/brand/sthenos/app-icon-192.png")
  );
  await page.getByRole("button", { name: "Create routine" }).click();

  await expect(page.getByRole("heading", { name: routineName })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activity routine" })).toBeVisible();
  await expect(
    page.getByAltText(`${routineName} activity reference`)
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Add exercise to routine" })
  ).not.toBeVisible();

  const { data: routine, error: routineError } = await admin
    .from("workout_routines")
    .select("id, routine_type, thumbnail_url")
    .eq("coach_id", coach.id)
    .eq("name", routineName)
    .single();

  expect(routineError, routineError?.message).toBeNull();
  expect(routine?.routine_type).toBe("activity");
  expect(routine?.thumbnail_url).toContain("/routine-media/");

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
    await expect(
      traineePage.getByRole("heading", { name: routineName })
    ).toBeVisible();
    await expect(
      traineePage.getByAltText(`${routineName} activity reference`)
    ).toBeVisible();
    await expect(
      traineePage.getByRole("link", { name: "Begin workout" })
    ).not.toBeVisible();

    await traineePage.getByRole("button", { name: "Log activity" }).click();
    await expect(
      traineePage.getByRole("heading", { name: `Log ${routineName}` })
    ).toBeVisible();
    await traineePage.getByLabel("Duration in minutes").fill("90");
    await traineePage.getByLabel("Activity notes").fill(activityNotes);
    await traineePage
      .getByRole("button", { name: "Complete activity" })
      .click();

    await expect(traineePage.getByText("Activity completed")).toBeVisible();
    await expect(
      traineePage.getByRole("button", { name: "Log activity" })
    ).toBeVisible();
  } finally {
    await traineeContext.close();
  }

  const [{ data: logs, error: logsError }, { data: assignment }] =
    await Promise.all([
      admin
        .from("workout_logs")
        .select("duration_minutes, notes")
        .eq("client_id", client!.id)
        .eq("routine_id", routine!.id),
      admin
        .from("client_routines")
        .select("status")
        .eq("client_id", client!.id)
        .eq("routine_id", routine!.id)
        .single()
    ]);

  expect(logsError, logsError?.message).toBeNull();
  expect(logs).toEqual([
    expect.objectContaining({ duration_minutes: 90, notes: activityNotes })
  ]);
  expect(assignment?.status).toBe("active");

  const storagePath = decodeURIComponent(
    new URL(routine!.thumbnail_url!).pathname.split("/routine-media/")[1]
  );
  await admin.storage.from("routine-media").remove([storagePath]);
});
