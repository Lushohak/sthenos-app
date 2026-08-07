import { createClient } from "@supabase/supabase-js";
import { test, expect, logIn, uniqueValue } from "./support/fixtures";

test("@smoke a trainee records body progress that is shared with their coach", async ({
  admin,
  browser,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const outsider = await users.create("trainee");
  const clientName = `Progress ${uniqueValue("client")}`;
  const today = new Date().toISOString().slice(0, 10);
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

  await logIn(page, trainee);
  await page.goto("/trainee/progress");
  await page.getByLabel("Body weight (kg)").fill("78.4");
  await page.getByLabel("Body fat (%)").fill("18.2");
  await page.getByLabel("Muscle mass (%)").fill("42.5");
  await page.getByLabel("Waist (cm)").fill("82.3");
  await page.getByLabel("Chest (cm)").fill("101.1");
  await page.getByLabel("Arms (cm)").fill("36.2");
  await page.getByLabel("Legs (cm)").fill("58.7");
  await page.getByLabel("Notes").fill("Morning measurement before breakfast.");
  await page.getByRole("button", { name: "Add progress entry" }).click();

  await expect(page.getByText("Progress added")).toBeVisible();
  await expect(page.getByRole("cell", { name: "78.4 kg" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "42.5%" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "You" })).toBeVisible();

  const { data: entry, error: entryError } = await admin
    .from("body_progress_entries")
    .select("*")
    .eq("client_id", client!.id)
    .single();
  expect(entryError, entryError?.message).toBeNull();
  expect(entry).toEqual(expect.objectContaining({
    coach_id: coach.id,
    client_id: client!.id,
    recorded_by: trainee.id,
    recorded_on: today,
    body_weight: 78.4,
    body_fat_percentage: 18.2,
    muscle_mass_percentage: 42.5,
    waist: 82.3,
    chest: 101.1,
    arms: 36.2,
    legs: 58.7,
    notes: "Morning measurement before breakfast."
  }));

  const coachContext = await browser.newContext();
  const coachPage = await coachContext.newPage();
  try {
    await logIn(coachPage, coach);
    await coachPage.goto(`/dashboard/clients/${client!.id}`);
    await expect(coachPage.getByRole("cell", { name: "78.4 kg" })).toBeVisible();
    await expect(coachPage.getByRole("cell", { name: "42.5%" })).toBeVisible();
    await expect(coachPage.getByRole("cell", { name: "Trainee" })).toBeVisible();
  } finally {
    await coachContext.close();
  }

  const unauthorizedTrainee = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: signInError } = await unauthorizedTrainee.auth.signInWithPassword({
    email: outsider.email,
    password: outsider.password
  });
  expect(signInError, signInError?.message).toBeNull();

  const [{ data: hiddenEntries }, { error: unauthorizedInsertError }] = await Promise.all([
    unauthorizedTrainee.from("body_progress_entries").select("id").eq("client_id", client!.id),
    unauthorizedTrainee.from("body_progress_entries").insert({
      coach_id: coach.id,
      client_id: client!.id,
      recorded_by: outsider.id,
      recorded_on: today,
      body_weight: 70
    })
  ]);
  expect(hiddenEntries).toEqual([]);
  expect(unauthorizedInsertError).not.toBeNull();
});
