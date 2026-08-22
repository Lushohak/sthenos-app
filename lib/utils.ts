import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3])
      )
    : new Date(value);

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function dateOnlyUtc(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatTrainingRecency(
  value: string | null | undefined,
  today: string
) {
  if (!value) return "Never trained";
  const completedAt = dateOnlyUtc(value);
  const todayAt = dateOnlyUtc(today);
  if (completedAt === null || todayAt === null) return formatDate(value);
  const elapsedDays = Math.max(
    0,
    Math.floor((todayAt - completedAt) / (24 * 60 * 60 * 1000))
  );
  if (elapsedDays === 0) return "Today";
  if (elapsedDays === 1) return "1 day ago";
  return `${elapsedDays} days ago`;
}
