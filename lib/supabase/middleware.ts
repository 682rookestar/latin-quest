import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_MAX_SESSION_MS,
  ADMIN_SESSION_COOKIE,
  createAdminSessionStamp,
  isAdminSessionExpired,
  readAdminSessionStamp,
} from "@/lib/admin-session";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.cookies.has(ADMIN_SESSION_COOKIE)) {
    response.cookies.delete(ADMIN_SESSION_COOKIE);
  }

  const isStaffRoute =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/teacher");

  if (user && isStaffRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, disabled_at")
      .eq("id", user.id)
      .single();

    if (profile?.disabled_at) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?error=account_disabled";
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }

    if (["teacher", "admin"].includes(profile?.role ?? "")) {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel !== "aal2") {
        const url = request.nextUrl.clone();
        url.pathname = "/account";
        url.search = "?mfa=required";
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
      if (existing && (existing.userId !== user.id || isAdminSessionExpired(existing, now))) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "?error=session_expired";
        const redirectResponse = NextResponse.redirect(url);
        response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
        redirectResponse.cookies.delete(ADMIN_SESSION_COOKIE);
        return redirectResponse;
      }

      const stamp = { userId: user.id, startedAt: existing?.startedAt ?? now, activeAt: now };
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
