"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

const URL_ERRORS: Record<string, string> = {
  missing_token: "The invite link is missing required information.",
  invite_expired: "That invite link is invalid or has already been used. Please ask your admin for a new one.",
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlErrorKey = searchParams.get("error");
  const urlError = urlErrorKey ? URL_ERRORS[urlErrorKey] ?? null : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/dashboard");
    router.refresh();
  }

  async function signInWithMicrosoft() {
    setLoading(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid email profile",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) { setLoading(false); setError(error.message); }
    // On success the browser redirects — no further action needed here
  }

  return (
    <div className="relative -mx-6 -mt-8 flex items-center min-h-[calc(100vh-64px)]">
      {/* Hero background */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/signin.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, #0B1220 0%, #0B1220 20%, rgba(11,18,32,0.6) 35%, rgba(11,18,32,0.0) 55%)",
        }}
      />

      {/* Form */}
      <div className="relative z-10 w-full max-w-sm ml-6 sm:ml-16 my-12">
        <p className="h-display text-gold text-xs tracking-[0.3em] mb-3">Salve, discipule</p>
        <h1 className="h-display text-3xl text-white mb-1">Sign in</h1>
        <p className="text-sm text-white/50 mb-6">Welcome back to the academy.</p>
        {urlError && (
          <p className="text-wine text-sm bg-wine/5 border border-wine/20 rounded p-3 mb-4">
            {urlError}
          </p>
        )}
        {/* Microsoft SSO */}
        <button
          onClick={signInWithMicrosoft}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-white mb-4"
        >
          <MicrosoftIcon />
          Sign in with Microsoft
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <input className="input" type="email" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="text-wine text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="text-sm text-white/50 mt-4">
          No account? <Link className="underline text-gold" href="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
