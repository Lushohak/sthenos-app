import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect, logIn, uniqueValue, type TestUser } from "./support/fixtures";
import type { Database } from "@/types/database";

function dateFromMonday(dayOffset: number) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday + dayOffset);
  return date.toISOString().slice(0, 10);
}

function authenticatedClient(user: TestUser) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return { client, user };
}

test("@smoke peers share recent training and forgiving weekly streaks without exposing private details", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const otherCoach = await users.create("coach");
  const viewer = await users.create("trainee", `Viewer ${uniqueValue("peer")}`);
  const consistentPeer = await users.create("trainee", `Consistent ${uniqueValue("peer")}`);
  const privatePeer = await users.create("trainee", `Private ${uniqueValue("peer")}`);
  const lapsedPeer = await users.create("trainee", `Lapsed ${uniqueValue("peer")}`);
  const archivedPeer = await users.create("trainee", `Archived ${uniqueValue("peer")}`);
  const outsidePeer = await users.create("trainee", `Outside ${uniqueValue("peer")}`);
  const viewerFirstName = viewer.name.split(" ")[0];
  const consistentFirstName = consistentPeer.name.split(" ")[0];
  const privateFirstName = privatePeer.name.split(" ")[0];
  const archivedFirstName = archivedPeer.name.split(" ")[0];
  const outsideFirstName = outsidePeer.name.split(" ")[0];

  const { data: clients, error: clientsError } = await admin
    .from("clients")
    .insert([
      { coach_id: coach.id, client_user_id: viewer.id, name: viewer.name, email: viewer.email, status: "active", peer_activity_sharing_enabled: true },
      { coach_id: coach.id, client_user_id: consistentPeer.id, name: consistentPeer.name, email: consistentPeer.email, status: "active", peer_activity_sharing_enabled: true },
      { coach_id: coach.id, client_user_id: privatePeer.id, name: privatePeer.name, email: privatePeer.email, status: "active", peer_activity_sharing_enabled: false },
      { coach_id: coach.id, client_user_id: lapsedPeer.id, name: lapsedPeer.name, email: lapsedPeer.email, status: "active", peer_activity_sharing_enabled: true },
      { coach_id: coach.id, client_user_id: archivedPeer.id, name: archivedPeer.name, email: archivedPeer.email, status: "archived", peer_activity_sharing_enabled: true },
      { coach_id: otherCoach.id, client_user_id: outsidePeer.id, name: outsidePeer.name, email: outsidePeer.email, status: "active", peer_activity_sharing_enabled: true }
    ])
    .select("id, name");
  expect(clientsError, clientsError?.message).toBeNull();
  const clientId = (name: string) => clients!.find((client) => client.name === name)!.id;

  const { data: routines, error: routinesError } = await admin
    .from("workout_routines")
    .insert([
      { coach_id: coach.id, name: "Strength session" },
      { coach_id: coach.id, name: "Mobility session" }
    ])
    .select("id, name");
  expect(routinesError, routinesError?.message).toBeNull();
  const routineId = (name: string) => routines!.find((routine) => routine.name === name)!.id;

  const { data: activities, error: activitiesError } = await admin
    .from("activities")
    .insert([
      { coach_id: coach.id, name: "Morning jog" },
      { coach_id: coach.id, name: "Soccer match" }
    ])
    .select("id, name");
  expect(activitiesError, activitiesError?.message).toBeNull();
  const activityId = (name: string) => activities!.find((activity) => activity.name === name)!.id;

  const workoutLogs = [
    {
      coach_id: coach.id,
      client_id: clientId(viewer.name),
      routine_id: routineId("Strength session"),
      trained_on: dateFromMonday(0),
      duration_minutes: 40,
      notes: "Viewer private workout note"
    },
    {
      coach_id: coach.id,
      client_id: clientId(consistentPeer.name),
      routine_id: routineId("Strength session"),
      trained_on: dateFromMonday(-7),
      duration_minutes: 44,
      notes: "Secret strength note"
    },
    {
      coach_id: coach.id,
      client_id: clientId(consistentPeer.name),
      routine_id: routineId("Mobility session"),
      trained_on: dateFromMonday(-21),
      notes: "Secret mobility note"
    },
    {
      coach_id: coach.id,
      client_id: clientId(consistentPeer.name),
      routine_id: routineId("Strength session"),
      trained_on: dateFromMonday(14),
      notes: "Future session must stay hidden"
    },
    {
      coach_id: coach.id,
      client_id: clientId(lapsedPeer.name),
      routine_id: routineId("Mobility session"),
      trained_on: dateFromMonday(-14)
    },
    {
      coach_id: coach.id,
      client_id: clientId(lapsedPeer.name),
      routine_id: routineId("Mobility session"),
      trained_on: dateFromMonday(-21)
    },
    {
      coach_id: coach.id,
      client_id: clientId(privatePeer.name),
      routine_id: routineId("Strength session"),
      trained_on: dateFromMonday(0)
    },
    {
      coach_id: coach.id,
      client_id: clientId(archivedPeer.name),
      routine_id: routineId("Strength session"),
      trained_on: dateFromMonday(0)
    }
  ];
  const { error: workoutLogsError } = await admin.from("workout_logs").insert(workoutLogs);
  expect(workoutLogsError, workoutLogsError?.message).toBeNull();

  const { error: activityLogsError } = await admin.from("activity_logs").insert([
    {
      coach_id: coach.id,
      client_id: clientId(viewer.name),
      activity_id: activityId("Morning jog"),
      performed_on: dateFromMonday(0),
      distance_km: 5,
      notes: "Viewer private Activity note"
    },
    {
      coach_id: coach.id,
      client_id: clientId(consistentPeer.name),
      activity_id: activityId("Morning jog"),
      performed_on: dateFromMonday(-14),
      distance_km: 8.5,
      notes: "Secret jogging note"
    },
    {
      coach_id: coach.id,
      client_id: clientId(consistentPeer.name),
      activity_id: activityId("Soccer match"),
      performed_on: dateFromMonday(-28),
      duration_minutes: 90,
      notes: "Secret soccer note"
    }
  ]);
  expect(activityLogsError, activityLogsError?.message).toBeNull();

  const viewerAuth = authenticatedClient(viewer);
  const { error: viewerSignInError } = await viewerAuth.client.auth.signInWithPassword({
    email: viewer.email,
    password: viewer.password
  });
  expect(viewerSignInError, viewerSignInError?.message).toBeNull();

  const rawFeedClient = viewerAuth.client as unknown as SupabaseClient;
  const [{ data: feed, error: feedError }, peerWorkouts, peerActivities, rawFeedAttempt] = await Promise.all([
    viewerAuth.client.rpc("get_trainee_social_feed"),
    viewerAuth.client.from("workout_logs").select("notes, duration_minutes").eq("client_id", clientId(consistentPeer.name)),
    viewerAuth.client.from("activity_logs").select("notes, distance_km").eq("client_id", clientId(consistentPeer.name)),
    rawFeedClient.rpc("get_trainee_social_feed_internal")
  ]);
  expect(feedError, feedError?.message).toBeNull();
  expect(peerWorkouts.data).toEqual([]);
  expect(peerActivities.data).toEqual([]);
  expect(rawFeedAttempt.error).not.toBeNull();

  const ownFeed = feed!.find((entry) => entry.is_viewer)!;
  const consistentFeed = feed!.find((entry) => entry.client_id === clientId(consistentPeer.name))!;
  const privateFeed = feed!.find((entry) => entry.client_id === clientId(privatePeer.name))!;
  const lapsedFeed = feed!.find((entry) => entry.client_id === clientId(lapsedPeer.name))!;
  expect(ownFeed).toEqual(expect.objectContaining({ current_streak_weeks: 1, trained_this_week: true }));
  expect(consistentFeed).toEqual(expect.objectContaining({ current_streak_weeks: 4, trained_this_week: false, activity_visible: true }));
  expect(lapsedFeed).toEqual(expect.objectContaining({ current_streak_weeks: 0, trained_this_week: false }));
  expect(privateFeed).toEqual(expect.objectContaining({ activity_visible: false, current_streak_weeks: null, recent_trainings: [] }));
  expect(consistentFeed.recent_trainings).toHaveLength(3);
  expect(consistentFeed.recent_trainings).toEqual([
    { type: "Workout", name: "Strength session", trained_on: dateFromMonday(-7) },
    { type: "Activity", name: "Morning jog", trained_on: dateFromMonday(-14) },
    { type: "Workout", name: "Mobility session", trained_on: dateFromMonday(-21) }
  ]);
  expect(JSON.stringify(feed)).not.toContain("Secret");
  expect(JSON.stringify(feed)).not.toContain("duration_minutes");
  expect(feed!.find((entry) => entry.is_viewer)?.name).toBe(viewerFirstName);
  expect(consistentFeed.name).toBe(consistentFirstName);
  expect(JSON.stringify(feed)).not.toContain(consistentPeer.name);
  expect(feed!.map((entry) => entry.name)).not.toContain(archivedFirstName);
  expect(feed!.map((entry) => entry.name)).not.toContain(outsideFirstName);

  await logIn(page, viewer);
  await page.goto("/trainee/peers");
  await expect(page.getByText("Your consistency", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("1 week", { exact: true })).toBeVisible();
  const community = page.getByRole("region", { name: "Your training community" });
  const consistentCard = community.getByRole("article", { name: `${consistentFirstName}'s consistency` });
  await expect(consistentCard.getByText(consistentFirstName, { exact: true })).toBeVisible();
  await expect(page.getByText(consistentPeer.name, { exact: true })).not.toBeVisible();
  await expect(consistentCard.getByText("4 weeks", { exact: true })).toBeVisible();
  await expect(consistentCard.getByText("Can extend it this week")).toBeVisible();
  await expect(consistentCard.getByText("Strength session", { exact: true })).toBeVisible();
  await expect(consistentCard.getByText("Morning jog", { exact: true })).toBeVisible();
  await expect(consistentCard.getByText("Mobility session", { exact: true })).toBeVisible();
  await expect(page.getByText("Soccer match", { exact: true })).not.toBeVisible();
  await expect(page.getByText(`${privateFirstName} has chosen not to share streaks or recent training.`)).toBeVisible();
  await expect(page.getByText(archivedFirstName, { exact: true })).not.toBeVisible();
  await expect(page.getByText(outsideFirstName, { exact: true })).not.toBeVisible();

  await page.getByRole("button", { name: "Turn off sharing" }).click();
  const dialog = page.getByRole("dialog", { name: "Turn off peer activity sharing?" });
  await expect(dialog).toBeVisible();
  const confirmButton = dialog.getByRole("button", { name: "Turn off sharing" });
  await confirmButton.click();
  await expect(page.getByText("Peer sharing disabled")).toBeVisible();
  await expect(page.getByText("Turn on your sharing to see activity from peers who also share.").first()).toBeVisible();

  const { data: hiddenFeed, error: hiddenFeedError } = await viewerAuth.client.rpc("get_trainee_social_feed");
  expect(hiddenFeedError, hiddenFeedError?.message).toBeNull();
  expect(hiddenFeed!.find((entry) => entry.is_viewer)).toEqual(expect.objectContaining({ activity_visible: true, current_streak_weeks: 1 }));
  expect(hiddenFeed!.filter((entry) => !entry.is_viewer).every((entry) =>
    !entry.activity_visible
    && Array.isArray(entry.recent_trainings)
    && entry.recent_trainings.length === 0
  )).toBe(true);

  await page.getByRole("button", { name: "Turn on sharing" }).click();
  await expect(page.getByText("Peer sharing enabled")).toBeVisible();
  await expect(consistentCard.getByText("4 weeks", { exact: true })).toBeVisible();
  await expect(consistentCard.getByText("Strength session", { exact: true })).toBeVisible();

  const peerAuth = authenticatedClient(consistentPeer);
  const { error: peerSignInError } = await peerAuth.client.auth.signInWithPassword({
    email: consistentPeer.email,
    password: consistentPeer.password
  });
  expect(peerSignInError, peerSignInError?.message).toBeNull();
  const { data: restoredFeed, error: restoredFeedError } = await peerAuth.client.rpc("get_trainee_social_feed");
  expect(restoredFeedError, restoredFeedError?.message).toBeNull();
  const restoredViewer = restoredFeed!.find((entry) => entry.client_id === clientId(viewer.name));
  expect(restoredViewer).toEqual(expect.objectContaining({ activity_visible: true, current_streak_weeks: 1 }));
  expect(restoredViewer!.recent_trainings).toHaveLength(2);
});
