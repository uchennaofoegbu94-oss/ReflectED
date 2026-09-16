import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolId } from './useSchoolId';

export type SearchResultCategory = 'students' | 'staff' | 'classes' | 'library' | 'announcements';

export interface SearchResult {
  id: string;
  category: SearchResultCategory;
  title: string;
  subtitle?: string;
  path: string;
}

/**
 * Global search across the app. Every query below goes through the normal
 * Supabase client under the current session, so each table's existing RLS
 * policy is what actually decides what comes back — a student searching only
 * ever gets their own student record, a parent only their own children, and
 * so on. This is deliberate: RLS is a stronger, harder-to-get-wrong guarantee
 * of "scoped by role's visibility" than any client-side filtering would be,
 * so the category list below is uniform for every role and lets RLS do the
 * real enforcement rather than duplicating it here.
 */
export function useGlobalSearch(query: string) {
  const schoolId = useSchoolId();
  const trimmed = query.trim();

  return useQuery({
    queryKey: ['global-search', schoolId, trimmed],
    queryFn: async (): Promise<SearchResult[]> => {
      const like = `%${trimmed}%`;

      const [studentsRes, staffRes, classesRes, booksRes, announcementsRes] = await Promise.all([
        supabase.from('students').select('id, first_name, last_name, admission_number, class_id')
          .or(`first_name.ilike.${like},last_name.ilike.${like},admission_number.ilike.${like}`)
          .limit(6),
        supabase.from('staff').select('id, first_name, last_name, employee_id')
          .or(`first_name.ilike.${like},last_name.ilike.${like},employee_id.ilike.${like}`)
          .limit(6),
        supabase.from('class_arms').select('id, name')
          .ilike('name', like)
          .limit(6),
        supabase.from('library_books' as any).select('id, title, author')
          .or(`title.ilike.${like},author.ilike.${like}`)
          .limit(6),
        supabase.from('school_announcements').select('id, title')
          .ilike('title', like)
          .limit(6),
      ]);

      const results: SearchResult[] = [];

      (studentsRes.data || []).forEach((s: any) => results.push({
        id: s.id, category: 'students', title: `${s.first_name} ${s.last_name}`,
        subtitle: s.admission_number, path: '/students',
      }));
      (staffRes.data || []).forEach((s: any) => results.push({
        id: s.id, category: 'staff', title: `${s.first_name} ${s.last_name}`,
        subtitle: s.employee_id, path: '/teachers',
      }));
      (classesRes.data || []).forEach((c: any) => results.push({
        id: c.id, category: 'classes', title: c.name, path: '/classes',
      }));
      (booksRes.data || []).forEach((b: any) => results.push({
        id: b.id, category: 'library', title: b.title, subtitle: b.author || undefined, path: '/library',
      }));
      (announcementsRes.data || []).forEach((a: any) => results.push({
        id: a.id, category: 'announcements', title: a.title, path: '/communication',
      }));

      return results;
    },
    enabled: !!schoolId && trimmed.length >= 2,
  });
}

export const CATEGORY_LABELS: Record<SearchResultCategory, string> = {
  students: 'Students',
  staff: 'Staff',
  classes: 'Classes',
  library: 'Library',
  announcements: 'Announcements',
};
