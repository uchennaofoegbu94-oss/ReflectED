import { useAuth } from '@/contexts/AuthContext';
import { useSchoolSetting, useUpdateSchoolSetting } from './useSchoolSettings';
import { useSpecialRoles } from './useSpecialRoles';
import { useMyStaffId } from './useMyStaffId';
import type { SpecialRoleType } from './useSpecialRoles';

// school_settings keys used for this feature (same key-value table proctor_mode uses)
export const RESTRICT_REPORT_CARDS_STUDENTS_KEY = 'restrict_report_cards_students';
export const RESTRICT_REPORT_CARDS_TEACHERS_KEY = 'restrict_report_cards_teachers';
export const REPORT_CARD_EXCEPTION_ROLES_KEY = 'report_card_exception_roles';
export const RESTRICT_TRANSCRIPTS_TEACHERS_KEY = 'restrict_transcripts_teachers';
export const TRANSCRIPT_EXCEPTION_ROLES_KEY = 'transcript_exception_roles';
export const BROADSHEET_DOWNLOAD_EXCEPTION_ROLES_KEY = 'broadsheet_download_exception_roles';

export { useUpdateSchoolSetting };

/** Active special_role_types currently held by the logged-in staff member. */
function useMySpecialRoleTypes(): Set<SpecialRoleType> {
  const { data: myStaffId } = useMyStaffId();
  const { data: allRoles = [] } = useSpecialRoles();
  if (!myStaffId) return new Set();
  return new Set(
    allRoles.filter((r) => r.staff_id === myStaffId).map((r) => r.role_type)
  );
}

function rolesArray(value: any): SpecialRoleType[] {
  return Array.isArray(value) ? (value as SpecialRoleType[]) : [];
}

function hasExemptRole(myRoles: Set<SpecialRoleType>, exceptionRoles: SpecialRoleType[]) {
  return exceptionRoles.some((r) => myRoles.has(r));
}

/**
 * Report card access for the current user. Admin/principal are never restricted
 * (they're the ones who set the switches). Students are blocked from their own
 * report card when the student switch is on. Teachers are blocked from viewing
 * any student's report card when the teacher switch is on, unless they hold one
 * of the exempted special roles (e.g. Vice Principal, Dean of Studies).
 */
export function useReportCardAccess() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';

  const { data: restrictStudents, isLoading: l1 } = useSchoolSetting(RESTRICT_REPORT_CARDS_STUDENTS_KEY);
  const { data: restrictTeachers, isLoading: l2 } = useSchoolSetting(RESTRICT_REPORT_CARDS_TEACHERS_KEY);
  const { data: exceptionRolesRaw, isLoading: l3 } = useSchoolSetting(REPORT_CARD_EXCEPTION_ROLES_KEY);
  const myRoles = useMySpecialRoleTypes();

  const isLoading = l1 || l2 || l3;
  const exceptionRoles = rolesArray(exceptionRolesRaw);
  const isExempt = isTeacher && hasExemptRole(myRoles, exceptionRoles);

  const isBlocked =
    !isAdmin &&
    ((isStudent && !!restrictStudents) || (isTeacher && !!restrictTeachers && !isExempt));

  return { isBlocked, isLoading, restrictStudents: !!restrictStudents, restrictTeachers: !!restrictTeachers };
}

/**
 * Transcript access for the current user. Admin/principal are never restricted.
 * Only teachers are ever gated here (students/parents don't currently have
 * transcript access at all, so there's nothing to restrict for them).
 */
export function useTranscriptAccess() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const isTeacher = user?.role === 'teacher';

  const { data: restrictTeachers, isLoading: l1 } = useSchoolSetting(RESTRICT_TRANSCRIPTS_TEACHERS_KEY);
  const { data: exceptionRolesRaw, isLoading: l2 } = useSchoolSetting(TRANSCRIPT_EXCEPTION_ROLES_KEY);
  const myRoles = useMySpecialRoleTypes();

  const isLoading = l1 || l2;
  const exceptionRoles = rolesArray(exceptionRolesRaw);
  const isExempt = isTeacher && hasExemptRole(myRoles, exceptionRoles);

  const isBlocked = !isAdmin && isTeacher && !!restrictTeachers && !isExempt;

  return { isBlocked, isLoading, restrictTeachers: !!restrictTeachers };
}

/**
 * PDF download permission — deliberately independent of (and stricter than)
 * the two view-access hooks above. Those two only block teachers when a
 * school has switched a restriction ON; downloads of the formal pipeline
 * documents (report card, transcript, broadsheet) are always limited to
 * admin/principal plus whichever special roles the school has explicitly
 * exempted, regardless of whether the broader view-restriction toggle is
 * on or off. Students/parents downloading their own report card/transcript
 * are unaffected — this only ever gates staff.
 */
function useCanDownloadPipelineDocument(exceptionSettingKey: string) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const isTeacher = user?.role === 'teacher';

  const { data: exceptionRolesRaw, isLoading } = useSchoolSetting(exceptionSettingKey);
  const myRoles = useMySpecialRoleTypes();

  const exceptionRoles = rolesArray(exceptionRolesRaw);
  const isExempt = isTeacher && hasExemptRole(myRoles, exceptionRoles);

  // Non-staff (parent/student downloading their own document) aren't
  // gated by this check at all — callers only wire this into staff-facing
  // download buttons in the first place.
  const canDownload = isAdmin || isExempt;

  return { canDownload, isLoading };
}

export function useCanDownloadReportCard() {
  return useCanDownloadPipelineDocument(REPORT_CARD_EXCEPTION_ROLES_KEY);
}

export function useCanDownloadTranscript() {
  return useCanDownloadPipelineDocument(TRANSCRIPT_EXCEPTION_ROLES_KEY);
}

export function useCanDownloadBroadsheet() {
  return useCanDownloadPipelineDocument(BROADSHEET_DOWNLOAD_EXCEPTION_ROLES_KEY);
}
