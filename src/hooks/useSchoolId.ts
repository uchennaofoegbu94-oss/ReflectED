import { useAuth } from '@/contexts/AuthContext';

export function useSchoolId() {
  const { user } = useAuth();
  return user?.schoolId ?? null;
}

/**
 * Returns the current user's school_id or throws.
 * Use inside mutation/query functions where school_id is mandatory.
 */
export function useRequireSchoolId() {
  const schoolId = useSchoolId();
  return () => {
    if (!schoolId) {
      throw new Error('No school context — user is not enrolled in a school.');
    }
    return schoolId;
  };
}

/**
 * Helper to inject school_id into an insert/update payload.
 */
export function withSchoolId<T extends Record<string, any>>(
  payload: T,
  schoolId: string | null | undefined,
): T & { school_id: string } {
  if (!schoolId) {
    throw new Error('Missing school_id — cannot write tenant-scoped row.');
  }
  return { ...payload, school_id: schoolId };
}
