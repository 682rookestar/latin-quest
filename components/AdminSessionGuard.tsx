"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_IDLE_TIMEOUT_MS } from "@/lib/admin-session";

const LAST_ACTIVITY_KEY = "lq_admin_last_activity";

export default function AdminSessionGuard() {
  const router = useRouter();
  useEffect(() => {
    let lastActivity = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
    let signingOut = false;
    const recordActivity = () => {
      lastActivity = Date.now();
      sessionStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
    };
    const enforceTimeout = async () => {
      if (signingOut || Date.now() - lastActivity <= ADMIN_IDLE_TIMEOUT_MS) return;
      signingOut = true;
      sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      await createClient().auth.signOut();
      router.replace("/login?error=session_expired");
      router.refresh();
    };
    if (Date.now() - lastActivity > ADMIN_IDLE_TIMEOUT_MS) void enforceTimeout();
    else recordActivity();
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener("focus", enforceTimeout);
    document.addEventListener("visibilitychange", enforceTimeout);
    const timer = window.setInterval(enforceTimeout, 30_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener("focus", enforceTimeout);
      document.removeEventListener("visibilitychange", enforceTimeout);
      window.clearInterval(timer);
    };
  }, [router]);
  return null;
}
