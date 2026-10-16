"use client";
import { useFormState, useFormStatus } from "react-dom";
import { completeStudentPasswordChange } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Changing password…" : "Save my new password"}</button>;
}

export default function TemporaryPasswordForm() {
  const [state, action] = useFormState(completeStudentPasswordChange, null);
  return <form action={action} className="space-y-4">
    <label className="block text-sm">Temporary password from your teacher
      <input name="temporary_password" type="password" className="input mt-1" autoComplete="current-password" maxLength={128} required />
    </label>
    <label className="block text-sm">Your new password
      <input name="password" type="password" className="input mt-1" autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby="password-help" />
    </label>
    <p id="password-help" className="text-xs text-ink/60">Use at least 12 characters. Choose something different from your temporary password and keep it private.</p>
    <label className="block text-sm">Confirm your new password
      <input name="confirm_password" type="password" className="input mt-1" autoComplete="new-password" minLength={12} maxLength={128} required />
    </label>
    {state?.error && <p role="alert" className="text-sm text-wine">{state.error}</p>}
    <SubmitButton />
  </form>;
}
