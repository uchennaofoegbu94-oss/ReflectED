import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Grading a submission can fail because the DB rejected the automatic
 * Pre-CA push (enforce_entry_mode trigger — the target field is locked as
 * manual-only, or the whole grade update got rolled back for some other
 * pipeline reason). Strip the generic "Failed to grade..." framing for
 * those so the actual, already-descriptive DB message is what the teacher
 * sees, instead of it reading like an unrelated grading failure.
 */
export function describeGradingError(error: any): string {
  const message: string = error?.message || 'Unknown error';
  if (message.includes('is locked as')) {
    return message;
  }
  return 'Failed to grade submission: ' + message;
}
