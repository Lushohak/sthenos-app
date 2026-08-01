import { test, expect, logIn } from "./support/fixtures";

test("@smoke unauthenticated visitors are redirected to login", async ({
  page
}) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/auth\/login$/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("@smoke coach and trainee accounts stay in their own portals", async ({
  admin,
  browser,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const trainee = await users.create("trainee");
  const { error } = await admin.from("clients").insert({
    coach_id: coach.id,
    client_user_id: trainee.id,
    name: trainee.name,
    email: trainee.email,
    status: "active"
  });

  expect(error, error?.message).toBeNull();

  await logIn(page, coach);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/trainee");
  await expect(page).toHaveURL(/\/dashboard$/);

  const traineeContext = await browser.newContext();
  const traineePage = await traineeContext.newPage();

  try {
    await logIn(traineePage, trainee);
    await expect(traineePage).toHaveURL(/\/trainee$/);
    await traineePage.goto("/dashboard");
    await expect(traineePage).toHaveURL(/\/trainee$/);
  } finally {
    await traineeContext.close();
  }
});

test("@smoke coaches cannot open another coach's client record", async ({
  admin,
  page,
  users
}) => {
  const owner = await users.create("coach");
  const otherCoach = await users.create("coach");
  const { data: client, error } = await admin
    .from("clients")
    .insert({
      coach_id: owner.id,
      name: "Private E2E client",
      status: "active"
    })
    .select("id")
    .single();

  expect(error, error?.message).toBeNull();
  expect(client).not.toBeNull();

  await logIn(page, otherCoach);
  const response = await page.goto(`/dashboard/clients/${client!.id}`);

  expect(response?.status()).toBe(404);
  await expect(page.getByText("Private E2E client")).not.toBeVisible();
});
