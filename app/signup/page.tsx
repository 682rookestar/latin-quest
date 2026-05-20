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
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { display_name: displayName, role },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
      },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // If email confirm is off they'll be logged in straight away; otherwise show a message.
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto card p-6 mt-12">
      <h1 className="text-2xl font-bold">Create account</h1>
      <p className="text-sm text-ink/60 mb-6">Pick a role to get started.</p>
      <form onSubmit={submit} className="space-y-4">
        <input className="input" placeholder="full name"     value={displayName} onChange={e=>setDisplayName(e.target.value)} required />
        <input className="input" type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="password (min 6 chars)" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
        <fieldset className="flex gap-3">
          <label className={`flex-1 border rounded-lg p-3 cursor-pointer ${role==='student'?'border-wine bg-wine/5':'border-ink/20'}`}>
            <input type="radio" name="role" className="mr-2" checked={role==='student'} onChange={()=>setRole('student')} />
            Student
          </label>
          <label className={`flex-1 border rounded-lg p-3 cursor-pointer ${role==='teacher'?'border-wine bg-wine/5':'border-ink/20'}`}>
            <input type="radio" name="role" className="mr-2" checked={role==='teacher'} onChange={()=>setRole('teacher')} />
            Teacher
          </label>
        </fieldset>
        {error && <p className="text-wine text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="text-sm text-ink/60 mt-4">
        Already have an account? <Link className="underline" href="/login">Sign in</Link>
      </p>
    </div>
  );
}
