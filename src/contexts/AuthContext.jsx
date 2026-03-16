import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Initializing...');
    
    // Safety timeout to prevent stuck loading state
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('AuthProvider: Loading timeout reached, forcing loading = false');
        setLoading(false);
      }
    }, 5000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('AuthProvider: getSession result:', { session: !!session, error });
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error('AuthProvider: getSession fatal error:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthProvider: onAuthStateChange event:', event, !!session);
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    console.log('AuthProvider: Fetching profile for:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          roles (
            name
          )
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error('AuthProvider: Error fetching profile:', error);
        // Fallback: set basic user info from session if profile fetch fails
        setUser({ id: userId, email: session?.user?.email });
        setRole('student');
        return;
      }
      
      console.log('AuthProvider: Profile fetched successfully:', data);
      setUser(data);
      
      // Handle both object and array formats for the joined role
      let roleName = 'student';
      if (data.roles) {
        if (Array.isArray(data.roles)) {
          roleName = data.roles[0]?.name || 'student';
        } else {
          roleName = data.roles.name || 'student';
        }
      }
      
      console.log('AuthProvider: Setting role to:', roleName);
      setRole(roleName);
    } catch (error) {
      console.error('AuthProvider: Catch block fetching profile:', error.message);
      setRole('student');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password, username, fullName) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name: fullName,
        }
      }
    });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user,
      role,
      loading,
      signIn,
      signUp,
      signOut
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
