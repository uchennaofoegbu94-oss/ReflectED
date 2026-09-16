import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface School {
  id: string;
  name: string;
  school_code: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  tagline: string | null;
  principal_signature_url: string | null;
  school_stamp_url: string | null;
}

interface SchoolContextType {
  school: School | null;
  isLoading: boolean;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const { data: school = null, isLoading } = useQuery({
    queryKey: ['school', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const { data, error } = await supabase
        .from('schools' as any)
        .select('*')
        .eq('id', user.schoolId)
        .single();
      if (error) throw error;
      return data as unknown as School;
    },
    enabled: !!user?.schoolId,
  });

  return (
    <SchoolContext.Provider value={{ school, isLoading }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
}
