import { test, expect, logIn, uniqueValue } from "./support/fixtures";

function ageFor(dateOfBirth: string) {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month
    || (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1;
  }
  return age;
}

test("@smoke a coach creates and edits client demographics with age derived from birthday", async ({
  admin,
  page,
  users
}) => {
  const coach = await users.create("coach");
  const clientName = `Demographics ${uniqueValue("client")}`;
  const initialBirthday = "1995-04-10";
  const updatedBirthday = "1992-08-07";

  await logIn(page, coach);
  await page.goto("/dashboard/clients/new");
  await page.getByLabel("Name").fill(clientName);
  await page.getByLabel("Gender").selectOption("male");
  await page.getByLabel("Date of birth").fill(initialBirthday);
  await page.getByLabel("Height (cm)").fill("178.5");
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page).toHaveURL(/\/dashboard\/clients$/);

  const { data: client, error: createLookupError } = await admin
    .from("clients")
    .select("id, gender, date_of_birth, height_cm, age")
    .eq("coach_id", coach.id)
    .eq("name", clientName)
    .single();
  expect(createLookupError, createLookupError?.message).toBeNull();
  expect(client).toEqual(expect.objectContaining({
    gender: "male",
    date_of_birth: initialBirthday,
    height_cm: 178.5,
    age: null
  }));

  await page.goto(`/dashboard/clients/${client!.id}?tab=account`);
  const profile = page.getByRole("heading", { name: "Profile details" }).locator("../..");
  await expect(profile.getByText("Male", { exact: true })).toBeVisible();
  await expect(profile.getByText("Apr 10, 1995", { exact: true })).toBeVisible();
  await expect(profile.getByText("178.5 cm", { exact: true })).toBeVisible();
  await expect(profile.getByText(String(ageFor(initialBirthday)), { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Edit client" }).first().click();
  await page.getByLabel("Gender").selectOption("prefer_not_to_say");
  await page.getByLabel("Date of birth").fill(updatedBirthday);
  await page.getByLabel("Height (cm)").fill("165.4");
  await page.getByRole("button", { name: "Save client" }).click();
  await expect(page).toHaveURL(`/dashboard/clients/${client!.id}?tab=account`);

  await expect(profile.getByText("Prefer not to say", { exact: true })).toBeVisible();
  await expect(profile.getByText("Aug 7, 1992", { exact: true })).toBeVisible();
  await expect(profile.getByText("165.4 cm", { exact: true })).toBeVisible();
  await expect(profile.getByText(String(ageFor(updatedBirthday)), { exact: true })).toBeVisible();

  const { data: updatedClient, error: updateLookupError } = await admin
    .from("clients")
    .select("gender, date_of_birth, height_cm")
    .eq("id", client!.id)
    .single();
  expect(updateLookupError, updateLookupError?.message).toBeNull();
  expect(updatedClient).toEqual({
    gender: "prefer_not_to_say",
    date_of_birth: updatedBirthday,
    height_cm: 165.4
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [{ error: futureBirthdayError }, { error: invalidHeightError }] = await Promise.all([
    admin.from("clients").insert({
      coach_id: coach.id,
      name: `Future birthday ${uniqueValue("client")}`,
      date_of_birth: tomorrow.toISOString().slice(0, 10)
    }),
    admin.from("clients").insert({
      coach_id: coach.id,
      name: `Invalid height ${uniqueValue("client")}`,
      height_cm: 301
    })
  ]);
  expect(futureBirthdayError).not.toBeNull();
  expect(invalidHeightError).not.toBeNull();
});
