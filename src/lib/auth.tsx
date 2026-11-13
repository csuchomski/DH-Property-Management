import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";
import type { Profile } from "./types";

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  error: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(supabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Several auth events can fire close together right after a sign-in link lands.
  // Each load gets a number and only the newest one may update state, so a slow,
  // stale answer can never overwrite a newer one.
  const latest = useRef(0);

  // link_my_account() returns the caller's profile, linking it to the owner or
  // tenant record with the same (confirmed) email the first time they sign in.
  const loadProfile = useCallback(async (s: Session | null) => {
    const call = ++latest.current;
    if (!s) {
      setProfile(null);
      setError(null);
      return;
    }
    let res = await supabase.rpc("link_my_account");
    // Right after a sign-in the very first request can go out before the new session
    // is attached and be refused as signed-out. Try once more before showing an error.
    if (res.error && call === latest.current) {
      await wait(600);
      if (call !== latest.current) return;
      res = await supabase.rpc("link_my_account");
    }
    if (call !== latest.current) return;
    if (res.error) {
      setError(res.error.message);
      setProfile(null);
    } else {
      setError(null);
      setProfile(res.data as Profile);
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    // INITIAL_SESSION fires once the client has read any sign-in token from the URL,
    // so it is the single starting point; no separate getSession() call to race it.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Supabase warns against awaiting other calls inside this callback.
        setTimeout(() => {
          void loadProfile(s).finally(() => {
            if (event === "INITIAL_SESSION") setLoading(false);
          });
        }, 0);
      }
      // The client clears the token from the address bar but leaves a bare "#".
      if (s && window.location.href.endsWith("#")) {
        history.replaceState(history.state, "", window.location.href.slice(0, -1));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value: AuthState = {
    loading,
    session,
    profile,
    error,
    refreshProfile: () => loadProfile(session),
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
