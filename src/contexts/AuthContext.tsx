import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/lib/store";
import { offlineQueue } from "@/lib/sync/offlineQueue";

const LOCAL_SESSION_KEY = "flowfit_local_session";

export interface LocalUserOptions {
  id?: string;
  email?: string;
  name?: string;
}

const createMockSession = (options: LocalUserOptions): Session => {
  const now = new Date().toISOString();
  const email = options.email || "dev@fitflow.app";
  const id = options.id || (email === "dev@fitflow.app" ? "dev-local-user" : "guest-user");
  const name = options.name || (email === "dev@fitflow.app" ? "Developer" : "Guest");

  return {
    access_token: "local-token",
    refresh_token: "local-refresh-token",
    expires_in: 315360000,
    expires_at: 9999999999,
    token_type: "bearer",
    user: {
      id,
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: now,
      phone: "",
      last_sign_in_at: now,
      app_metadata: { provider: "email" },
      user_metadata: { display_name: name },
      created_at: now,
      updated_at: now,
    },
  };
};

const getStoredLocalSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
};

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginAsLocalUser: (role?: "developer" | "guest", customEmail?: string) => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  loginAsLocalUser: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(() => getStoredLocalSession());
  const [loading, setLoading] = useState(() => !getStoredLocalSession());

  const loginAsLocalUser = (role: "developer" | "guest" = "developer", customEmail?: string) => {
    const email = customEmail || (role === "developer" ? "dev@fitflow.app" : "guest@fitflow.app");
    const name = role === "developer" ? "Developer" : "Guest User";
    const newSession = createMockSession({ email, name });
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(newSession));
    } catch (e) {
      console.warn("Could not save local session:", e);
    }
    setSession(newSession);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    // Safety net only for a hung token refresh. Unlocking earlier would bounce
    // signed-in users on slow networks to /auth before their session resolves.
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 8000);

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (newSession) {
        setSession(newSession);
        setLoading(false);
        clearTimeout(safetyTimer);
      } else if (event === "SIGNED_OUT") {
        // Signed out elsewhere (another tab, expired refresh token) — fall back to a local session if any
        setSession(getStoredLocalSession());
      }
    });

    supabase.auth.getSession()
      .then(({ data }) => {
        if (mounted) {
          if (data?.session) {
            setSession(data.session);
          } else {
            // Check if we have a local session
            const local = getStoredLocalSession();
            if (local) {
              setSession(local);
            }
          }
        }
      })
      .catch((err) => {
        console.warn("Supabase getSession fallback to local session:", err);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Flush unsynced writes, then wipe this account's cached data from the device
    await offlineQueue.drainQueue().catch(() => undefined);
    offlineQueue.clear();
    useAppStore.getState().clearLocal();
    try {
      localStorage.removeItem("flowfit-store");
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } catch (e) {
      console.warn("Could not remove local session:", e);
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Cloud signOut failed, proceeding with local logout:", e);
    }
    setSession(null);
    window.location.href = "/auth";
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut,
        loginAsLocalUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
