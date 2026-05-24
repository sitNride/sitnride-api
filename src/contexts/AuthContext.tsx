import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { database as supabase } from '@/lib/database';
import { User, DriverProfile, RiderProfile, Vehicle, UserRole } from '@/types';

// localStorage key for tracking pending onboarding
const ONBOARDING_KEY_PREFIX = 'sitnride_needs_onboarding_';

interface AuthContextType {
  user: User | null;
  driverProfile: DriverProfile | null;
  riderProfile: RiderProfile | null;
  vehicle: Vehicle | null;
  isLoading: boolean;
  needsOnboarding: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, fullName: string, role: UserRole, phone?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  completeOnboarding: () => Promise<void>;
  refreshDriverProfile: () => Promise<void>;
  refreshRiderProfile: () => Promise<void>;
  refreshVehicle: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateDriverProfile: (updates: Partial<DriverProfile>) => Promise<{ success: boolean; error?: string }>;
  updateRiderProfile: (updates: Partial<RiderProfile>) => Promise<{ success: boolean; error?: string }>;
  setVehicle: (vehicle: Vehicle) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [riderProfile, setRiderProfile] = useState<RiderProfile | null>(null);
  const [vehicle, setVehicleState] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const initializedRef = useRef(false);

  // Helper: check if a user has a pending onboarding flag in localStorage
  const hasOnboardingFlag = (userId: string): boolean => {
    return localStorage.getItem(ONBOARDING_KEY_PREFIX + userId) === 'true';
  };

  // Helper: set the onboarding flag in localStorage
  const setOnboardingFlag = (userId: string) => {
    localStorage.setItem(ONBOARDING_KEY_PREFIX + userId, 'true');
  };

  // Helper: clear the onboarding flag from localStorage
  const clearOnboardingFlag = (userId: string) => {
    localStorage.removeItem(ONBOARDING_KEY_PREFIX + userId);
  };

  // Helper: check if a Supabase error means the table doesn't exist
  const isTableMissing = (error: any): boolean => {
    if (!error) return false;
    const code = error.code || '';
    const message = String(error.message || '');
    return code === 'PGRST205' || message.includes('Could not find the table') || message.includes('relation') && message.includes('does not exist');
  };

  // Fetch the app-level user row from the custom "users" table by email
  const fetchAppUser = async (email: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (error) {
        if (isTableMissing(error)) {
          console.warn('[AuthContext] "users" table not found — will use synthetic user.');
        }
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
        created_at: data.created_at,
      };
    } catch {
      return null;
    }
  };

  // Fetch the app-level user row by auth user id
  const fetchAppUserById = async (authUserId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      if (error) {
        if (isTableMissing(error)) {
          // Already warned in fetchAppUser, stay silent here
        }
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
        created_at: data.created_at,
      };
    } catch {
      return null;
    }
  };

  // Build a synthetic user object from Supabase Auth data.
  // Used as a fallback when the custom "users" table is missing or inaccessible.
  const buildSyntheticUser = (authUserId: string, email: string): User => ({
    id: authUserId,
    email: email.toLowerCase(),
    full_name: email.split('@')[0],
    role: 'rider',
    created_at: new Date().toISOString(),
  });

  // Auto-create a user row in the custom "users" table if one doesn't exist
  // This ensures Supabase auth success always grants access
  const ensureAppUser = async (authUserId: string, email: string): Promise<User | null> => {
    // First try to find by email
    let appUser = await fetchAppUser(email);
    if (appUser) return appUser;

    // Then try to find by auth user id
    appUser = await fetchAppUserById(authUserId);
    if (appUser) return appUser;

    // No user row exists — try to auto-create one with default role 'rider'
    try {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUserId,
          email: email.toLowerCase(),
          full_name: email.split('@')[0], // Use email prefix as default name
          role: 'rider' as UserRole,
        })
        .select()
        .single();

      if (insertError || !newUser) {
        if (isTableMissing(insertError)) {
          console.warn('[AuthContext] Cannot create user row — "users" table missing. Using synthetic user.');
          return buildSyntheticUser(authUserId, email);
        }
        console.warn('Auto-create user row failed:', insertError?.message);
        // Even if insert fails, try fetching again (race condition / RLS)
        appUser = await fetchAppUser(email);
        if (appUser) return appUser;
        appUser = await fetchAppUserById(authUserId);
        if (appUser) return appUser;

        // Last resort: return a synthetic user object so login isn't blocked
        return buildSyntheticUser(authUserId, email);
      }

      // Also auto-create a rider profile for the new user
      // NOTE: This is called during login/session-restore, NOT signup.
      // So we do NOT set needsOnboarding here — login users skip onboarding.
      try {
        await supabase
          .from('profiles')
          .insert({
            id: newUser.id,
          });
      } catch {
        // Non-blocking — rider profile creation failure shouldn't block login
        console.warn('Auto-create rider profile failed');
      }

      return {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        phone: newUser.phone,
        role: newUser.role,
        created_at: newUser.created_at,
      };
    } catch (err) {
      console.warn('ensureAppUser error:', err);
      // Return synthetic user so login is never blocked
      return buildSyntheticUser(authUserId, email);
    }
  };


  // Determine if a rider user needs onboarding based on:
  // 1. localStorage flag (set during signup, cleared after onboarding)
  // 2. DB has_completed_onboarding field (if column exists)
  // Login users NEVER need onboarding. Only signup users do.
  const checkOnboardingNeeded = (userId: string, profile: RiderProfile | null): boolean => {
    // Primary check: localStorage flag (most reliable, set only during signup)
    if (hasOnboardingFlag(userId)) {
      return true;
    }

    // Secondary check: if profile exists and has_completed_onboarding is explicitly false
    // (This handles the case where user signed up, localStorage was cleared, but DB says not complete)
    if (profile && profile.has_completed_onboarding === false) {
      return true;
    }

    // All other cases: no onboarding needed
    // - Profile exists without the column (undefined) → existing user, skip
    // - Profile exists with has_completed_onboarding = true → completed, skip
    // - Profile is null → login auto-created it or DB issue, skip
    // - No localStorage flag → not a fresh signup, skip
    return false;
  };

  // On mount: restore session from Supabase Auth, then hydrate app user
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const authUser = session.user;
          const email = authUser.email || '';
          // Use ensureAppUser to auto-create profile if missing
          const appUser = await ensureAppUser(authUser.id, email);
          if (appUser) {
            setUser(appUser);
            localStorage.setItem('rideshare_user', JSON.stringify(appUser));
            await loadProfiles(appUser);

            // Check onboarding status for riders on session restore
            if (appUser.role === 'rider') {
              // We need to check after profiles are loaded, so we do it in a microtask
              // The riderProfile state will be set by loadProfiles → fetchRiderProfile
              // But since setState is async, we check localStorage directly here
              if (hasOnboardingFlag(appUser.id)) {
                setNeedsOnboarding(true);
              }
              // DB-based check will happen in the useEffect below that watches riderProfile
            }
          }
        } else {
          // Fallback: check localStorage for a previously stored user
          const storedUser = localStorage.getItem('rideshare_user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser) as User;
            setUser(parsedUser);
            await loadProfiles(parsedUser);

            if (parsedUser.role === 'rider' && hasOnboardingFlag(parsedUser.id)) {
              setNeedsOnboarding(true);
            }
          }
        }
      } catch {
        // Fallback to localStorage on any error
        const storedUser = localStorage.getItem('rideshare_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as User;
          setUser(parsedUser);
          await loadProfiles(parsedUser);

          if (parsedUser.role === 'rider' && hasOnboardingFlag(parsedUser.id)) {
            setNeedsOnboarding(true);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // Listen for auth state changes (e.g. token refresh, sign-out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setDriverProfile(null);
          setRiderProfile(null);
          setVehicleState(null);
          setNeedsOnboarding(false);
          localStorage.removeItem('rideshare_user');
        }
        // SIGNED_IN is handled by login/signup directly, so we don't
        // duplicate profile loading here to avoid race conditions.
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Secondary onboarding check: when riderProfile is loaded from DB,
  // check has_completed_onboarding field (handles cross-device scenarios)
  useEffect(() => {
    if (user && user.role === 'rider' && riderProfile) {
      // If DB says onboarding not completed AND there's no localStorage override
      if (riderProfile.has_completed_onboarding === false && hasOnboardingFlag(user.id)) {
        setNeedsOnboarding(true);
      }
      // If DB says onboarding IS completed, clear any stale localStorage flag
      if (riderProfile.has_completed_onboarding === true) {
        clearOnboardingFlag(user.id);
        setNeedsOnboarding(false);
      }
    }
  }, [user, riderProfile]);

  const loadProfiles = async (currentUser: User) => {
    if (currentUser.role === 'driver' || currentUser.role === 'admin') {
      await fetchDriverProfile(currentUser.id);
    }
    if (currentUser.role === 'rider') {
      await fetchRiderProfile(currentUser.id);
    }
  };

  const fetchDriverProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data && !error) {
      setDriverProfile(data);
      // Also fetch vehicle
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('*')
        .eq('driver_id', data.id)
        .maybeSingle();
      if (vehicleData) {
        setVehicleState(vehicleData);
      }
    }
  };

   const fetchRiderProfile = async (userId: string) => {
    // profiles.id = auth.users.id (standard Supabase pattern, NO user_id column)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (data && !error) {
      setRiderProfile(data);
    }
  };



  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Authenticate with Supabase Auth to establish a real session
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (authError) {
        // If Supabase Auth fails (e.g. user not yet in auth.users), fall back
        // to the legacy custom-table login so existing users aren't locked out.
        return legacyLogin(email, password);
      }

      // 2. Fetch or auto-create the app-level user row (NEVER block on missing profile)
      const authUser = authData.user;
      if (!authUser) {
        return { success: false, error: 'Authentication failed' };
      }

      const appUser = await ensureAppUser(authUser.id, email);
      if (!appUser) {
        return { success: false, error: 'Unable to initialize user profile' };
      }

      // LOGIN = existing user → NEVER show onboarding
      // Clear any stale onboarding flag that might exist
      clearOnboardingFlag(appUser.id);
      setNeedsOnboarding(false);

      setUser(appUser);
      localStorage.setItem('rideshare_user', JSON.stringify(appUser));
      await loadProfiles(appUser);

      return { success: true };
    } catch (err) {
      return { success: false, error: 'An error occurred during login' };
    }
  };

  // Legacy login for users who may not yet have a Supabase Auth account
  const legacyLogin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: 'Invalid email or password. If you don\'t have an account, please create one.' };
      }

      if (data.password_hash !== password) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Attempt to create a Supabase Auth account so future logins get a session
      // (and the current session is established immediately)
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
      });

      // If sign-up succeeded or user already exists, try signing in
      if (!signUpError) {
        await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password,
        });
      } else {
        // If the auth account already exists, just sign in
        await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password,
        });
      }

      const userData: User = {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
        created_at: data.created_at,
      };

      // LEGACY LOGIN = existing user → NEVER show onboarding
      clearOnboardingFlag(userData.id);
      setNeedsOnboarding(false);

      setUser(userData);
      localStorage.setItem('rideshare_user', JSON.stringify(userData));
      await loadProfiles(userData);

      return { success: true };
    } catch (err) {
      return { success: false, error: 'An error occurred during login' };
    }
  };

  const signup = async (
    email: string, 
    password: string, 
    fullName: string, 
    role: UserRole,
    phone?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Check if user exists in the custom users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
      }

      // 1. Create Supabase Auth account (establishes a real session)
      const { data: authSignUpData, error: authSignUpError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
      });

      // HARD GUARD: If Supabase Auth sign-up failed, STOP immediately.
      // Do NOT continue to insert into the users table or run any post-signup logic.
      // Continuing with an empty/invalid auth user id was the root cause of the
      // "invalid input syntax for type uuid: \"\"" errors and cascading failures.
      if (authSignUpError) {
        console.warn('Supabase Auth sign-up failed:', authSignUpError.message);
        const msg = String(authSignUpError.message || '').toLowerCase();
        // Surface a friendly, actionable message for common cases
        if (msg.includes('rate limit') || msg.includes('email rate')) {
          return {
            success: false,
            error: 'Too many sign-up attempts right now. Please wait a few minutes and try again.',
          };
        }
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
          return {
            success: false,
            error: 'An account with this email already exists. Please sign in instead.',
          };
        }
        if (msg.includes('password')) {
          return {
            success: false,
            error: authSignUpError.message,
          };
        }
        return {
          success: false,
          error: `Sign-up failed: ${authSignUpError.message}`,
        };
      }

      // Determine the user ID from the auth response
      const authUserId = authSignUpData?.user?.id;

      // HARD GUARD: If we don't have a valid auth user id, STOP immediately.
      // This prevents the downstream "invalid input syntax for type uuid: \"\"" error
      // and ensures no post-signup logic (users insert, profile creation, Stripe, etc.)
      // runs against a broken auth state.
      if (!authUserId || typeof authUserId !== 'string' || authUserId.trim() === '') {
        console.warn('Supabase Auth sign-up returned no user id — aborting signup.');
        return {
          success: false,
          error: 'Sign-up could not be completed. The authentication service did not return a user. Please try again in a few minutes.',
        };
      }

      // Sign in to establish the session (signUp may auto-confirm or require email).
      // This only runs once we have a valid authUserId above.
      await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      // 2. Create user in the custom users table (authUserId is guaranteed valid here)
      const insertPayload: Record<string, unknown> = {
        id: authUserId,
        email: email.toLowerCase(),
        password_hash: password,
        full_name: fullName,
        phone: phone || null,
        role: role,
      };


      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert(insertPayload)
        .select()
        .single();

      if (userError || !newUser) {
        // If insert failed, try to fetch existing user (might be a race condition)
        const existingAppUser = await ensureAppUser(
          authUserId || '',
          email
        );
        if (existingAppUser) {
          setUser(existingAppUser);
          localStorage.setItem('rideshare_user', JSON.stringify(existingAppUser));
          await loadProfiles(existingAppUser);
          // Even on fallback, if this is a rider signup, flag for onboarding
          if (role === 'rider') {
            setOnboardingFlag(existingAppUser.id);
            setNeedsOnboarding(true);
          }
          return { success: true };
        }
        return { success: false, error: 'Failed to create account. Please try again.' };
      }

      // 3. Create profile based on role
      if (role === 'driver') {
        try {
          await supabase
            .from('driver_profiles')
            .insert({
              user_id: newUser.id,
              status: 'new',
              onboarding_step: 1,
            });
        } catch {
          console.warn('Failed to create driver profile — non-blocking');
        }
      } else if (role === 'rider') {
        // profiles.id = auth.users.id (standard Supabase pattern, NO user_id column)
        try {
          await supabase
            .from('profiles')
            .insert({
              id: newUser.id,
            });
        } catch {
          console.warn('Failed to create rider profile — non-blocking');
        }

        // SIGNUP = new user → SET onboarding flag
        setOnboardingFlag(newUser.id);
        setNeedsOnboarding(true);
      }

      const userData: User = {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        phone: newUser.phone,
        role: newUser.role,
        created_at: newUser.created_at,
      };

      setUser(userData);
      localStorage.setItem('rideshare_user', JSON.stringify(userData));
      await loadProfiles(userData);

      return { success: true };
    } catch (err) {
      return { success: false, error: 'An error occurred during signup. Please try again.' };
    }
  };

  // Called when rider completes onboarding — clears flag and tries to persist to DB
  const completeOnboarding = async () => {
    setNeedsOnboarding(false);

    if (user) {
      clearOnboardingFlag(user.id);
    }

    // Try to update DB (non-blocking — column may not exist yet)
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ has_completed_onboarding: true })
          .eq('id', user.id);
      } catch (e) {
        console.warn('[completeOnboarding] DB update failed (non-blocking):', e);
      }
    }

    // Refresh rider profile to get latest data
    if (user) {
      await fetchRiderProfile(user.id);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'An error occurred. Please try again.' };
    }
  };

  const logout = () => {
    supabase.auth.signOut().catch(() => {});
    setUser(null);
    setDriverProfile(null);
    setRiderProfile(null);
    setVehicleState(null);
    setNeedsOnboarding(false);
    localStorage.removeItem('rideshare_user');
    // Note: we do NOT clear the onboarding flag on logout.
    // If a user signed up but didn't finish onboarding, they should
    // still see it when they log back in... BUT the requirement says
    // "login → dashboard". So we DO clear it to prevent loops.
    if (user) {
      clearOnboardingFlag(user.id);
    }
  };

  const refreshDriverProfile = async () => {
    if (user) {
      await fetchDriverProfile(user.id);
    }
  };

  const refreshRiderProfile = async () => {
    if (user) {
      await fetchRiderProfile(user.id);
    }
  };

  const refreshVehicle = async () => {
    if (driverProfile) {
      const { data } = await supabase
        .from('vehicles')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .maybeSingle();
      if (data) {
        setVehicleState(data);
      }
    }
  };

  // Generic refresh profile function that refreshes based on user role
  const refreshProfile = async () => {
    if (user) {
      if (user.role === 'driver' || user.role === 'admin') {
        await fetchDriverProfile(user.id);
      }
      if (user.role === 'rider') {
        await fetchRiderProfile(user.id);
      }
    }
  };

  const updateDriverProfile = async (updates: Partial<DriverProfile>): Promise<{ success: boolean; error?: string }> => {
    if (!driverProfile) {
      return { success: false, error: 'No driver profile found' };
    }

    const { error } = await supabase
      .from('driver_profiles')
      .update(updates)
      .eq('id', driverProfile.id);

    if (error) {
      return { success: false, error: error.message };
    }

    setDriverProfile({ ...driverProfile, ...updates });
    return { success: true };
  };

  const updateRiderProfile = async (updates: Partial<RiderProfile>): Promise<{ success: boolean; error?: string }> => {
    if (!riderProfile) {
      // If no rider profile loaded, try to update using user.id directly
      // This handles the case where the profile wasn't fetched yet
      if (!user) {
        return { success: false, error: 'No rider profile found' };
      }
      
      // Try to update profiles table directly using user.id
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.warn('updateRiderProfile fallback error:', error.message);
        return { success: false, error: error.message };
      }

      // Refresh the rider profile after update
      await fetchRiderProfile(user.id);
      return { success: true };
    }

    // profiles.id = auth.users.id (standard Supabase pattern, NO user_id column)
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', riderProfile.id);

    if (error) {
      return { success: false, error: error.message };
    }

    setRiderProfile({ ...riderProfile, ...updates });
    return { success: true };
  };


  const setVehicle = (newVehicle: Vehicle) => {
    setVehicleState(newVehicle);
  };

  return (
    <AuthContext.Provider value={{
      user,
      driverProfile,
      riderProfile,
      vehicle,
      isLoading,
      needsOnboarding,
      login,
      signup,
      logout,
      resetPassword,
      completeOnboarding,
      refreshDriverProfile,
      refreshRiderProfile,
      refreshVehicle,
      refreshProfile,
      updateDriverProfile,
      updateRiderProfile,
      setVehicle,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
