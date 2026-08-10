import type { Database } from "@/types/database";

type ClientGender = Database["public"]["Enums"]["client_gender"];

export function calculateAge(
  dateOfBirth: string | null | undefined,
  fallbackAge: number | null = null,
  referenceDate = new Date()
) {
  const match = dateOfBirth?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return fallbackAge;

  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);
  let age = referenceDate.getFullYear() - birthYear;
  const birthdayHasPassed =
    referenceDate.getMonth() + 1 > birthMonth
    || (
      referenceDate.getMonth() + 1 === birthMonth
      && referenceDate.getDate() >= birthDay
    );

  if (!birthdayHasPassed) age -= 1;
  return age >= 0 ? age : fallbackAge;
}

export function formatClientGender(gender: ClientGender | null | undefined) {
  switch (gender) {
    case "male":
      return "Male";
    case "female":
      return "Female";
    case "prefer_not_to_say":
      return "Prefer not to say";
    default:
      return "Not set";
  }
}
