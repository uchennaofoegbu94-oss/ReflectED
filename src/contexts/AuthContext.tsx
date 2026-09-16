import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  avatar?: string;
  phone?: string;
  schoolId: string | null;
  isSuperAdmin: boolean;
  // 'pending' means a self-signup hasn't been reviewed yet — the account
  // exists but has no real functional access (has_role()/is_staff() on
  // the backend both require 'approved'). Absent a role row entirely
  // (e.g. a super-admin with no school), treated as approved — there's
  // nothing pending review.
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, fullName: string, role: AppRole, schoolId: string | null) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  // Re-fetches profile/role/avatar for the current session without a full
  // reload — needed after anything edits profiles/staff/students directly
  // (e.g. an avatar upload), since fetchUserData only otherwise runs once
  // at sign-in and AuthContext's own `user` object is what the header,
  // sidebar, and anywhere else using useAuth() actually render from.
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const lastUserIdRef = useRef<string | null>(null);

  const fetchUserData = async (userId: string) => {
    try {
      const [profileRes, roleRes, superAdminRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role, approval_status').eq('user_id', userId).maybeSingle(),
        supabase.from('super_admins' as any).select('id').eq('user_id', userId).maybeSingle(),
      ]);

      const profile = profileRes.data;
      const roleData = roleRes.data;
      const isSuperAdmin = !!superAdminRes.data;

      if (profile) {
        setUser({
          id: userId,
          name: profile.full_name,
          email: profile.email || '',
          role: roleData?.role || 'student',
          avatar: profile.avatar_url || undefined,
          phone: profile.phone || undefined,
          schoolId: (profile as any).school_id || null,
          isSuperAdmin,
          approvalStatus: (roleData?.approval_status as AuthUser['approvalStatus']) || 'approved',
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const newUserId = session?.user?.id ?? null;
        // Clear all cached queries when the authenticated identity changes
        // (sign-in as a different user, sign-out, or session swap). This is
        // critical for multi-tenant safety: never serve another tenant's
        // cached data to the next session in the same browser.
        if (lastUserIdRef.current !== newUserId) {
          queryClient.clear();
          lastUserIdRef.current = newUserId;
        }
        if (event === 'SIGNED_OUT') {
          queryClient.clear();
        }
        setSession(session);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } catch {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signup = async (
    email: string,
    password: string,
    fullName: string,
    role: AppRole,
    schoolId: string | null
  ): Promise<{ error: string | null }> => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      // Student/staff record creation now happens entirely inside the
      // handle_new_user() database trigger (SECURITY DEFINER, so it
      // bypasses RLS reliably and runs atomically with the auth.users
      // insert). This used to be a separate client-side insert here,
      // which RLS silently rejected for self-registering students —
      // only staff could insert into `students`, and a brand-new
      // student is never staff. Passing `role` in the signup metadata
      // is what lets the trigger do the right thing per role.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            school_id: schoolId,
            role,
          },
        },
      });

      if (error) return { error: error.message };
      if (!data.user) return { error: 'Signup did not return a user' };

      return { error: null };
    } catch {
      return { error: 'An unexpected error occurred' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    queryClient.clear();
  };

  const refreshUser = async () => {
    if (session?.user?.id) {
      await fetchUserData(session.user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
        isLoading,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
