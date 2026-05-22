"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-8 items-center mt-6">
      {/* Form column */}
      <div className="max-w-md mx-auto w-full hex-frame">
        <div className="p-8">
          <p className="h-display text-sky text-xs tracking-[0.3em] mb-3">Salve, discipule</p>
          <h1 className="h-display text-3xl">Sign in</h1>
          <p className="text-sm text-ink/60 mb-6">Welcome back to the academy.</p>
          {urlError && (
            <p className="text-wine text-sm bg-wine/5 border border-wine/20 rounded p-3 mb-4">
              {urlError}
            </p>
          )}
          <form onSubmit={submit} className="space-y-4">
            <input className="input" type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input className="input" type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} required />
            {error && <p className="text-wine text-sm">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
          </form>
          <p className="text-sm text-ink/60 mt-4">
            No account? <Link className="underline" href="/signup">Sign up</Link>
          </p>
        </div>
      </div>

      {/* Hero image column -- hidden on mobile */}
      <div className="hidden lg:block hex-frame">
        <div className="hero-image" style={{ aspectRatio: "4/5" }} />
      </div>
    </div>
  );
}
