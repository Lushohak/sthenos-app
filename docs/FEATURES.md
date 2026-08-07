# Sthenos feature inventory

Last reviewed: August 6, 2026

This document describes functionality currently present in Sthenos. A
**Routine** is an exercise-based workout. An **Activity** is a separately
assigned, measurable event such as Walking, Hiking, Jogging, or a Soccer Match.

## Product roles

- **Coach:** owns and manages trainees, exercises, Routines, Activities,
  assignments, training logs, and body-progress data.
- **Trainee:** performs assigned Routines, logs assigned Activities and body
  measurements, and reviews their own progress and combined training history.

Supabase authentication and row-level security isolate coach-owned data and
limit trainees to their linked profile, assignments, and logs.

## Coach functionality

### Dashboard and trainees

- [x] View total clients and clients who completed a Workout or Activity during
  the last seven days.
- [x] Create, edit, archive, restore, and permanently delete trainee accounts.
- [x] Invite trainees by email and resend password setup links.
- [x] Show friendly invitation errors and request loading states.
- [x] Record body measurements and completed exercise-based workouts on behalf
  of a trainee, with measurement history showing who submitted each entry.
- [x] Review each trainee's assignments, combined training history, Activity
  insights, and body-progress history.

### Exercise library

- [x] Create, view, search, edit, and archive coach-owned exercises.
- [x] Store category, difficulty, equipment, movement pattern, primary muscles,
  thumbnail images, and external demonstration video URLs.
- [x] Show affected Routines before archival and retain archived exercises in
  existing Routines.

Current boundary: exercise thumbnails are limited to 1 MB and archived
exercises cannot currently be restored from the coach UI.

### Routines

- [x] Create circuit, individual, and Gym workout templates.
- [x] Configure cycles for circuit/individual Routines and sets plus reps for
  Gym Routines.
- [x] Search, add, reorder, and remove exercises while composing a Routine.
- [x] Create a missing exercise without losing the Routine workflow.
- [x] Assign multiple Routines to one trainee and bulk-assign one Routine to
  several trainees.
- [x] Pause and resume multiple Routine assignments from a trainee profile.
- [x] Archive and restore Routine templates while preserving existing
  assignments.
- [x] Download exercise-based Routines as compact PDFs with uncropped images.

Current boundaries: assignments have no recurrence schedule or due date, and
Routine prescriptions do not yet snapshot the entire template.

### Activities

- [x] Create, view, edit, archive, and restore Activity templates in a dedicated
  Activities area.
- [x] Upload a thumbnail to dedicated Activity media storage.
- [x] Enable duration, distance, elevation gain, estimated calories, and
  perceived intensity metrics.
- [x] Mark each enabled metric required or optional and configure default
  targets. Activities may also use completion-only logging.
- [x] Assign one Activity from a trainee profile with repeatable or one-time
  mode, an optional one-time planned date, coach notes, and target overrides.
- [x] Bulk-assign an Activity to several trainees using one shared prescription.
- [x] Snapshot metrics, requiredness, and targets on every assignment so later
  template edits affect only future assignments.
- [x] Pause and resume multiple Activity assignments. Archived Activities cannot
  be newly assigned or resumed until restored.
- [x] Keep active assignments usable after their template is archived.
- [x] Allow coaches and trainees to log actual Activity results through one
  atomic, validated database operation.
- [x] Keep repeatable Activities available after logging and complete one-time
  assignments in the same transaction as their first log.
- [x] Prevent concurrent one-time submissions from creating duplicate logs.

Current boundaries: units are metric-only; values are manually entered; there
is no GPS, wearable integration, automatic calorie calculation, recurrence
schedule, or Activity PDF download.

### Progress reporting

- [x] Present Workouts and Activities together in chronological training
  history while storing them separately.
- [x] Include both record types in completed-session and last-30-days counts.
- [x] Show 30-day Activity completion, duration, distance, elevation, calorie,
  and average-intensity summaries only when relevant data exists.
- [x] Show actual-versus-target values in Activity history.
- [x] Include a per-trainee Activity summary in coach progress reporting.

Current boundary: progress is table- and summary-based; charts, date filters,
exports, and generated reports are not yet available.

## Trainee functionality

### Account and navigation

- [x] Accept a coach invitation, set a password, log in, and enter a
  role-specific portal.
- [x] Navigate between Home, Progress, and Peers on desktop and mobile.

### Peers and consistency

- [x] View only the first names of active trainees working with the same coach,
  ordered alphabetically without rankings.
- [x] See a weekly consistency streak and the last three shared Workout or
  Activity names, types, and dates for each sharing peer.
- [x] Count existing training history toward forgiving Monday–Sunday streaks,
  with the current week remaining open until Sunday.
- [x] Turn activity sharing off or on with reciprocal visibility. Names remain
  visible while training details are private.
- [x] Keep measurements, results, duration, notes, contact information, and
  coach notes out of the peer feed.

Current boundary: Peers does not include rankings, points, reactions, comments,
challenges, direct messaging, or notifications.

### Activities

- [x] See Activities separately from exercise-based Routines.
- [x] Review planned date, assignment mode, coach notes, required/optional
  fields, and targets.
- [x] Open a logging form generated from the immutable assignment snapshot.
- [x] Log date, notes, and any configured actual metrics with validation and
  double-submit protection.
- [x] Continue logging repeatable Activities and remove completed one-time
  Activities from the active list.

### Routine preview and workout player

- [x] Preview an assigned Routine without leaving the trainee dashboard.
- [x] Download a Routine PDF for offline reading.
- [x] Move or swipe through exercises, rounds, and rest periods.
- [x] View full-size exercise images and external demonstrations.
- [x] Play a synthesized three-ring rest bell and remember the sound preference.
- [x] Resume device-local workout progress.
- [x] Complete a workout from the player or use the always-available completion
  shortcut.

Current boundary: in-progress state remains device-local and workout logs do
not yet capture per-exercise loads, completed reps, difficulty, pain, or
personal records.

### Personal progress

- [x] Review unified Workout and Activity counts and chronological history.
- [x] Review relevant 30-day Activity metric totals and averages.
- [x] Review latest weight, weight change, and body measurements.
- [x] Log weight, body-fat percentage, muscle-mass percentage, circumferences,
  and notes directly into the progress history shared with their coach.

Current boundary: body-progress entries do not support photos, editing,
deletion, or a coach approval workflow.

## Platform behavior

- [x] Responsive, role-aware coach and trainee layouts.
- [x] Reusable buttons, pending indicators, modals, tables, toasts, and form
  controls.
- [x] Centralized semantic color tokens and Sthenos brand assets.
- [x] Supabase PostgreSQL, Auth, Storage, row-level security, and committed
  migrations.
- [x] Separate exercise, Routine, Activity, assignment, and log storage.
- [x] Local Playwright coverage for authorization, invitations, deletion,
  archiving, Routine variants and assignments, workout shortcuts, Activity
  customization, Activity logging, and Activity assignment lifecycle.

## Development opportunities

### Product reliability

- [ ] Add repeatable local demo seed data.
- [ ] Configure a non-interactive lint check and CI pipeline.
- [ ] Add unit-level coverage for shared validation and reporting helpers.
- [ ] Add production error monitoring and product analytics.
- [ ] Add mobile viewport, WebKit, and accessibility-focused test passes.

### Training workflows

- [ ] Add assignment calendars, scheduling, and recurrence.
- [ ] Snapshot exercise-based Routine prescriptions on assignment.
- [ ] Capture per-exercise loads, completed reps, effort, pain, and personal
  records.
- [ ] Add GPS/wearable imports and optional imperial units for Activities.
- [ ] Add coach feedback on completed Workouts and Activities.

### Progress and reporting

- [ ] Add charts, comparisons, date filters, and CSV/PDF exports.
- [ ] Add detailed completed-session views.
- [ ] Add optional progress photos and richer check-ins for coach review.

## Keeping this document current

When a product change is merged:

1. Add or update the relevant checked item.
2. Record important limitations under the nearest **Current boundary**.
3. Remove completed work from **Development opportunities**.
4. Update the review date at the top of the file.
