import { test, expect, logIn, uniqueValue } from "./support/fixtures";
import {
  clearMailpit,
  getSupabaseActionLink,
  waitForEmail
} from "./support/mailpit";

test("a new client is invited automatically unless the coach opts out", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const traineeName = `Automatic ${uniqueValue("trainee")}`;
  const traineeEmail = `${uniqueValue("automatic-invite")}@example.test`;
  await clearMailpit();

  await logIn(page, coach);
  await page.goto("/dashboard/clients/new");
  await page.getByLabel("Name").fill(traineeName);
  await page.getByLabel("Email").fill(traineeEmail);
  await expect(page.getByRole("checkbox", { name: /Send account invitation after creation/ })).toBeChecked();
  await page.getByRole("button", { name: "Create client" }).click();

  await expect(page).toHaveURL(/\/dashboard\/clients\/.+tab=account.+invite=sent/);
  await expect(page.getByText("Invite email sent.")).toBeVisible();
  const { data: client, error } = await admin
    .from("clients")
    .select("client_user_id, invited_at")
    .eq("coach_id", coach.id)
    .eq("email", traineeEmail)
    .single();
  expect(error, error?.message).toBeNull();
  expect(client?.client_user_id).toBeTruthy();
  expect(client?.invited_at).toBeTruthy();
  users.track(client!.client_user_id!, "trainee");

  const email = await waitForEmail(traineeEmail);
  expect(email.Subject).toBe("Your invitation to join Sthenos");

  const deferredName = `Deferred ${uniqueValue("trainee")}`;
  const deferredEmail = `${uniqueValue("deferred-invite")}@example.test`;
  await page.goto("/dashboard/clients/new");
  await page.getByLabel("Name").fill(deferredName);
  await page.getByLabel("Email").fill(deferredEmail);
  await page.getByRole("checkbox", { name: "Send account invitation after creation" }).uncheck();
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page).toHaveURL(/\/dashboard\/clients$/);
  const { data: deferredClient, error: deferredError } = await admin
    .from("clients")
    .select("client_user_id, invited_at")
    .eq("coach_id", coach.id)
    .eq("email", deferredEmail)
    .single();
  expect(deferredError, deferredError?.message).toBeNull();
  expect(deferredClient).toEqual({ client_user_id: null, invited_at: null });
});

test("@smoke coach invite lets a trainee finish account setup", async ({
  admin,
  browser,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const traineeName = `Invited ${uniqueValue("trainee")}`;
  const traineeEmail = `${uniqueValue("invite")}@example.test`;
  const password = "Invited-password-42";
  const { data: client, error } = await admin
    .from("clients")
    .insert({
      coach_id: coach.id,
      name: traineeName,
      email: traineeEmail,
      status: "active"
    })
    .select("id")
    .single();

  expect(error, error?.message).toBeNull();
  expect(client).not.toBeNull();
  await clearMailpit();

  await logIn(page, coach);
  await page.goto(`/dashboard/clients/${client!.id}?tab=account`);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page).toHaveURL(/invite=sent/);
  await expect(page).toHaveURL(/tab=account/);
  await expect(page.getByText("Invite email sent.")).toBeVisible();

  const { data: invitedClient, error: invitedClientError } = await admin
    .from("clients")
    .select("client_user_id")
    .eq("id", client!.id)
    .single();

  expect(invitedClientError, invitedClientError?.message).toBeNull();
  expect(invitedClient?.client_user_id).toBeTruthy();
  users.track(invitedClient!.client_user_id!, "trainee");

  const email = await waitForEmail(traineeEmail);
  expect(email.Subject).toBe("Your invitation to join Sthenos");
  expect(email.HTML).toContain("Welcome to Sthenos");
  expect(email.HTML).toContain("Complete account setup");
  expect(getSupabaseActionLink(email)).toContain("type=invite");

  await clearMailpit();
  await page.getByRole("button", { name: "Send setup email again" }).click();
  await expect(page).toHaveURL(/invite=resent/);
  await expect(
    page.getByText("A new password setup email was sent.")
  ).toBeVisible();

  const recoveryEmail = await waitForEmail(traineeEmail);
  expect(recoveryEmail.Subject).toBe("Set up or reset your Sthenos password");
  expect(recoveryEmail.HTML).toContain("Set your Sthenos password");
  expect(recoveryEmail.HTML).toContain("Set up my password");
  const actionLink = getSupabaseActionLink(recoveryEmail);
  const traineeContext = await browser.newContext();
  const traineePage = await traineeContext.newPage();

  try {
    await traineePage.goto(actionLink);
    await expect(traineePage).toHaveURL(/\/trainee\/setup/);
    await expect(
      traineePage.getByRole("heading", { name: "Finish your account" })
    ).toBeVisible();
    await traineePage.getByLabel("Password").fill(password);
    await traineePage.getByRole("button", { name: "Complete setup" }).click();
    await expect(traineePage).toHaveURL(/\/trainee$/);
    await expect(
      traineePage.getByRole("heading", { name: `Welcome, ${traineeName}` })
    ).toBeVisible();
  } finally {
    await traineeContext.close();
  }

  const { data: updatedClient, error: lookupError } = await admin
    .from("clients")
    .select("client_user_id, invitation_accepted_at")
    .eq("id", client!.id)
    .single();

  expect(lookupError, lookupError?.message).toBeNull();
  expect(updatedClient?.client_user_id).toBeTruthy();
  expect(updatedClient?.invitation_accepted_at).toBeTruthy();
});
