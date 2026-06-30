import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AuthUser, Profile } from "@/types";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isGuest: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  setGuest: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function mapUser(user: User, profile?: Profile | null): AuthUser {
  return {
    id: user.id,
    email: user.email!,
    username: profile?.username || user.user_metadata?.username || user.email!.split("@")[0],
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
    is_admin: profile?.is_admin || false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  async function fetchAndSetUser(supaUser: User) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", supaUser.id)
      .maybeSingle();
    setUser(mapUser(supaUser, profile));
  }

  async function refreshProfile() {
    const { data: { user: supaUser } } = await supabase.auth.getUser();
    if (supaUser) await fetchAndSetUser(supaUser);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        await fetchAndSetUser(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && session?.user) {
        await fetchAndSetUser(session.user);
        setIsGuest(false);
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        await fetchAndSetUser(session.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function login(u: AuthUser) {
    setUser(u);
    setIsGuest(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setIsGuest(false);
  }

  function setGuest() {
    setIsGuest(true);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, login, logout, setGuest, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
