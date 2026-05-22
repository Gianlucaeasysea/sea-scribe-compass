import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

const AUTH_BOOT_TIMEOUT_MS = 6000;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let settled = false;

    const finish = (nextSession: Session | null) => {
      if (!mounted) return;
      settled = true;
      setSession(nextSession);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      finish(s);
    });

    const timeout = window.setTimeout(() => {
      if (!settled) finish(null);
    }, AUTH_BOOT_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data }) => finish(data.session))
      .catch(() => finish(null))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user as User | undefined,
    loading,
    signOut: () => supabase.auth.signOut(),
  };
}
