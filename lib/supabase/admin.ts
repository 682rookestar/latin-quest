import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client that uses the service-role key.
 *
 * The service-role key bypasses RLS, so this MUST NEVER be imported
 * by code that runs in the browser. Use only inside server actions,
 * route handlers, or other "use server" / server-component files.
 *
 * We also disable session persistence and auto-refresh -- this client
 * is for one-shot admin operations, not for representing a logged-in
 * user.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var"
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
