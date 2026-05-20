"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
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
    <div className="max-w-md mx-auto card p-6 mt-12">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-sm text-ink/60 mb-6">Welcome back.</p>
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
  );
}
