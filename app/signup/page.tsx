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
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // 1. Validate the join code BEFORE creating an auth user. This is
    // what stops random internet visitors from registering -- no valid
    // code, no account.
    const cleanCode = code.replace(/\s+/g, "").toUpperCase();
    const { data: cls, error: codeError } = await supabase
      .rpc("validate_join_code", { p_code: cleanCode })
      .maybeSingle();
    if (codeError || !cls) {
      setLoading(false);
      setError("That join code isn't valid or has expired. Ask your teacher for the latest one.");
      return;
    }

    // 2. Code is good. Create the auth user. Role is decided server-
    // side: trigger handle_new_user always provisions students (the
    // raw_user_meta_data.role field is ignored).
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
      },
    });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    // 3. Auto-enrol them in the class they just typed the code for.
    // The signUp call has already set their session cookies, so this
    // RPC runs as the new student.
    const { error: enrolError } = await supabase
      .rpc("join_class_by_code", { p_code: cleanCode })
      .maybeSingle();
    setLoading(false);
    if (enrolError) {
      // Account exists but enrolment failed -- they can still try
      // from /learn/join. Show a soft warning rather than blocking.
      router.push("/learn/join?error=enrol_failed");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative -mx-6 -mt-8 flex items-center min-h-[calc(100vh-64px)]">
      {/* Hero background */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/hero.png')",
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
        <p className="h-display text-gold text-xs tracking-[0.3em] mb-3">Begin your legion</p>
        <h1 className="h-display text-3xl text-white mb-1">Create a student account</h1>
        <p className="text-sm text-white/50 mb-6">
          Enter the join code your teacher gave you to sign up.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <input
            className="input uppercase tracking-widest text-center text-lg font-mono"
            name="code"
            placeholder="join code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={12}
            required
            autoComplete="off"
          />
          <input className="input" placeholder="full name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
          <input className="input" type="email" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          {error && <p className="text-wine text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
        </form>
        <p className="text-sm text-white/50 mt-4">
          Already have an account? <Link className="underline text-gold" href="/login">Sign in</Link>
        </p>
        <p className="text-xs text-white/30 mt-2">
          Don&apos;t have a join code? Ask your teacher &mdash; or, if you&apos;re a teacher yourself, ask your admin to send you an invite.
        </p>
      </div>
    </div>
  );
}
