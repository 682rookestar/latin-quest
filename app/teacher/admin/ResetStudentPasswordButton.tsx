"use client";

import { useState } from "react";
import CopyLinkButton from "@/app/admin/teachers/CopyLinkButton";
import {
  resetTeacherStudentPassword,
  type TeacherStudentPasswordResetResult,
} from "./actions";

export default function ResetStudentPasswordButton({ studentId, email }: { studentId: string; email: string }) {
  const [state, setState] = useState<TeacherStudentPasswordResetResult | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !window.confirm(`Create a temporary password for ${email}? Their current password will stop working and they will be signed out. Share the temporary password privately with the pupil or an authorised adult.`)) return;
    setPending(true);
    setState(null);
    try {
      setState(await resetTeacherStudentPassword(null, new FormData(event.currentTarget)));
    } catch {
      setState({ ok: false, message: "The reset could not be confirmed. Please try again before sharing any password." });
    } finally { setPending(false); }
  }

  if (state?.ok && state.temporaryPassword) {
    return (
      <div className="rounded border border-olive/30 bg-olive/5 px-3 py-2 text-xs space-y-1 max-w-xl">
        <div>Temporary password for <span className="font-mono">{email}</span>:</div>
        <div className="flex items-center gap-3">
          <code data-testid="temporary-password" className="font-mono text-base select-all break-all">{state.temporaryPassword}</code>
          <CopyLinkButton link={state.temporaryPassword} label="Copy password" />
        </div>
        <div className="text-ink/60">Shown only here; it cannot be retrieved after leaving this page. Share privately. The pupil signs in with their email and this password, then must choose a new password.</div>
        {state.expiresAt && <div>Expires: <time dateTime={state.expiresAt}>{new Date(state.expiresAt).toLocaleString("en-GB")}</time> (24 hours).</div>}
        <button type="button" className="underline" onClick={() => setState(null)}>Hide password</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <input type="hidden" name="student_id" value={studentId} />
      <button type="submit" className="text-sm text-wine hover:underline disabled:opacity-50" disabled={pending}>
        {pending ? "Creating temporary password…" : "Reset password"}
      </button>
      {state && !state.ok && <p role="alert" className="text-wine text-xs mt-1 max-w-md">{state.message}</p>}
    </form>
  );
}
