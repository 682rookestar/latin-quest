"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    router.push(
      assurance?.currentLevel === "aal1" && assurance.nextLevel === "aal2"
        ? "/mfa/verify"
        : "/dashboard"
    );
    router.refresh();
  }

  return (
    <div className="relative -mx-6 -mt-8 flex items-center min-h-[calc(100vh-64px)]">
      {/* Hero background */}
      <Image
        src="/signin.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
        aria-hidden
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
