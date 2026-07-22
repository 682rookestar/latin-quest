import type { SupabaseClient } from "@supabase/supabase-js";

export async function hasAal2(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data.currentLevel === "aal2";
}
