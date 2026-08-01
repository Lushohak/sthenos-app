import { test, expect, logIn, uniqueValue } from "./support/fixtures";
import {
  clearMailpit,
  getSupabaseActionLink,
  waitForEmail
} from "./support/mailpit";

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
  await page.goto(`/dashboard/clients/${client!.id}`);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page).toHaveURL(/invite=sent/);
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
  const actionLink = getSupabaseActionLink(email);
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
