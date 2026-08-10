import { test, expect, logIn, uniqueValue } from "./support/fixtures";

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

test("@smoke coach and trainee analytics turn shared history into accessible trends", async ({
  admin,
  browser,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const otherCoach = await users.create("coach");
  const trainee = await users.create("trainee");
  const recentName = `Analytics ${uniqueValue("recent")}`;
  const staleName = `Analytics ${uniqueValue("stale")}`;
  const freshName = `Analytics ${uniqueValue("fresh")}`;
  const privateName = `Private ${uniqueValue("other-coach")}`;
  const routineName = `Strength ${uniqueValue("analytics")}`;
  const activityName = `Run ${uniqueValue("analytics")}`;
  const recentDate = dateDaysAgo(2);
  const priorDate = dateDaysAgo(8);
  const olderBodyDate = dateDaysAgo(50);

  const { data: clients, error: clientError } = await admin
    .from("clients")
    .insert([
      {
        coach_id: coach.id,
        client_user_id: trainee.id,
        name: recentName,
        email: trainee.email,
        status: "active",
        created_at: `${dateDaysAgo(90)}T12:00:00.000Z`
      },
      {
        coach_id: coach.id,
        name: staleName,
        status: "active",
        created_at: `${dateDaysAgo(40)}T12:00:00.000Z`
      },
      {
        coach_id: coach.id,
        name: freshName,
        status: "active",
        created_at: `${dateDaysAgo(1)}T12:00:00.000Z`
      },
      {
        coach_id: otherCoach.id,
        name: privateName,
        status: "active",
        created_at: `${dateDaysAgo(90)}T12:00:00.000Z`
      }
    ])
    .select("id, name");
  expect(clientError, clientError?.message).toBeNull();
  const recentClient = clients?.find((client) => client.name === recentName);
  expect(recentClient).toBeTruthy();

  const { data: routine, error: routineError } = await admin
    .from("workout_routines")
    .insert({ coach_id: coach.id, name: routineName })
    .select("id")
    .single();
  expect(routineError, routineError?.message).toBeNull();

  const { data: activity, error: activityError } = await admin
    .from("activities")
    .insert({
      coach_id: coach.id,
      name: activityName,
      tracked_metrics: ["distance_km"],
      required_metrics: ["distance_km"],
      default_targets: { distance_km: 5 }
    })
    .select("id")
    .single();
  expect(activityError, activityError?.message).toBeNull();

  const { data: assignment, error: assignmentError } = await admin
    .from("client_activities")
    .insert({
      coach_id: coach.id,
      client_id: recentClient!.id,
      activity_id: activity!.id,
      tracked_metrics: ["distance_km"],
      required_metrics: ["distance_km"],
      targets: { distance_km: 5 }
    })
    .select("id")
    .single();
  expect(assignmentError, assignmentError?.message).toBeNull();

  const [{ error: workoutError }, { error: activityLogError }, { error: bodyError }] = await Promise.all([
    admin.from("workout_logs").insert([
      { coach_id: coach.id, client_id: recentClient!.id, routine_id: routine!.id, trained_on: recentDate },
      { coach_id: coach.id, client_id: recentClient!.id, routine_id: routine!.id, trained_on: recentDate },
      { coach_id: coach.id, client_id: recentClient!.id, routine_id: routine!.id, trained_on: priorDate }
    ]),
    admin.from("activity_logs").insert({
      coach_id: coach.id,
      client_id: recentClient!.id,
      activity_id: activity!.id,
      assignment_id: assignment!.id,
      performed_on: recentDate,
      distance_km: 5.4
    }),
    admin.from("body_progress_entries").insert([
      { coach_id: coach.id, client_id: recentClient!.id, recorded_on: olderBodyDate, body_weight: 78 },
      { coach_id: coach.id, client_id: recentClient!.id, recorded_on: recentDate, body_weight: 79.5, body_fat_percentage: 17.8 }
    ])
  ]);
  expect(workoutError, workoutError?.message).toBeNull();
  expect(activityLogError, activityLogError?.message).toBeNull();
  expect(bodyError, bodyError?.message).toBeNull();

  await logIn(page, coach);
  await page.goto("/dashboard/progress");

  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Progress date range" }).getByRole("link", { name: "12 weeks" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await expect(page.getByRole("link", { name: staleName })).toBeVisible();
  await expect(page.getByText(freshName, { exact: true })).toHaveCount(0);
  await expect(page.getByText(privateName, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/3 workouts and 1 activities across the selected period/)).toBeAttached();
  await expect(page.getByText(/3 active clients are shown for 12 weeks/)).toBeAttached();

  const thirtyDays = page.getByRole("navigation", { name: "Progress date range" }).getByRole("link", { name: "30 days" });
  await thirtyDays.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/range=30d/);
  await expect(page.getByRole("link", { name: "30 days" })).toHaveAttribute("aria-current", "page");

  const traineeContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const traineePage = await traineeContext.newPage();
  try {
    await logIn(traineePage, trainee);
    await traineePage.goto("/trainee/progress");
    await expect(traineePage.getByRole("heading", { name: "Your progress" })).toBeVisible();
    await expect(traineePage.getByRole("heading", { name: "Training consistency" })).toBeVisible();
    await expect(traineePage.getByText(/2 training days across the selected period, with 3 workouts and 1 activities/)).toBeAttached();
    await expect(traineePage.getByRole("heading", { name: "Body progress trend" })).toBeVisible();
    await expect(traineePage.getByText("79.5 kg", { exact: true }).first()).toBeVisible();
    await expect(traineePage.getByText("+1.5 kg", { exact: true })).toBeVisible();
    await expect(traineePage.getByRole("heading", { name: "Activity results" })).toBeVisible();
    await expect(traineePage.getByLabel("Activity result")).toHaveValue(activity!.id);
    await expect(traineePage.getByLabel("Activity metric")).toHaveValue("distance_km");
    await expect(traineePage.getByText("Actual", { exact: true })).toBeVisible();
    await expect(traineePage.getByText("Target", { exact: true })).toBeVisible();
  } finally {
    await traineeContext.close();
  }
});
