"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VerifyMfaPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError(factorsError.message);
      } else {
        const id = data.totp.find((factor) => factor.status === "verified")?.id ?? null;
        if (!id) router.replace("/account?mfa=required");
        setFactorId(id);
      }
      setLoading(false);
    })();
  }, [router]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setLoading(false);
    if (verifyError) {
      setError("That code was not accepted. Wait for a new code and try again.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto card p-6 mt-12 space-y-4">
      <div>
        <p className="h-display text-sky text-xs tracking-[0.3em] mb-2">Security check</p>
        <h1 className="h-display text-2xl">Enter your authenticator code</h1>
        <p className="text-sm text-ink/60 mt-1">Open your authenticator app and enter the current six-digit code.</p>
      </div>
      <form onSubmit={verify} className="space-y-3">
        <input
          className="input text-center tracking-widest text-xl"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          aria-label="Authenticator code"
          autoFocus
        />
        {error && <p className="text-wine text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading || !factorId || code.length !== 6}>
          {loading ? "Checking…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
