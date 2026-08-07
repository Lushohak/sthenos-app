# Testing Sthenos

The initial automated suite uses Playwright and an isolated local Supabase
stack. It exercises the application through the browser so each test covers the
Next.js UI, Server Actions, Supabase Auth, PostgreSQL, and row-level security
together.

## Prerequisites

- Node.js 20 or newer
- Docker Desktop running
- Project dependencies installed with `npm ci`
- Playwright Chromium installed with `npx playwright install chromium`

The Supabase CLI is pinned as a development dependency and should be invoked
through the npm scripts or `npx supabase`.

## Running the suite

Start the local backend once:

```bash
npm run supabase:start
```

Run all current tests:

```bash
npm run test:e2e
```

Other modes:

```bash
npm run test:e2e:smoke
npm run test:e2e:headed
npm run test:e2e:ui
```

Stop the local backend when it is no longer needed:

```bash
npm run supabase:stop
```

Playwright starts and stops a dedicated Next.js development server on port
`3100`. It does not reuse a server on port `3000`, so normal local development
can continue independently.

## Safety and isolation

`playwright.config.ts` reads credentials from `supabase status -o env`. The
environment loader rejects any Supabase URL whose hostname is not `localhost`
or `127.0.0.1`.

Fixtures create uniquely named Auth users and product records for each test.
Teardown removes coach-owned data in dependency order and then removes the test
Auth identities. Tests must never use hosted Supabase credentials or production
email delivery.

Invitation messages are delivered to Mailpit at
`http://127.0.0.1:54324`. The invitation test retrieves the local message,
opens its real Supabase action link, and completes the trainee setup flow.

## Current smoke coverage

### Authentication and authorization

- Unauthenticated dashboard access redirects to login.
- Coach and trainee accounts are kept in their role-specific portals.
- A coach receives a 404 when requesting another coach's client record.

### Golden product workflow

- Coach login.
- Trainee profile creation and Auth identity linking.
- Exercise and two-cycle routine creation.
- Exercise search and routine composition.
- Bulk routine assignment with confirmation feedback.
- Trainee login, preview, guided workout, rest timer, and completion.
- Completed workout verification in the coach's client history.

### First-class Activities

- Coach creates an Activity with mixed required and optional metrics, default
  targets, and dedicated thumbnail storage.
- Coach edits defaults and creates a one-time prescription with a planned date
  and target overrides.
- Trainee sees the immutable prescription, logs actual metrics and notes, and
  receives completion feedback.
- The log and one-time assignment completion commit atomically.
- Concurrent one-time submissions create exactly one Activity log.
- Repeatable Activities accept multiple valid logs while rejecting out-of-range
  metrics and invalid targets.
- Another coach cannot read or log against Activity data they do not own.
- Coach bulk-assigns an Activity, pauses it, archives/restores its template, and
  resumes it only after restoration.
- Deleting a client cascades through Activity assignments and logs.

### Invitation and setup

- Coach sends an invitation from a client profile.
- Supabase delivers the message to local Mailpit.
- The trainee opens the invitation and reaches the expected callback.
- The trainee sets a password and enters the trainee portal.
- The client record stores the linked Auth user and acceptance timestamp.

## Test organization

```text
tests/e2e/
├── activities.spec.ts
├── archiving.spec.ts
├── auth.spec.ts
├── client-deletion.spec.ts
├── golden-workflow.spec.ts
├── gym-routine.spec.ts
├── invitations.spec.ts
├── multi-routine-assignment.spec.ts
├── workout-shortcuts.spec.ts
└── support/
    ├── fixtures.ts
    ├── local-supabase.ts
    └── mailpit.ts
```

- `fixtures.ts` owns local Admin access, user creation, login, unique data, and
  cleanup.
- `local-supabase.ts` loads local credentials and enforces the localhost guard.
- `mailpit.ts` clears and reads the local email inbox and extracts Supabase Auth
  action links.

## Writing additional tests

- Prefer accessible selectors such as roles, labels, and button names.
- Use direct database setup only for prerequisites that are not the behavior
  under test.
- Use the UI when the creation or update workflow itself is being tested.
- Generate unique names and emails with `uniqueValue`.
- Register any Auth user created outside the standard factory with
  `users.track` so teardown removes it.
- Keep rest timers and other time-based fixtures short.
- Assert user-visible outcomes and persisted product behavior rather than CSS
  classes or component implementation details.
- Tag critical-path tests with `@smoke`.
