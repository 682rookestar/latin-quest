import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "Latin Quest — De Romanis",
  description: "Gamified Latin learning, built around the De Romanis curriculum.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;
  let displayName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("role, display_name").eq("id", user.id).single();
    role = profile?.role ?? null;
    displayName = profile?.display_name ?? null;
  }

  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: "#0B1220" }}>
        <header className="border-b border-white/10 sticky top-0 z-10" style={{ background: "rgba(11,18,32,0.9)", backdropFilter: "blur(12px)" }}>
          <nav className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white font-bold"
                style={{ background: "#22D3EE", boxShadow: "0 0 16px -4px rgba(34,211,238,0.6)" }}
              >LQ</span>
              <span className="h-display tracking-wide group-hover:text-sky transition text-lg">Latin Quest</span>
              <span className="chip-sky ml-2">de Romanis</span>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              {user ? (
                <>
                  <span className="text-ink/70">
                    {displayName ?? user.email}
                    {role && <span className="ml-2 chip-wine">{role}</span>}
                  </span>
                  <Link
                    className="btn-ghost"
                    href={role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/learn"}
                  >
                    {role === "admin" ? "Admin" : role === "teacher" ? "Teacher dashboard" : "My learning"}
                  </Link>
                  <Link className="btn-ghost" href="/account">Account</Link>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link className="btn-ghost" href="/login">Sign in</Link>
                  <Link className="btn-primary" href="/signup">Sign up</Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        <footer className="max-w-6xl mx-auto px-6 py-12 mt-8 border-t border-ink/10">
          <div className="h-display text-gold text-sm tracking-[0.3em] text-center">
            Lingua Latina · Potentia Aeterna
          </div>
          <div className="text-xs text-ink/45 text-center mt-3">
            Built for the De Romanis curriculum · Latin Quest © {new Date().getFullYear()}
          </div>
          <div className="text-xs text-ink/30 text-center mt-2">
            <Link href="/privacy" className="hover:text-ink/60 transition-colors">Privacy Policy</Link>
          </div>
        </footer>
        <SpeedInsights />
      </body>
    </html>
  );
}
