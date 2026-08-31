"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function validateSignupCode(rawCode: string): Promise<boolean> {
  const code = rawCode.replace(/\s+/g, "").toUpperCase();
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(code)) {
    return false;
  }

  // validate_join_code is service-only. Anonymous browsers receive only a
  // boolean and cannot query class identifiers or names from the Data API.
  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("validate_join_code", { p_code: code })
    .maybeSingle();

  return !error && Boolean(data);
}
