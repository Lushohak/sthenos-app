import { readFile } from "node:fs/promises";
import { test, expect, logIn, uniqueValue } from "./support/fixtures";

function expectedPdfName(value: string) {
  return `${value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()}.pdf`;
}

test("@smoke a trainee can save a routine PDF and quickly log the workout", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const clientName = `Offline ${uniqueValue("client")}`;
  const routineName = `Offline gym ${uniqueValue("routine")}`;
  const exerciseName = `Offline press ${uniqueValue("exercise")}`;
  const completionNote = `Completed from preview ${uniqueValue("note")}`;

  const [
    { data: client, error: clientError },
    { data: routine, error: routineError },
    { data: exercise, error: exerciseError }
  ] = await Promise.all([
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
    admin
      .from("workout_routines")
      .insert({
        coach_id: coach.id,
        name: routineName,
        description: "A routine exported for offline reading.",
        routine_type: "gym",
        default_cycles: 1
      })
      .select("id")
      .single(),
    admin
      .from("exercises")
      .insert({
        coach_id: coach.id,
        name: exerciseName,
        category: "Strength",
        equipment: "Barbell",
        difficulty: 2,
        thumbnail_url:
          "http://127.0.0.1:3100/brand/sthenos/app-icon-192.png"
      })
      .select("id")
      .single()
  ]);

  expect(clientError, clientError?.message).toBeNull();
  expect(routineError, routineError?.message).toBeNull();
  expect(exerciseError, exerciseError?.message).toBeNull();

  const { data: additionalExercises, error: additionalExercisesError } =
    await admin
      .from("exercises")
      .insert([
        {
          coach_id: coach.id,
          name: `Offline row ${uniqueValue("exercise")}`,
          category: "Strength",
          equipment: "Cable",
          difficulty: 2,
          thumbnail_url:
            "http://127.0.0.1:3100/brand/sthenos/app-icon-192.png"
        },
        {
          coach_id: coach.id,
          name: `Offline squat ${uniqueValue("exercise")}`,
          category: "Strength",
          equipment: "Barbell",
          difficulty: 2,
          thumbnail_url:
            "http://127.0.0.1:3100/brand/sthenos/app-icon-192.png"
        }
      ])
      .select("id");

  expect(additionalExercisesError, additionalExercisesError?.message).toBeNull();
  expect(additionalExercises).toHaveLength(2);

  const { error: routineExerciseError } = await admin
    .from("routine_exercises")
    .insert([
      {
        routine_id: routine!.id,
        exercise_id: exercise!.id,
        position: 1,
        sets: 3,
        reps: "8",
        rest_seconds: 60,
        notes: "Keep the shoulder blades stable."
      },
      {
        routine_id: routine!.id,
        exercise_id: additionalExercises![0].id,
        position: 2,
        sets: 3,
        reps: "10",
        rest_seconds: 45,
        notes: "Keep the elbows close to the body."
      },
      {
        routine_id: routine!.id,
        exercise_id: additionalExercises![1].id,
        position: 3,
        sets: 4,
        reps: "6",
        rest_seconds: 90,
        notes: "Brace before beginning each repetition."
      }
    ]);
  const { error: assignmentError } = await admin.from("client_routines").insert({
    coach_id: coach.id,
    client_id: client!.id,
    routine_id: routine!.id,
    status: "active",
    notes: "Use a controlled tempo."
  });

  expect(routineExerciseError, routineExerciseError?.message).toBeNull();
  expect(assignmentError, assignmentError?.message).toBeNull();

  await logIn(page, trainee);
  await expect(page.getByRole("heading", { name: routineName })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(expectedPdfName(routineName));
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const pdfBytes = await readFile(downloadedPath!);
  expect(pdfBytes.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdfBytes.byteLength).toBeGreaterThan(5_000);
  expect(pdfBytes.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(2);

  await page.getByRole("link", { name: "Begin workout" }).click();
  await page.getByRole("button", { name: "Complete workout" }).click();
  await expect(
    page.getByRole("heading", { name: "Complete this workout?" })
  ).toBeVisible();
  await page.getByLabel("Duration in minutes").fill("55");
  await page.getByLabel("Completion notes").fill(completionNote);
  await page.getByRole("button", { name: "Save completed workout" }).click();
  await expect(
    page.getByRole("heading", { name: "Workout saved" })
  ).toBeVisible();

  const { data: log, error: logError } = await admin
    .from("workout_logs")
    .select("notes, duration_minutes")
    .eq("client_id", client!.id)
    .eq("routine_id", routine!.id)
    .single();

  expect(logError, logError?.message).toBeNull();
  expect(log).toEqual(
    expect.objectContaining({
      notes: completionNote,
      duration_minutes: 55
    })
  );
});
