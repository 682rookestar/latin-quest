"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setPassword("");
    setConfirm("");
    setSuccess("Password updated. You can now sign in with email + password.");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className="input"
        type="password"
        placeholder="new password (min 8 chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      <input
        className="input"
        type="password"
        placeholder="confirm password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      {error && <p className="text-wine text-sm">{error}</p>}
      {success && <p className="text-olive text-sm">{success}</p>}
      <button className="btn-primary w-full" disabled={loading} type="submit">
        {loading ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
