"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export default function MfaManager({ required }: { required: boolean }) {
  const router = useRouter();
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadFactors() {
    const supabase = createClient();
    const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) setError(factorsError.message);
    setVerifiedFactorId(data?.totp.find((factor) => factor.status === "verified")?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void loadFactors();
  }, []);

  async function beginEnrollment() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Latin Quest",
      issuer: "Latin Quest",
    });
    setLoading(false);
    if (enrollError) {
      setError(enrollError.message);
      return;
    }
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verifyEnrollment() {
    if (!enrollment || !/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code,
    });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setEnrollment(null);
    setCode("");
    await loadFactors();
    router.push("/dashboard");
    router.refresh();
  }

  async function removeFactor() {
    if (!verifiedFactorId || required) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verifiedFactorId,
    });
    setLoading(false);
    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }
    setVerifiedFactorId(null);
    await supabase.auth.refreshSession();
  }

  if (loading && !enrollment) return <p className="text-sm text-ink/60">Checking security settings…</p>;

  if (verifiedFactorId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-olive font-medium">Two-step verification is enabled.</p>
        {!required && (
          <button type="button" className="btn-secondary" onClick={removeFactor} disabled={loading}>
            Remove authenticator
          </button>
        )}
        {required && <p className="text-xs text-ink/60">Contact an administrator if your authenticator is lost.</p>}
        {error && <p className="text-wine text-sm">{error}</p>}
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="space-y-3">
        {required && <p className="text-sm text-wine">Set this up before opening the staff dashboard.</p>}
        <button type="button" className="btn-primary" onClick={beginEnrollment} disabled={loading}>
          Set up authenticator
        </button>
        {error && <p className="text-wine text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="list-decimal pl-5 text-sm text-ink/70 space-y-1">
        <li>Scan this QR code with Microsoft Authenticator, Google Authenticator or another TOTP app.</li>
        <li>Enter the six-digit code it shows.</li>
      </ol>
      {/* Supabase returns a local SVG data URI; no third party receives the secret. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={enrollment.qrCode} alt="Authenticator setup QR code" className="w-48 h-48 bg-white p-2 border rounded" />
      <details className="text-sm">
        <summary className="cursor-pointer text-ink/70">Can&apos;t scan the code?</summary>
        <code className="mt-2 block break-all rounded bg-ink/5 p-2 select-all">{enrollment.secret}</code>
      </details>
      <input
        className="input"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="6-digit code"
        aria-label="Authenticator code"
      />
      <button type="button" className="btn-primary" onClick={verifyEnrollment} disabled={loading || code.length !== 6}>
        {loading ? "Checking…" : "Verify and enable"}
      </button>
      {error && <p className="text-wine text-sm">{error}</p>}
    </div>
  );
}
