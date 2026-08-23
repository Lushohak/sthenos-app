import { PageHeader } from "@/components/dashboard/page-header";
import { TrainingSchedule } from "@/components/schedule/training-schedule";
import { getTraineeOrRedirect } from "@/lib/trainee";
import { todayInTimezone } from "@/lib/training-schedule";
import { loadTrainingSchedule } from "@/lib/training-schedule-data";

type PageProps = {
  searchParams?: Promise<{ date?: string | string[] }>;
};

export default async function TraineeSchedulePage({ searchParams }: PageProps) {
  const { supabase, user, client } = await getTraineeOrRedirect();
  const dateParam = (await searchParams)?.date;
  const requestedDate = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const fallbackToday = todayInTimezone(client.timezone ?? "UTC");
  const focusDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : fallbackToday;
  const schedule = await loadTrainingSchedule(supabase, client.id, focusDate);

  return (
    <>
      <PageHeader title="Schedule" description="Plan training with your coach and keep each completed session connected to your progress." />
      <TrainingSchedule
        client={{
          id: client.id,
          name: client.name,
          coachId: client.coach_id,
          status: client.status,
          timezone: client.timezone,
          timezoneConfirmedAt: client.timezone_confirmed_at,
          remindersEnabled: client.email_workout_reminders_enabled
        }}
        viewer={{ id: user.id, role: "trainee", coachName: "Your coach" }}
        occurrences={schedule.occurrences}
        routines={schedule.routines}
        activities={schedule.activities}
        initialDate={focusDate}
        localToday={fallbackToday}
      />
    </>
  );
}
