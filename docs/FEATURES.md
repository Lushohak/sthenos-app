# Sthenos feature inventory

Last reviewed: July 31, 2026

This document describes functionality that is present in the application
today. Checked items are implemented. Unchecked items under **Development
opportunities** are ideas rather than commitments.

## Product roles

Sthenos currently has two account roles:

- **Coach:** owns and manages trainees, exercises, routines, assignments,
  workout logs, and body-progress data.
- **Trainee:** accesses routines assigned by their coach, performs workouts,
  and reviews their own activity and progress.

Supabase authentication and row-level security keep coach-owned data separated
and limit trainees to the data exposed by their linked profile and assignments.

## Coach functionality

### Dashboard

- [x] View total client count.
- [x] View how many clients trained during the last seven days.
- [x] Review the five most recent body-progress updates.
- [x] Navigate to client, exercise, routine, and progress management.

### Trainees and client profiles

- [x] List all client profiles with name, email, goal, status, and creation date.
- [x] Create and edit client profiles.
- [x] Store email, age, goal, notes, and an active, paused, or archived status.
- [x] View a client's assigned routines, recent workouts, and body-progress
  history.
- [x] Manually record a completed workout for a client.
- [x] Record weight, body-fat percentage, waist, chest, arm, and leg
  measurements.
- [x] Invite a trainee by email to create their portal password.
- [x] Resend password setup for a pending trainee account.
- [x] Show friendly feedback for common Supabase invitation errors, including
  invalid or duplicate email addresses, disabled email authentication, missing
  SMTP authorization, and rate limits.
- [x] Show loading states on request-based form actions to discourage duplicate
  submissions.

Current boundary: client profiles can be archived through their status, but
there is no permanent client deletion flow.

### Exercise library

- [x] Create, view, search, and edit coach-owned exercises.
- [x] Store category, difficulty, equipment, movement pattern, and multiple
  primary muscles.
- [x] Upload a thumbnail image to Supabase Storage.
- [x] Store an external exercise demonstration video URL.
- [x] Archive an exercise through a confirmation modal.
- [x] List the routines affected before an exercise is archived.
- [x] Keep archived exercises in existing routines while hiding them from the
  active library and preventing them from being added to new routines.

Current boundaries:

- Thumbnail uploads are limited to 1 MB in the application.
- Exercises cannot currently be restored after archival or permanently deleted.
- Existing thumbnail files are not removed when a replacement is uploaded.

### Routine creation and assignment

- [x] Create reusable routine templates with a name and description.
- [x] Choose a circuit or exercise-specific routine structure.
- [x] Set a default number of cycles.
- [x] Search the exercise library while composing a routine.
- [x] Add exercises with reps, rest time, and coach notes.
- [x] Create a missing exercise from the routine workflow and return directly to
  the routine with the new exercise selected.
- [x] Reorder routine exercises through drag and drop or move controls.
- [x] Remove an exercise from a routine.
- [x] Assign a routine to one trainee from their client profile.
- [x] Assign a routine to several active trainees at once.
- [x] Search and select trainees during bulk assignment.
- [x] Apply one optional assignment note to every selected trainee.
- [x] Prevent duplicate open assignments for the same trainee and routine.
- [x] Show success toasts after individual and bulk assignment requests.

Current boundaries:

- A routine's name, description, structure, and cycle count cannot yet be
  edited after creation.
- Routines cannot yet be duplicated, archived, or deleted.
- Existing assignments can be displayed as active, paused, or completed, but
  there is no coach UI for changing their status.
- Assignments do not currently include scheduling, due dates, or recurrence.

### Coach progress reporting

- [x] Review body measurements across all trainees in one table.
- [x] Open the related client profile from a progress entry.
- [x] Review recent progress and training history within each client profile.

Current boundary: progress is displayed as summary cards and tables; there are
no charts, comparisons, exports, or generated reports yet.

## Trainee functionality

### Account and navigation

- [x] Accept a coach invitation and set an account password.
- [x] Log in and be routed to a role-specific portal.
- [x] Navigate between Home, Progress, and Peers on desktop and mobile.
- [x] Log out with a request-in-progress state.

Production invitations depend on correctly configured Supabase redirect URLs
and a custom SMTP provider.

### Routine preview

- [x] View assigned routines with active assignments prioritized.
- [x] See the routine description, coach note, exercise count, and cycle count.
- [x] Expand a workout preview without leaving the trainee dashboard.
- [x] Review exercise order, thumbnails, reps, rest time, equipment, notes, and
  external demonstration links.
- [x] Begin a guided workout for an active, non-empty assignment.

### Guided workout

- [x] Move through exercises one at a time with previous/next controls.
- [x] Swipe horizontally between workout steps on touch devices.
- [x] Track exercise and round progress.
- [x] View exercise details, coach instructions, and demonstration links.
- [x] Open exercise thumbnails in a full-image modal without leaving the workout.
- [x] Run an automatic rest countdown and optionally skip it.
- [x] Play a dependency-free synthesized three-ring bell when rest finishes.
- [x] Toggle the rest sound and retain that preference on the device.
- [x] Save the current exercise, round, and rest timer locally when leaving, then
  resume later on the same device.
- [x] Review a workout summary, choose the training date, and add an optional
  note.
- [x] Save a completed workout so it becomes visible to both trainee and coach.

Current boundaries:

- In-progress workout state is device-local and does not synchronize across
  browsers or devices.
- Completion records the routine, date, and note, but not per-exercise weights,
  repetitions completed, difficulty, pain, or elapsed time.
- The rest bell requires browser audio permission established through user
  interaction; the visual timer remains the fallback.

### Personal progress

- [x] View total completed workouts and workouts from the last 30 days.
- [x] View latest weight and weight change from the first recorded entry.
- [x] Review workout history and body measurements in responsive layouts.

Current boundary: body-progress entries are created by the coach; trainees
cannot submit their own measurements or progress photos.

### Peers

- [x] View the names of other active trainees linked to the same coach.
- [x] Keep measurements, progress, contact details, and coach notes private.

## Shared experience and platform behavior

- [x] Responsive coach and trainee layouts.
- [x] Reusable buttons, loading indicators, modals, tables, toasts, and form
  fields.
- [x] Server-side route protection and role-aware redirects.
- [x] Supabase row-level security for coach ownership and trainee access.
- [x] Database migrations committed under `supabase/migrations`.
- [x] Exercise media stored in a coach-scoped Supabase Storage path.
- [x] Local Playwright smoke tests for authentication, role and coach ownership
  protection, invitations, assignment, guided workouts, and completion history.

## Development opportunities

These are the clearest gaps revealed by the current workflows.

### Product reliability

- [ ] Add repeatable local demo seed data.
- [ ] Configure a non-interactive ESLint check for local development and CI.
- [ ] Add automated unit and integration tests for Server Actions.
- [ ] Expand end-to-end coverage to progress entry, bulk assignment, exercise
  archival, mobile viewports, and WebKit.
- [ ] Add production error monitoring and product analytics.

### Routine workflow

- [ ] Edit, duplicate, archive, and delete routine templates.
- [ ] Pause, resume, complete, replace, or remove a trainee assignment.
- [ ] Add scheduling, recurrence, and a trainee workout calendar.
- [ ] Preserve an assignment snapshot so later template edits do not
  unexpectedly change an active trainee plan.

### Progress and reporting

- [ ] Add measurement and workout-frequency charts.
- [ ] Add a detailed completed-workout view for coaches and trainees.
- [ ] Capture per-exercise results, loads, effort, pain, and personal records.
- [ ] Let trainees submit measurements or check-ins for coach review.
- [ ] Add date filters and CSV/PDF exports for progress reports.

### Communication and engagement

- [ ] Add an in-app notification center for new assignments and coach updates.
- [ ] Add email notifications once production SMTP is configured.
- [ ] Add coach comments or feedback on completed workouts.

## Keeping this document current

When a product change is merged:

1. Add or update the relevant checked item.
2. Record any important limitation under **Current boundaries**.
3. Remove completed work from **Development opportunities** instead of leaving
   duplicate checked and unchecked entries.
4. Update the review date at the top of the file.
