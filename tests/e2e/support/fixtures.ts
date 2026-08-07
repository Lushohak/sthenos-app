import { test as base, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AccountRole = "coach" | "trainee";

export type TestUser = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: AccountRole;
};

type UserFactory = {
  create(role: AccountRole, name?: string): Promise<TestUser>;
  track(userId: string, role: AccountRole): void;
  untrack(userId: string): void;
};

type TestFixtures = {
  admin: SupabaseClient;
  users: UserFactory;
};

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in the Playwright environment.`);
  return value;
}

function createAdminClient() {
  const url = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const hostname = new URL(url).hostname;

  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error("E2E fixtures can only modify a local Supabase instance.");
  }

  return createClient(url, requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function uniqueValue(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function logIn(page: Page, user: TestUser) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => url.pathname !== "/auth/login");
}

export const test = base.extend<TestFixtures>({
  admin: async ({}, use) => {
    await use(createAdminClient());
  },
  users: async ({ admin }, use) => {
    const createdUsers: Array<{ id: string; role: AccountRole }> = [];

    await use({
      track(userId, role) {
        if (!createdUsers.some((user) => user.id === userId)) {
          createdUsers.push({ id: userId, role });
        }
      },
      untrack(userId) {
        const index = createdUsers.findIndex((user) => user.id === userId);
        if (index >= 0) createdUsers.splice(index, 1);
      },
      async create(role, requestedName) {
        const marker = uniqueValue(role);
        const name = requestedName ?? `E2E ${role} ${marker}`;
        const email = `${marker}@example.test`;
        const password = "Test-password-42";
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: name,
            role
          }
        });

        if (error || !data.user) {
          throw new Error(`Unable to create ${role} user: ${error?.message}`);
        }

        createdUsers.push({ id: data.user.id, role });
        return {
          id: data.user.id,
          email,
          password,
          name,
          role
        };
      }
    });

    for (const user of createdUsers.reverse()) {
      if (user.role === "coach") {
        const ownedTables = [
          "body_progress_entries",
          "activity_logs",
          "workout_logs",
          "client_activities",
          "client_routines",
          "clients",
          "activities",
          "workout_routines",
          "exercises"
        ];

        for (const table of ownedTables) {
          const { error } = await admin
            .from(table)
            .delete()
            .eq("coach_id", user.id);
          if (error) {
            console.warn(
              `Unable to clean up E2E ${table} for ${user.id}: ${error.message}`
            );
          }
        }
      }

      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) {
        console.warn(
          `Unable to clean up E2E user ${user.id}: ${error.message || JSON.stringify(error)}`
        );
      }
    }
  }
});

export { expect };
