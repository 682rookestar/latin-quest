import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

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
      <body className="font-serif min-h-screen parchment">
        <header className="border-b border-ink/15 bg-parchment/80 backdrop-blur sticky top-0 z-10">
          <nav className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">⚱</span>
              <span className="font-bold tracking-wide">Latin Quest</span>
              <span className="chip-gold ml-2">de Romanis</span>
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
        <footer className="max-w-6xl mx-auto px-6 py-10 text-xs text-ink/50">
          Built for the De Romanis curriculum · Latin Quest © {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
