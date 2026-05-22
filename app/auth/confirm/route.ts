import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side handler for email-link verification.
 *
 * Supabase's /auth/v1/verify endpoint lives on the *.supabase.co
 * domain, so when it redirects back to our app it can't set the
 * session cookie on our origin. Instead we point invite / magic-link
 * emails at this route, which runs verifyOtp() with the @supabase/ssr
 * server client -- that exchange happens on our domain and writes the
 * session cookie via the cookies() store before redirecting on to
 * `?next=`.
 *
 * Expected query string:
 *   token_hash   - the one-time token hash from Supabase
 *   type         - 'invite' | 'magiclink' | 'recovery' | 'email_change' | etc.
 *   next         - path to redirect to on success (defaults to /dashboard)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (!token_hash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=missing_token`
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    // Common cause: token already consumed by an email scanner, or
    // expired. Keep the message generic.
    return NextResponse.redirect(
      `${origin}/login?error=invite_expired`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
