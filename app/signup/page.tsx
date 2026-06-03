"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
        <p className="h-display text-gold text-xs tracking-[0.3em] mb-3">Begin your legion</p>
        <h1 className="h-display text-3xl text-white mb-1">Join the Academy</h1>

        {/* Microsoft SSO — primary path for school users */}
        <button
          onClick={signInWithMicrosoft}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-white mt-4 mb-4"
        >
          <MicrosoftIcon />
          Sign up with Microsoft
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30">or use a join code</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

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
      </div>
    </div>
  );
}
