"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const supabase = createClient();
    // Role is decided server-side: students by default, teachers only
    // via an admin-issued invite that handle_new_user honours by email.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
      },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto card p-6 mt-12">
      <h1 className="text-2xl font-bold">Create a student account</h1>
      <p className="text-sm text-ink/60 mb-6">
        Sign up to join a class. You&apos;ll need a join code from your teacher to enrol.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <input className="input" placeholder="full name"     value={displayName} onChange={e=>setDisplayName(e.target.value)} required />
        <input className="input" type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="password (min 6 chars)" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
        {error && <p className="text-wine text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="text-sm text-ink/60 mt-4">
        Already have an account? <Link className="underline" href="/login">Sign in</Link>
      </p>
      <p className="text-xs text-ink/50 mt-2">
        Teachers are added by an administrator &mdash; if you&apos;re a teacher, ask your admin to send you an invite.
      </p>
    </div>
  );
}
