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

/**
 * "Failed to send a request to the Edge Function" is Supabase-JS's own
 * generic message for a FunctionsFetchError — the fetch() call to the
 * function's URL failed before ever reaching the function's own code
 * (almost always: the function isn't deployed to this project, or a
 * network/CORS issue). It reads like a business-logic failure ("the
 * delete failed") when it's actually "this feature isn't reachable at
 * all right now" — a very different thing to tell someone. Wraps any
 * edge-function error with that distinction made explicit, for every
 * screen that calls supabase.functions.invoke.
 */
export function describeEdgeFunctionError(error: any, actionLabel: string): string {
  const message: string = error?.message || '';
  if (message.includes('Failed to send a request to the Edge Function') || error?.name === 'FunctionsFetchError') {
    return `Couldn't reach the server to ${actionLabel} — this usually means the function isn't deployed yet. Contact your developer/admin.`;
  }
  return error?.message || `Failed to ${actionLabel}`;
}
