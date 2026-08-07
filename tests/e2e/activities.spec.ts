import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a coach customizes a one-time Activity and a trainee logs its required metrics", async ({
  admin,
  browser,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const clientName = `Activity ${uniqueValue("client")}`;
  const activityName = `Soccer match ${uniqueValue("activity")}`;
  const plannedFor = "2026-08-15";
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

  await logIn(page, coach);
  await page.goto("/dashboard/activities/new");
  await page.getByLabel("Activity name").fill(activityName);
  await page.getByLabel("Description").fill("A competitive match with measurable effort.");
  await page.getByLabel("Activity thumbnail").setInputFiles(
    path.join(process.cwd(), "public/brand/sthenos/app-icon-192.png")
  );
  await page.locator('input[name="tracked_metrics"][value="duration_minutes"]').check();
  await page.locator('input[name="required_duration_minutes"]').check();
  await page.getByLabel("Default target (min)").fill("60");
  await page.locator('input[name="tracked_metrics"][value="distance_km"]').check();
  await page.getByLabel("Default target (km)").fill("5");
  await page.locator('input[name="tracked_metrics"][value="perceived_intensity"]').check();
  await page.locator('input[name="required_perceived_intensity"]').check();
  await page.getByLabel("Default target (RPE)").fill("7");
  await page.getByRole("button", { name: "Create Activity" }).click();

  await expect(page.getByRole("heading", { name: activityName })).toBeVisible();
  await expect(page.getByText("Target: 60 min")).toBeVisible();
  const { data: activity, error: activityError } = await admin
    .from("activities")
    .select("*")
    .eq("coach_id", coach.id)
    .eq("name", activityName)
    .single();
  expect(activityError, activityError?.message).toBeNull();
  expect(activity?.thumbnail_url).toContain("/activity-media/");

  await page.goto(`/dashboard/routines/${activity!.id}`);
  await expect(page).toHaveURL(`/dashboard/activities/${activity!.id}`);
  await page.goto(`/dashboard/routines/${activity!.id}/assign`);
  await expect(page).toHaveURL(`/dashboard/activities/${activity!.id}/assign`);
  await page.goto(`/dashboard/activities/${activity!.id}`);

  await page.getByRole("link", { name: "Edit Activity" }).click();
  await page.getByLabel("Default target (min)").fill("70");
  await page.getByRole("button", { name: "Save Activity" }).click();
  await expect(page.getByText("Target: 70 min")).toBeVisible();

  await page.goto(`/dashboard/clients/${client!.id}`);
  await page.locator('select[name="activity_id"]').selectOption(activity!.id);
  await page.locator('select[name="assignment_mode"]').selectOption("one_time");
  await page.getByLabel("Planned date").fill(plannedFor);
  await page.locator('input[name="target_duration_minutes"]').fill("75");
  await page.locator('input[name="target_distance_km"]').fill("6");
  await page.locator('input[name="target_perceived_intensity"]').fill("8");
  await page.getByRole("button", { name: "Assign Activity" }).click();
  await expect(page.getByText("Activity assigned")).toBeVisible();

  const { data: assignment, error: assignmentError } = await admin
    .from("client_activities")
    .select("*")
    .eq("client_id", client!.id)
    .eq("activity_id", activity!.id)
    .single();
  expect(assignmentError, assignmentError?.message).toBeNull();
  expect(assignment).toEqual(expect.objectContaining({
    assignment_mode: "one_time",
    planned_for: plannedFor,
    status: "active",
    tracked_metrics: ["duration_minutes", "distance_km", "perceived_intensity"],
    required_metrics: ["duration_minutes", "perceived_intensity"],
    targets: { duration_minutes: 75, distance_km: 6, perceived_intensity: 8 }
  }));

  const traineeContext = await browser.newContext();
  const traineePage = await traineeContext.newPage();
  try {
    await logIn(traineePage, trainee);
    await expect(traineePage.getByRole("heading", { name: activityName })).toBeVisible();
    await expect(traineePage.getByText(`Planned for Aug 15, 2026`)).toBeVisible();
    await traineePage.getByRole("button", { name: "Log Activity" }).click();
    await traineePage.getByLabel("Duration (min)").fill("90");
    await traineePage.getByLabel("Perceived intensity (RPE)").fill("9");
    await traineePage.getByLabel("Activity notes").fill("High-tempo match.");
    await traineePage.getByRole("button", { name: "Complete Activity" }).click();
    await expect(traineePage.getByText("Activity completed")).toBeVisible();
    await expect(traineePage.getByText(/90 min \/ 75 min target/)).toBeVisible();
    await expect(traineePage.getByText(/9\/10 RPE \/ 8\/10 RPE target/)).toBeVisible();
    await traineePage.goto("/trainee/progress");
    await expect(traineePage.getByRole("heading", { name: "Activity insights · Last 30 days" })).toBeVisible();
    await expect(traineePage.getByText("90 min", { exact: true })).toBeVisible();
  } finally {
    await traineeContext.close();
  }

  const [{ data: log }, { data: completedAssignment }] = await Promise.all([
    admin.from("activity_logs").select("*").eq("assignment_id", assignment!.id).single(),
    admin.from("client_activities").select("status").eq("id", assignment!.id).single()
  ]);
  expect(log).toEqual(expect.objectContaining({ duration_minutes: 90, distance_km: null, perceived_intensity: 9, notes: "High-tempo match." }));
  expect(completedAssignment?.status).toBe("completed");

  await page.goto(`/dashboard/clients/${client!.id}`);
  await expect(page.getByText(/90 min \/ 75 min target/)).toBeVisible();
  await page.goto("/dashboard/progress");
  await expect(page.getByRole("heading", { name: "Activity summary · Last 30 days" })).toBeVisible();
  await expect(page.getByRole("link", { name: clientName })).toBeVisible();

  const { data: concurrentAssignment, error: concurrentAssignmentError } = await admin
    .from("client_activities")
    .insert({
      coach_id: coach.id,
      client_id: client!.id,
      activity_id: activity!.id,
      assignment_mode: "one_time",
      tracked_metrics: ["duration_minutes"],
      required_metrics: ["duration_minutes"],
      targets: { duration_minutes: 60 }
    })
    .select("id")
    .single();
  expect(concurrentAssignmentError, concurrentAssignmentError?.message).toBeNull();

  const authenticatedTrainee = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: signInError } = await authenticatedTrainee.auth.signInWithPassword({
    email: trainee.email,
    password: trainee.password
  });
  expect(signInError, signInError?.message).toBeNull();
  const concurrentResults = await Promise.all([
    authenticatedTrainee.rpc("create_assigned_activity_log", {
      target_assignment_id: concurrentAssignment!.id,
      target_performed_on: "2026-08-06",
      target_duration_minutes: 60
    }),
    authenticatedTrainee.rpc("create_assigned_activity_log", {
      target_assignment_id: concurrentAssignment!.id,
      target_performed_on: "2026-08-06",
      target_duration_minutes: 60
    })
  ]);
  expect(concurrentResults.filter((result) => result.error)).toHaveLength(1);
  const { count: concurrentLogCount } = await admin
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", concurrentAssignment!.id);
  expect(concurrentLogCount).toBe(1);

  const { error: invalidTargetError } = await admin.from("client_activities").insert({
    coach_id: coach.id,
    client_id: client!.id,
    activity_id: activity!.id,
    assignment_mode: "repeatable",
    tracked_metrics: ["duration_minutes"],
    required_metrics: ["duration_minutes"],
    targets: { duration_minutes: 0 }
  });
  expect(invalidTargetError).not.toBeNull();

  const { data: repeatableAssignment, error: repeatableAssignmentError } = await admin
    .from("client_activities")
    .insert({
      coach_id: coach.id,
      client_id: client!.id,
      activity_id: activity!.id,
      assignment_mode: "repeatable",
      tracked_metrics: ["duration_minutes"],
      required_metrics: ["duration_minutes"],
      targets: { duration_minutes: 40 }
    })
    .select("id")
    .single();
  expect(repeatableAssignmentError, repeatableAssignmentError?.message).toBeNull();
  const invalidMetric = await authenticatedTrainee.rpc("create_assigned_activity_log", {
    target_assignment_id: repeatableAssignment!.id,
    target_performed_on: "2026-08-06",
    target_duration_minutes: 1441
  });
  expect(invalidMetric.error).not.toBeNull();
  const repeatableResults = await Promise.all([
    authenticatedTrainee.rpc("create_assigned_activity_log", {
      target_assignment_id: repeatableAssignment!.id,
      target_performed_on: "2026-08-05",
      target_duration_minutes: 30
    }),
    authenticatedTrainee.rpc("create_assigned_activity_log", {
      target_assignment_id: repeatableAssignment!.id,
      target_performed_on: "2026-08-06",
      target_duration_minutes: 45
    })
  ]);
  expect(repeatableResults.every((result) => result.error === null)).toBe(true);
  const [{ count: repeatableLogCount }, { data: repeatableStatus }] = await Promise.all([
    admin.from("activity_logs").select("id", { count: "exact", head: true }).eq("assignment_id", repeatableAssignment!.id),
    admin.from("client_activities").select("status").eq("id", repeatableAssignment!.id).single()
  ]);
  expect(repeatableLogCount).toBe(2);
  expect(repeatableStatus?.status).toBe("active");

  const outsiderCoach = await users.create("coach");
  const outsider = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: outsiderSignInError } = await outsider.auth.signInWithPassword({
    email: outsiderCoach.email,
    password: outsiderCoach.password
  });
  expect(outsiderSignInError, outsiderSignInError?.message).toBeNull();
  const [hiddenActivities, hiddenAssignments, hiddenLogs, unauthorizedLog] = await Promise.all([
    outsider.from("activities").select("id").eq("id", activity!.id),
    outsider.from("client_activities").select("id").eq("client_id", client!.id),
    outsider.from("activity_logs").select("id").eq("client_id", client!.id),
    outsider.rpc("create_assigned_activity_log", {
      target_assignment_id: assignment!.id,
      target_performed_on: "2026-08-06",
      target_duration_minutes: 60,
      target_perceived_intensity: 8
    })
  ]);
  expect(hiddenActivities.data).toEqual([]);
  expect(hiddenAssignments.data).toEqual([]);
  expect(hiddenLogs.data).toEqual([]);
  expect(unauthorizedLog.error).not.toBeNull();

  const storagePath = decodeURIComponent(
    new URL(activity!.thumbnail_url!).pathname.split("/activity-media/")[1]
  );
  await admin.storage.from("activity-media").remove([storagePath]);
});

test("@smoke a coach bulk assigns, pauses, archives, restores, and resumes an Activity", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const traineeA = await users.create("trainee");
  const traineeB = await users.create("trainee");
  const activityName = `Morning walk ${uniqueValue("activity")}`;
  const clientNames = [`Walker A ${uniqueValue("client")}`, `Walker B ${uniqueValue("client")}`];
  const { data: clients, error: clientsError } = await admin.from("clients").insert([
    { coach_id: coach.id, client_user_id: traineeA.id, name: clientNames[0], status: "active" },
    { coach_id: coach.id, client_user_id: traineeB.id, name: clientNames[1], status: "active" }
  ]).select("id, name");
  const { data: activity, error: activityError } = await admin.from("activities").insert({
    coach_id: coach.id,
    name: activityName,
    tracked_metrics: ["distance_km"],
    required_metrics: [],
    default_targets: { distance_km: 3 }
  }).select("id").single();
  expect(clientsError, clientsError?.message).toBeNull();
  expect(activityError, activityError?.message).toBeNull();

  await logIn(page, coach);
  await page.goto(`/dashboard/activities/${activity!.id}/assign`);
  await page.getByRole("checkbox", { name: new RegExp(clientNames[0]) }).check();
  await page.getByRole("checkbox", { name: new RegExp(clientNames[1]) }).check();
  await page.getByRole("button", { name: "Assign Activity to 2 trainees" }).click();
  await expect(page.getByText("Activity assigned")).toBeVisible();

  const firstClient = clients!.find((client) => client.name === clientNames[0])!;
  await page.goto(`/dashboard/clients/${firstClient.id}`);
  await page.getByRole("button", { name: "Select active Activities" }).click();
  await page.getByRole("checkbox", { name: activityName }).check();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Pause 1 Activity" }).click();
  await expect(page.getByText("Activity paused")).toBeVisible();

  await page.goto(`/dashboard/activities/${activity!.id}`);
  await page.getByRole("button", { name: "Archive Activity" }).click();
  await page.getByRole("button", { name: "Archive Activity" }).last().click();
  await expect(page).toHaveURL(/\/dashboard\/activities$/);
  await expect(page.getByText(`${activityName} archived`)).toBeVisible();

  await page.goto(`/dashboard/clients/${firstClient.id}`);
  await page.getByRole("button", { name: "Select paused Activities" }).click();
  await expect(page.getByRole("checkbox", { name: new RegExp(activityName) })).toBeDisabled();
  await page.getByRole("button", { name: "Select paused Activities" }).click();

  await page.goto(`/dashboard/activities/${activity!.id}`);
  await page.getByRole("button", { name: "Restore Activity" }).click();
  await page.getByRole("button", { name: "Restore Activity" }).last().click();
  await expect(page).toHaveURL(/\/dashboard\/activities$/);
  await expect(page.getByText(`${activityName} restored`)).toBeVisible();

  await page.goto(`/dashboard/clients/${firstClient.id}`);
  await page.getByRole("button", { name: "Select paused Activities" }).click();
  await page.getByRole("checkbox", { name: activityName }).check();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Resume 1 Activity" }).click();
  await expect(page.getByText("Activity resumed")).toBeVisible();

  await page.getByRole("button", { name: "Log Activity" }).click();
  await page.getByLabel("Distance (km)").fill("4.25");
  await page.getByLabel("Activity notes").fill("Logged by coach");
  await page.getByRole("button", { name: "Complete Activity" }).click();
  await expect(page.getByText("Activity completed")).toBeVisible();

  const { data: finalAssignments } = await admin
    .from("client_activities")
    .select("status")
    .eq("activity_id", activity!.id);
  expect(finalAssignments).toHaveLength(2);
  expect(finalAssignments?.every((assignment) => assignment.status === "active")).toBe(true);
  const { data: coachLog } = await admin
    .from("activity_logs")
    .select("distance_km, notes")
    .eq("client_id", firstClient.id)
    .single();
  expect(coachLog).toEqual(expect.objectContaining({ distance_km: 4.25, notes: "Logged by coach" }));
});
