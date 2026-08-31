"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { resetTeacherMfa, type TeacherMfaResetResult } from "../actions";

function SubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary bg-wine" disabled={!enabled || pending}>
      {pending ? "Resetting…" : "Reset authenticator"}
    </button>
  );
}

export default function ResetMfaButton({ targetId, email }: { targetId: string; email: string }) {
  const [state, formAction] = useFormState<TeacherMfaResetResult | null, FormData>(
    resetTeacherMfa,
    null
  );
  const [confirmation, setConfirmation] = useState("");

  return (
    <details>
      <summary className="cursor-pointer text-sm text-wine">Teacher lost authenticator access</summary>
      <div className="mt-2 max-w-xl rounded border border-wine/20 bg-wine/5 p-4">
        <p className="mb-3 text-xs text-ink/70">
          Verify the teacher through their known school email or with school IT first. This removes
          all registered authenticator factors and signs the teacher out of active sessions. Their
          classes and pupil records are not changed.
        </p>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="target_id" value={targetId} />
          <label className="block text-xs">
            Reason
            <select className="input mt-1 w-full" name="reason" required defaultValue="lost_device">
              <option value="lost_device">Lost authenticator device</option>
              <option value="replaced_device">Replaced authenticator device</option>
              <option value="authenticator_unavailable">Authenticator unavailable</option>
            </select>
          </label>
          <label className="block text-xs">
            Type <strong className="font-mono">{email}</strong> to confirm
            <input
              className="input mt-1 w-full"
              name="confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          <SubmitButton enabled={confirmation === email} />
          {state && (
            <p className={`text-xs ${state.ok ? "text-olive" : "text-wine"}`} role="status">
              {state.message}
            </p>
          )}
        </form>
      </div>
    </details>
  );
}

