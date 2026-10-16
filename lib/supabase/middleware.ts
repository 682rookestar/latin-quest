import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseStudentPasswordStatus } from "@/lib/student-password";
import {
  ADMIN_MAX_SESSION_MS,
  ADMIN_SESSION_COOKIE,
  createAdminSessionStamp,
  isAdminSessionExpired,
  readAdminSessionStamp,
} from "@/lib/admin-session";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  function destination(pathname: string, search: string) {
    const url = new URL(request.url);
    // NextURL normalises loopback IPs to localhost. Keep the QA origin exactly
    // aligned with its host-only session cookies; never trust arbitrary hosts.
    if (process.env.LATIN_QUEST_LOCAL_QA === "1" && request.headers.get("host") === "127.0.0.1:3100") {
      url.hostname = "127.0.0.1";
    }
    url.pathname = pathname;
    url.search = search;
    return url;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
  // This validates the access token and refreshes it, when needed, before the
  // request reaches a Server Component or Server Action. The bulk cookie
  // adapter above ensures every chunk of the refreshed session is forwarded.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  if (!userId && request.cookies.has(ADMIN_SESSION_COOKIE)) {
    response.cookies.delete(ADMIN_SESSION_COOKIE);
  }

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = ["/learn", "/account", "/dashboard", "/teacher", "/admin"].some(path => pathname === path || pathname.startsWith(`${path}/`));
  if (userId && isProtectedRoute) {
    const { data, error } = await supabase.rpc("student_password_status");
    const status = parseStudentPasswordStatus(data);
    if (error || !status) {
      const unavailable = new NextResponse("Account access could not be confirmed. Please try again.", { status: 503 });
      response.cookies.getAll().forEach(cookie => unavailable.cookies.set(cookie));
      return unavailable;
    }
    if (!status.session_valid) {
      await supabase.auth.signOut({ scope: "local" });
      const url = destination("/login", "?error=password_reset");
      const redirected = NextResponse.redirect(url);
      response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
      return redirected;
    }
    if (status.required && pathname !== "/account/change-password") {
      const url = destination("/account/change-password", "");
      const redirected = NextResponse.redirect(url);
      response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
      return redirected;
    }
    {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
        const redirected = NextResponse.redirect(destination("/mfa/verify", ""));
        response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
        return redirected;
      }
    }
  }

  const isStaffRoute =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/teacher");

  if (userId && isStaffRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, disabled_at")
      .eq("id", userId)
      .single();

    if (profile?.disabled_at) {
      await supabase.auth.signOut();
      const url = destination("/login", "?error=account_disabled");
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }

    if (["teacher", "admin"].includes(profile?.role ?? "")) {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel !== "aal2") {
        const url = destination("/account", "?mfa=required");
        const redirectResponse = NextResponse.redirect(url);
        response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
        return redirectResponse;
      }
    }

    if (profile?.role === "admin") {
      const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret) throw new Error("ADMIN_SESSION_SECRET is required to protect administrator sessions.");

      const now = Date.now();
      const existing = await readAdminSessionStamp(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, secret);
      if (existing && (existing.userId !== userId || isAdminSessionExpired(existing, now))) {
        await supabase.auth.signOut();
        const url = destination("/login", "?error=session_expired");
        const redirectResponse = NextResponse.redirect(url);
        response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
        redirectResponse.cookies.delete(ADMIN_SESSION_COOKIE);
        return redirectResponse;
      }

      const stamp = { userId, startedAt: existing?.startedAt ?? now, activeAt: now };
      response.cookies.set(ADMIN_SESSION_COOKIE, await createAdminSessionStamp(stamp, secret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.ceil(ADMIN_MAX_SESSION_MS / 1000),
      });
    }
  }
  return response;
}
