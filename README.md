# Sthenos

Sthenos is a workout-management application for fitness coaches and their
trainees. Coaches can maintain an exercise library, build reusable routines,
assign them to one or many trainees, and record training and body-progress
data. Trainees have a separate portal where they can preview assigned routines,
complete guided workouts, and review their progress.

For a detailed inventory of the functionality currently implemented, known
product boundaries, and possible next development areas, see
[docs/FEATURES.md](docs/FEATURES.md). Test architecture and contribution
guidance are documented in [docs/TESTING.md](docs/TESTING.md).

## Tech stack

- [Next.js](https://nextjs.org/) 15 with the App Router and Server Actions
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) for PostgreSQL, authentication, storage,
  and row-level security
- [Playwright](https://playwright.dev/) for browser-based end-to-end tests
- [Lucide React](https://lucide.dev/) for icons

## Local development

### Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project, or Docker and the Supabase CLI for a fully local backend

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure the environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Set the following values in `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and is used by the trainee invitation
flow. Never expose it in client code or commit `.env.local`.

### 3. Prepare Supabase

Choose either a hosted Supabase project or the local Supabase stack.

#### Hosted Supabase

Link the repository to your project and apply the committed migrations:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Copy the project URL, publishable key, and service-role key from the Supabase
dashboard into `.env.local`.

#### Local Supabase

Start the local services and apply the migrations:

```bash
npx supabase start
npx supabase db reset
```

Run `npx supabase status` and copy its API URL, publishable/anon key, and
service-role key into `.env.local`. Local authentication emails can be viewed
in the email-testing interface reported by the Supabase CLI; this repository's
default port is `http://127.0.0.1:54324`.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create a coach account at
`/auth/sign-up`, then use the coach dashboard to create trainees, exercises,
and routines.

## End-to-end tests

The Playwright suite runs against the local Supabase stack and starts its own
Next.js server on `http://127.0.0.1:3100`. Docker Desktop must be running.

```bash
npm run supabase:start
npm run test:e2e
```

The test environment reads the generated local Supabase credentials directly
from the CLI. It refuses to run database fixtures against a non-local Supabase
URL. Invitation tests use local Mailpit rather than Resend or another production
SMTP provider.

Useful test variants:

```bash
npm run test:e2e:smoke   # Run the critical-path suite
npm run test:e2e:headed  # Watch the browser while tests run
npm run test:e2e:ui      # Open Playwright's interactive test runner
npm run supabase:stop    # Stop the local backend when finished
```

See [docs/TESTING.md](docs/TESTING.md) for covered scenarios and fixture rules.

## Useful commands

```bash
npm run dev        # Start the development server
npm run typecheck  # Run the TypeScript compiler without emitting files
npm run build      # Create a production build
npm run start      # Run the production build
```

## Production authentication setup

Production trainee invitations require the following Supabase Auth settings:

- Set the Auth Site URL to the production application URL.
- Add `<production-url>/auth/callback` to the allowed Redirect URLs.
- Set `NEXT_PUBLIC_SITE_URL` to the same origin, without a trailing slash.
- Configure custom SMTP before inviting real trainees. Supabase's default email
  service is restricted and rate-limited.
- Review the **Invite user** and **Reset password** email templates. The first
  trainee email uses the invite template; resending setup for an existing Auth
  user uses the recovery template.

Example:

```text
NEXT_PUBLIC_SITE_URL=https://sthenos-app.vercel.app
```
